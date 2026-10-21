create or replace function bidlock.create_bidder(p_ip_hash text)
returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare v_retry integer; v_id uuid; v_name text;
begin
  v_retry := bidlock.rate_hit('bidder_create_ip_3600s', p_ip_hash, bidlock.bidlock_now());
  if v_retry > 0 then
    return jsonb_build_object('outcome', 'rejected', 'error_code', 'RATE_LIMITED', 'retry_after_ms', v_retry);
  end if;
  v_name := 'Bidder ' || (1000 + floor(random() * 9000))::int::text;
  insert into bidlock.bidders (display_name) values (v_name) returning id into v_id;
  return jsonb_build_object('outcome', 'accepted', 'bidder_id', v_id, 'display_name', v_name);
end $$;

create or replace function bidlock.rename_bidder(p_bidder_id uuid, p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
begin
  -- Content rules (characters, profanity, "bot" suffix) are input validation done in TypeScript;
  -- length is re-checked by the column constraint.
  update bidlock.bidders set display_name = p_name where id = p_bidder_id and not is_bot;
  if not found then
    return jsonb_build_object('outcome', 'rejected', 'error_code', 'NOT_FOUND');
  end if;
  return jsonb_build_object('outcome', 'accepted');
end $$;

create or replace function bidlock.auction_state(p_auction_id uuid, p_viewer_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=bidlock,pg_temp as $$
declare a bidlock.auctions; v_now timestamptz; v_next uuid;
begin
  select * into a from bidlock.auctions where id=p_auction_id;
  if not found or not bidlock._can_view(a,p_viewer_id) then return null; end if;
  v_now := bidlock.bidlock_now();
  if bidlock._is_due(a,v_now) then
    select * into a from bidlock.auctions where id=p_auction_id for update skip locked;
    if found then a := bidlock.advance_auction_locked(a,v_now);
    else select * into a from bidlock.auctions where id=p_auction_id;
    end if;
  end if;
  if a.kind='public' and a.status not in ('scheduled','live') then
    v_next := bidlock.ensure_public_auction();
  end if;
  return jsonb_build_object(
  'id', a.id, 'lot_no', a.lot_no, 'kind', a.kind, 'title', a.title,
  'status', a.status, 'payment_state', a.payment_state,
  'starting_price', a.starting_price, 'current_price', a.current_price,
  'min_next_bid', bidlock.min_next_bid(a.starting_price, a.current_price),
  'max_bid', bidlock.max_bid(a.starting_price, a.current_price),
  'increment', bidlock.increment_for(coalesce(a.current_price, a.starting_price)),
  'bid_count', a.bid_count,
  'leader', (select jsonb_build_object('id', d.id, 'display_name', d.display_name, 'is_bot', d.is_bot)
               from bidlock.bidders d where d.id = a.leader_bidder_id),
  'starts_at', a.starts_at, 'ends_at', a.ends_at, 'original_ends_at', a.original_ends_at,
  'closed_at', a.closed_at, 'settled_at', a.settled_at,
  'snipe_window_s', a.snipe_window_s, 'extend_by_s', a.extend_by_s,
  'max_extensions', a.max_extensions, 'extension_count', a.extension_count,
  'last_extension', (select jsonb_build_object('n', e.n, 'bid_id', e.bid_id, 'old_ends_at', e.old_ends_at,
                                               'new_ends_at', e.new_ends_at, 'at', e.at)
                       from bidlock.auction_extensions e where e.auction_id = a.id order by e.n desc limit 1),
  'offer', (select jsonb_build_object('rank', o.rank, 'bidder_id', o.bidder_id, 'display_name', d.display_name,
                                      'is_bot', d.is_bot, 'amount', o.amount, 'status', o.status,
                                      'opened_at', o.opened_at, 'deadline', o.deadline)
              from bidlock.offers o join bidlock.bidders d on d.id = o.bidder_id
             where o.auction_id = a.id and o.status in ('open', 'paid')
             order by o.rank desc limit 1),
  'expired_offers', (select coalesce(jsonb_agg(jsonb_build_object('rank', o.rank, 'bidder_id', o.bidder_id) order by o.rank), '[]')
                       from bidlock.offers o where o.auction_id = a.id and o.status = 'expired'),
  'sandbox', (select jsonb_build_object('id', s.id, 'owner_id', s.owner_id, 'expires_at', s.expires_at)
                from bidlock.sandboxes s where s.id = a.sandbox_id),
  'next_public_auction_id', v_next,
  'version', a.version,
  'server_now', bidlock.bidlock_now()
);
end $$;

create or replace function bidlock.list_bids(p_auction_id uuid, p_viewer_id uuid, p_before integer, p_after integer, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path=bidlock,pg_temp as $$
declare a bidlock.auctions; r jsonb;
begin
  select * into a from bidlock.auctions where id=p_auction_id;
  if not found or not bidlock._can_view(a,p_viewer_id) then return null; end if;
  with page as (
    select b.*,d.display_name,d.is_bot from bidlock.bids b join bidlock.bidders d on d.id=b.bidder_id
    where b.auction_id=p_auction_id and (p_before is null or b.bid_no<p_before) and (p_after is null or b.bid_no>p_after)
    order by case when p_after is null then -b.bid_no else b.bid_no end
    limit greatest(1,least(p_limit,50))
  ) select jsonb_build_object(
    'bids',coalesce(jsonb_agg(jsonb_build_object('id',id,'bid_no',bid_no,'bidder_id',bidder_id,
      'display_name',display_name,'is_bot',is_bot,'amount',amount,'placed_at',placed_at,
      'extended',ends_at_after>ends_at_before) order by case when p_after is null then -bid_no else bid_no end),'[]'::jsonb),
    'next_cursor',case when min(bid_no)=1 then null else min(bid_no) end
  ) into r from page;
  return r;
end $$;

create or replace function bidlock.list_auctions(p_viewer_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=bidlock,pg_temp as $$
declare v_public uuid; v_sandbox uuid;
begin
  v_public := bidlock.ensure_public_auction();
  select a.id into v_sandbox from bidlock.sandboxes s join bidlock.auctions a on a.sandbox_id=s.id
  where s.owner_id=p_viewer_id and s.expires_at>bidlock.bidlock_now() order by s.created_at desc limit 1;
  return jsonb_build_object('public',bidlock.auction_state(v_public,p_viewer_id),
    'sandbox',case when v_sandbox is null then null else bidlock.auction_state(v_sandbox,p_viewer_id) end);
end $$;

create or replace function bidlock.get_me(p_bidder_id uuid)
returns jsonb language plpgsql stable security definer set search_path=bidlock,pg_temp as $$
declare d bidlock.bidders;
begin
  select * into d from bidlock.bidders where id=p_bidder_id and not is_bot;
  if not found then return null; end if;
  return jsonb_build_object('id',d.id,'display_name',d.display_name,'payment_strikes',d.payment_strikes,
    'active_sandbox',(select jsonb_build_object('sandbox_id',s.id,'auction_id',a.id,'expires_at',s.expires_at,'status',a.status,'ends_at',a.ends_at)
      from bidlock.sandboxes s join bidlock.auctions a on a.sandbox_id=s.id
      where s.owner_id=d.id and s.expires_at>bidlock.bidlock_now() and a.status in ('scheduled','live','closed')
      order by s.created_at desc limit 1),
    'open_offers',(select coalesce(jsonb_agg(jsonb_build_object('auction_id',a.id,'lot_no',a.lot_no,'title',a.title,
      'rank',o.rank,'amount',o.amount,'deadline',o.deadline) order by o.deadline),'[]'::jsonb)
      from bidlock.offers o join bidlock.auctions a on a.id=o.auction_id
      where o.bidder_id=d.id and o.status='open' and o.deadline>bidlock.bidlock_now()),
    'server_now',bidlock.bidlock_now());
end $$;

create or replace function bidlock.stats()
returns jsonb language sql stable security definer set search_path=bidlock,pg_temp as $$
  select jsonb_build_object(
    'bids_today',(select count(*) from bidlock.bids where placed_at>=date_trunc('day',bidlock.bidlock_now(),'UTC')),
    'active_sandboxes',(select count(*) from bidlock.sandboxes s join bidlock.auctions a on a.sandbox_id=s.id
      where s.expires_at>bidlock.bidlock_now() and a.status in ('scheduled','live','closed')),
    'public_lots_today',(select count(*) from bidlock.auctions where kind='public' and created_at>=date_trunc('day',bidlock.bidlock_now(),'UTC')),
    'server_now',bidlock.bidlock_now());
$$;
revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.create_bidder(text),bidlock.rename_bidder(uuid,text),bidlock.auction_state(uuid,uuid),
  bidlock.list_bids(uuid,uuid,integer,integer,integer),bidlock.list_auctions(uuid),bidlock.get_me(uuid),bidlock.stats() to bidlock_app;
