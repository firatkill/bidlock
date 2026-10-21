create type bidlock.bid_result as (
  outcome          text,         -- 'accepted' | 'rejected'
  error_code       text,         -- null when accepted; see §10.12
  replayed         boolean,
  auction_id       uuid,
  bid_id           uuid,
  bid_no           integer,
  amount           bigint,
  placed_at        timestamptz,
  status           text,
  current_price    bigint,
  leader_bidder_id uuid,
  min_next_bid     bigint,
  max_bid          bigint,
  ends_at          timestamptz,
  extended         boolean,
  extension_count  integer,
  version          bigint,
  server_now       timestamptz
);

create type bidlock.pay_result as (
  outcome        text,
  error_code     text,        -- NOT_FOUND | NOT_PAYABLE | OFFER_EXPIRED | BIDDING_PAUSED
  replayed       boolean,
  auction_id     uuid,
  status         text,
  payment_state  text,
  offer_rank     smallint,
  amount         bigint,
  version        bigint,
  server_now     timestamptz
);

create or replace function bidlock._bid_result(
  a bidlock.auctions, p_outcome text, p_code text, p_now timestamptz
) returns bidlock.bid_result
language plpgsql stable security definer set search_path = bidlock, pg_temp as $$
declare r bidlock.bid_result;
begin
  r.outcome    := p_outcome;
  r.error_code := p_code;
  r.replayed   := false;
  r.server_now := p_now;
  if a.id is not null then
    r.auction_id       := a.id;
    r.status           := a.status;
    r.current_price    := a.current_price;
    r.leader_bidder_id := a.leader_bidder_id;
    r.min_next_bid     := bidlock.min_next_bid(a.starting_price, a.current_price);
    r.max_bid          := bidlock.max_bid(a.starting_price, a.current_price);
    r.ends_at          := a.ends_at;
    r.extended         := false;
    r.extension_count  := a.extension_count;
    r.version          := a.version;
  end if;
  return r;
end $$;

create or replace function bidlock._can_view(a bidlock.auctions, p_bidder_id uuid)
returns boolean language sql stable security definer set search_path = bidlock, pg_temp as $$
  select case
    when a.kind <> 'sandbox' then true
    when p_bidder_id is null then false
    else exists (select 1 from bidlock.sandboxes s where s.id = a.sandbox_id and s.owner_id = p_bidder_id)
      or exists (select 1 from bidlock.bidders d where d.id = p_bidder_id and d.sandbox_id = a.sandbox_id)
  end;
$$;

create or replace function bidlock._is_due(a bidlock.auctions, p_now timestamptz)
returns boolean language sql stable security definer set search_path = bidlock, pg_temp as $$
  select (a.status = 'scheduled' and p_now >= a.starts_at)
      or (a.status = 'live' and p_now >= a.ends_at)
      or (a.status = 'closed' and exists (
            select 1 from bidlock.offers o
            where o.auction_id = a.id and o.status = 'open' and p_now >= o.deadline));
$$;

-- T3 / T4. Caller holds the row lock.
create or replace function bidlock._close_locked(a bidlock.auctions, p_now timestamptz)
returns bidlock.auctions
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare r bidlock.auctions;
begin
  if a.bid_count = 0 then
    update bidlock.auctions
       set status = 'unsold', payment_state = null, closed_at = a.ends_at, version = version + 1
     where id = a.id
     returning * into r;
    perform bidlock._event(a.id, 'auction_unsold', null, jsonb_build_object('reason', 'no_bids'), p_now);
  else
    update bidlock.auctions
       set status = 'closed', payment_state = 'awaiting_payment', closed_at = a.ends_at, version = version + 1
     where id = a.id
     returning * into r;
    insert into bidlock.offers (auction_id, rank, bidder_id, amount, status, opened_at, deadline)
    values (a.id, 1, a.leader_bidder_id, a.current_price, 'open', p_now,
            p_now + make_interval(secs => a.payment_window_s));
    perform bidlock._event(a.id, 'auction_closed', a.leader_bidder_id,
                           jsonb_build_object('price', a.current_price, 'bid_count', a.bid_count), p_now);
    perform bidlock._event(a.id, 'offer_opened', a.leader_bidder_id,
                           jsonb_build_object('rank', 1, 'amount', a.current_price), p_now);
  end if;
  return r;
end $$;

-- T6 / T7 / T9. Caller holds the row lock; o is the open offer whose deadline passed.
create or replace function bidlock._expire_offer_locked(a bidlock.auctions, o bidlock.offers, p_now timestamptz)
returns bidlock.auctions
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  r        bidlock.auctions;
  v_runner record;
begin
  update bidlock.offers set status = 'expired', resolved_at = p_now where id = o.id;
  perform bidlock._event(a.id, 'offer_expired', o.bidder_id, jsonb_build_object('rank', o.rank), p_now);

  if o.rank = 1 then
    insert into bidlock.payment_strikes (bidder_id, auction_id, offer_id, created_at)
    values (o.bidder_id, a.id, o.id, p_now);
    update bidlock.bidders set payment_strikes = payment_strikes + 1 where id = o.bidder_id;
    perform bidlock._event(a.id, 'strike_recorded', o.bidder_id, '{}'::jsonb, p_now);

    -- Runner-up: the bidder other than the winner with the highest own bid.
    select b.bidder_id, max(b.amount) as amount
      into v_runner
      from bidlock.bids b
     where b.auction_id = a.id and b.bidder_id <> o.bidder_id
     group by b.bidder_id
     order by max(b.amount) desc
     limit 1;

    if found then
      insert into bidlock.offers (auction_id, rank, bidder_id, amount, status, opened_at, deadline)
      values (a.id, 2, v_runner.bidder_id, v_runner.amount, 'open', p_now,
              p_now + make_interval(secs => a.payment_window_s));
      update bidlock.auctions
         set payment_state = 'offered_to_runner_up', version = version + 1
       where id = a.id
       returning * into r;
      perform bidlock._event(a.id, 'offer_opened', v_runner.bidder_id,
                             jsonb_build_object('rank', 2, 'amount', v_runner.amount), p_now);
      return r;
    end if;
  end if;

  update bidlock.auctions
     set status = 'unsold', payment_state = 'expired', version = version + 1
   where id = a.id
   returning * into r;
  perform bidlock._event(a.id, 'auction_unsold', null,
                         jsonb_build_object('reason', case when o.rank = 1 then 'winner_expired_no_runner_up'
                                                           else 'runner_up_expired' end), p_now);
  return r;
end $$;

-- Applies every due time-based transition to one auction. Takes (or re-takes) the row lock;
-- re-locking a row this transaction already holds is a no-op.
create or replace function bidlock.advance_auction_locked(p_auction bidlock.auctions, p_now timestamptz)
returns bidlock.auctions
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a       bidlock.auctions;
  o       bidlock.offers;
  v_steps integer := 0;
begin
  select * into a from bidlock.auctions where id = p_auction.id for update;
  loop
    v_steps := v_steps + 1;
    if v_steps > 8 then
      raise exception using errcode = 'BLK03', message = format('advance_auction_locked: no fixpoint for %s', a.id);
    end if;

    if a.status = 'scheduled' and p_now >= a.starts_at then
      update bidlock.auctions set status = 'live', version = version + 1 where id = a.id returning * into a;
      perform bidlock._event(a.id, 'auction_started', null, '{}'::jsonb, p_now);
    elsif a.status = 'live' and p_now >= a.ends_at then
      a := bidlock._close_locked(a, p_now);
    elsif a.status = 'closed' then
      select * into o from bidlock.offers where auction_id = a.id and status = 'open';
      exit when not found or p_now < o.deadline;
      a := bidlock._expire_offer_locked(a, o, p_now);
    else
      exit;
    end if;
  end loop;
  return a;
end $$;

revoke execute on all functions in schema bidlock from public;
