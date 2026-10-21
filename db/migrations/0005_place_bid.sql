-- Re-select after ON CONFLICT DO NOTHING lost the race. Same auction + amount => replay of the
-- committed result (cannot normally happen because the auction lock serializes same-auction
-- duplicates, but answering from the row keeps the function correct if that ever changes);
-- otherwise IDEMPOTENCY_MISMATCH. Nothing is stored.
create or replace function bidlock._idempotency_conflict(
  p_bidder_id uuid, p_key uuid, p_auction_id uuid, p_amount bigint, a bidlock.auctions, p_now timestamptz
) returns bidlock.bid_result
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_prev   bidlock.bid_requests;
  v_result bidlock.bid_result;
begin
  select * into v_prev from bidlock.bid_requests r
   where r.bidder_id = p_bidder_id and r.idempotency_key = p_key;
  if found and v_prev.auction_id = p_auction_id and v_prev.amount = p_amount then
    v_result := jsonb_populate_record(null::bidlock.bid_result, v_prev.result);
    v_result.replayed := true;
    return v_result;
  end if;
  return bidlock._bid_result(a, 'rejected', 'IDEMPOTENCY_MISMATCH', p_now);
end $$;
create or replace function bidlock.place_bid(
  p_auction_id      uuid,
  p_bidder_id       uuid,
  p_amount          bigint,
  p_idempotency_key uuid
) returns bidlock.bid_result
language plpgsql
volatile
security definer
set search_path = bidlock, pg_temp
as $$
declare
  v_auction   bidlock.auctions;
  v_bidder    bidlock.bidders;
  v_prev      bidlock.bid_requests;
  v_result    bidlock.bid_result;
  v_now       timestamptz;
  v_code      text;
  v_min       bigint;
  v_max       bigint;
  v_new_ends  timestamptz;
  v_extended  boolean := false;
  v_bid_id    uuid := gen_random_uuid();
  v_req_id    uuid := gen_random_uuid();
  v_bid_no    integer;
  v_rows      integer;
begin
  -- 0. Argument checks. The API validates first; these protect direct SQL callers.
  if p_auction_id is null or p_bidder_id is null or p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'place_bid: null argument';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then
    return bidlock._bid_result(null, 'rejected', 'VALIDATION', bidlock.bidlock_now());
  end if;

  select * into v_bidder from bidlock.bidders where id = p_bidder_id;
  if not found then
    return bidlock._bid_result(null, 'rejected', 'NOT_FOUND', bidlock.bidlock_now());
  end if;

  if (select s.bidding_paused from bidlock.settings s) then
    return bidlock._bid_result(null, 'rejected', 'BIDDING_PAUSED', bidlock.bidlock_now());
  end if;

  -- 1. Serialize all bids on this auction. A concurrent place_bid waits here until we commit.
  --    Under Read Committed, once the lock is granted the row returned is the latest committed version.
  select * into v_auction from bidlock.auctions where id = p_auction_id for update;
  if not found or not bidlock._can_view(v_auction, p_bidder_id)
     or (v_bidder.is_bot and v_auction.sandbox_id is distinct from v_bidder.sandbox_id) then
    return bidlock._bid_result(null, 'rejected', 'NOT_FOUND', bidlock.bidlock_now());
  end if;

  -- 2. Read the clock AFTER the lock: a bid that waited in the queue past ends_at must be rejected.
  v_now := bidlock.bidlock_now();

  -- 3. Idempotency. This is a new statement, so it sees requests committed while we waited for the lock.
  select * into v_prev
    from bidlock.bid_requests r
   where r.bidder_id = p_bidder_id and r.idempotency_key = p_idempotency_key;
  if found then
    if v_prev.auction_id <> p_auction_id or v_prev.amount <> p_amount then
      return bidlock._bid_result(v_auction, 'rejected', 'IDEMPOTENCY_MISMATCH', v_now);
    end if;
    v_result := jsonb_populate_record(null::bidlock.bid_result, v_prev.result);
    v_result.replayed := true;
    return v_result;
  end if;

  -- 4. Lazy transitions: start a due scheduled auction, close a due live one (committed with this call).
  v_auction := bidlock.advance_auction_locked(v_auction, v_now);

  -- 5. Rules, in this order (first failure wins).
  v_min := bidlock.min_next_bid(v_auction.starting_price, v_auction.current_price);
  v_max := bidlock.max_bid(v_auction.starting_price, v_auction.current_price);
  if v_auction.status = 'scheduled' then
    v_code := 'AUCTION_NOT_LIVE';
  elsif v_auction.status <> 'live' or v_now >= v_auction.ends_at then
    v_code := 'AUCTION_CLOSED';
  elsif v_auction.leader_bidder_id = p_bidder_id then
    v_code := 'ALREADY_LEADING';
  elsif p_amount < v_min then
    v_code := 'BID_TOO_LOW';
  elsif p_amount > v_max then
    v_code := 'BID_TOO_HIGH';
  end if;

  if v_code is not null then
    v_result := bidlock._bid_result(v_auction, 'rejected', v_code, v_now);
    insert into bidlock.bid_requests
      (id, bidder_id, idempotency_key, auction_id, amount, outcome, error_code, result, created_at)
    values
      (v_req_id, p_bidder_id, p_idempotency_key, p_auction_id, p_amount, 'rejected', v_code, to_jsonb(v_result), v_now)
    on conflict on constraint idempotency_unique do nothing;
    if not found then
      -- The same (bidder, key) was inserted concurrently by a request holding a DIFFERENT auction lock.
      -- ON CONFLICT DO NOTHING waited for that transaction to commit; re-select in a new statement
      -- (fresh Read Committed snapshot) and answer from the committed row.
      return bidlock._idempotency_conflict(p_bidder_id, p_idempotency_key, p_auction_id, p_amount, v_auction, v_now);
    end if;
    return v_result;
  end if;

  -- 6. Soft close.
  v_new_ends := v_auction.ends_at;
  if v_auction.snipe_window_s > 0
     and v_now >= v_auction.ends_at - make_interval(secs => v_auction.snipe_window_s)
     and v_auction.extension_count < v_auction.max_extensions then
    v_new_ends := greatest(v_auction.ends_at, v_now + make_interval(secs => v_auction.extend_by_s));
    v_extended := v_new_ends > v_auction.ends_at;
  end if;
  v_bid_no := v_auction.bid_count + 1;

  -- 7. Build the result for the post-bid state (stored for replays).
  v_result := bidlock._bid_result(v_auction, 'accepted', null, v_now);
  v_result.bid_id           := v_bid_id;
  v_result.bid_no           := v_bid_no;
  v_result.amount           := p_amount;
  v_result.placed_at        := v_now;
  v_result.status           := 'live';
  v_result.current_price    := p_amount;
  v_result.leader_bidder_id := p_bidder_id;
  v_result.min_next_bid     := bidlock.min_next_bid(v_auction.starting_price, p_amount);
  v_result.max_bid          := bidlock.max_bid(v_auction.starting_price, p_amount);
  v_result.ends_at          := v_new_ends;
  v_result.extended         := v_extended;
  v_result.extension_count  := v_auction.extension_count + case when v_extended then 1 else 0 end;
  v_result.version          := v_auction.version + 1;

  -- 8. Writes: request, bid, auction (version-guarded), extension, audit.
  insert into bidlock.bid_requests
    (id, bidder_id, idempotency_key, auction_id, amount, outcome, error_code, result, created_at)
  values
    (v_req_id, p_bidder_id, p_idempotency_key, p_auction_id, p_amount, 'accepted', null, to_jsonb(v_result), v_now)
  on conflict on constraint idempotency_unique do nothing;
  if not found then
    -- Nothing has been written by this call yet except lazy transitions, which may commit.
    return bidlock._idempotency_conflict(p_bidder_id, p_idempotency_key, p_auction_id, p_amount, v_auction, v_now);
  end if;

  insert into bidlock.bids
    (id, auction_id, bid_no, bidder_id, amount, prev_amount, min_required, placed_at, ends_at_before, ends_at_after, request_id)
  values
    (v_bid_id, p_auction_id, v_bid_no, p_bidder_id, p_amount, v_auction.current_price, v_min, v_now,
     v_auction.ends_at, v_new_ends, v_req_id);

  update bidlock.auctions
     set current_price    = p_amount,
         leader_bidder_id = p_bidder_id,
         last_bid_id      = v_bid_id,
         bid_count        = v_bid_no,
         ends_at          = v_new_ends,
         extension_count  = v_result.extension_count,
         version          = version + 1
   where id = p_auction_id
     and version = v_auction.version;          -- second guard (D-08)
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = 'BLK10',
      message = format('place_bid: version guard failed for auction %s at version %s', p_auction_id, v_auction.version);
  end if;

  if v_extended then
    insert into bidlock.auction_extensions (auction_id, n, bid_id, old_ends_at, new_ends_at, at)
    values (p_auction_id, v_result.extension_count, v_bid_id, v_auction.ends_at, v_new_ends, v_now);
  end if;

  perform bidlock._event(p_auction_id, 'bid_accepted', p_bidder_id,
    jsonb_build_object('bid_id', v_bid_id, 'bid_no', v_bid_no, 'amount', p_amount), v_now);
  if v_extended then
    perform bidlock._event(p_auction_id, 'auction_extended', p_bidder_id,
      jsonb_build_object('n', v_result.extension_count, 'old_ends_at', v_auction.ends_at, 'new_ends_at', v_new_ends), v_now);
  end if;

  return v_result;
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.place_bid(uuid, uuid, bigint, uuid) to bidlock_app;
