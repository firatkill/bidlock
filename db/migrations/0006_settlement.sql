create or replace function bidlock.pay_offer(p_auction_id uuid, p_bidder_id uuid)
returns bidlock.pay_result
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a     bidlock.auctions;
  o     bidlock.offers;
  r     bidlock.pay_result;
  v_now timestamptz;
begin
  r.replayed := false;
  if (select s.bidding_paused from bidlock.settings s) then
    r.outcome := 'rejected'; r.error_code := 'BIDDING_PAUSED'; r.server_now := bidlock.bidlock_now();
    return r;
  end if;

  select * into a from bidlock.auctions where id = p_auction_id for update;
  if not found or not bidlock._can_view(a, p_bidder_id) then
    r.outcome := 'rejected'; r.error_code := 'NOT_FOUND'; r.server_now := bidlock.bidlock_now();
    return r;
  end if;

  v_now := bidlock.bidlock_now();
  a := bidlock.advance_auction_locked(a, v_now);   -- expires a due offer before we look at it

  r.auction_id := a.id; r.server_now := v_now;

  select * into o from bidlock.offers
   where auction_id = a.id and bidder_id = p_bidder_id and status = 'paid';
  if found then                                     -- idempotent: paying twice returns the first payment
    r.outcome := 'accepted'; r.replayed := true;
    r.status := a.status; r.payment_state := a.payment_state;
    r.offer_rank := o.rank; r.amount := o.amount; r.version := a.version;
    return r;
  end if;

  select * into o from bidlock.offers
   where auction_id = a.id and bidder_id = p_bidder_id and status = 'open';
  if not found then
    r.outcome := 'rejected';
    r.error_code := case when exists (
        select 1 from bidlock.offers x
         where x.auction_id = a.id and x.bidder_id = p_bidder_id and x.status = 'expired')
      then 'OFFER_EXPIRED' else 'NOT_PAYABLE' end;
    r.status := a.status; r.payment_state := a.payment_state; r.version := a.version;
    return r;
  end if;

  -- advance_auction_locked guarantees v_now < o.deadline here.
  update bidlock.offers set status = 'paid', resolved_at = v_now where id = o.id;
  update bidlock.auctions
     set status = 'settled', payment_state = 'paid', settled_at = v_now, version = version + 1
   where id = a.id
   returning * into a;
  perform bidlock._event(a.id, 'offer_paid', p_bidder_id,
                         jsonb_build_object('rank', o.rank, 'amount', o.amount), v_now);

  r.outcome := 'accepted'; r.status := a.status; r.payment_state := a.payment_state;
  r.offer_rank := o.rank; r.amount := o.amount; r.version := a.version;
  return r;
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.pay_offer(uuid, uuid) to bidlock_app;
