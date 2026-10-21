create or replace function bidlock._publish_auction()
returns trigger
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_bid     jsonb;
  v_leader  jsonb;
  v_payload jsonb;
begin
  if (select s.realtime_mode from bidlock.settings s) <> 'broadcast' then
    return null;
  end if;

  if new.last_bid_id is not null and new.last_bid_id is distinct from old.last_bid_id then
    select jsonb_build_object('id', b.id, 'bid_no', b.bid_no, 'bidder_id', b.bidder_id,
                              'display_name', d.display_name, 'is_bot', d.is_bot, 'amount', b.amount,
                              'placed_at', b.placed_at, 'extended', b.ends_at_after > b.ends_at_before)
      into v_bid
      from bidlock.bids b join bidlock.bidders d on d.id = b.bidder_id
     where b.id = new.last_bid_id;
  end if;

  select jsonb_build_object('id', d.id, 'display_name', d.display_name, 'is_bot', d.is_bot)
    into v_leader from bidlock.bidders d where d.id = new.leader_bidder_id;

  v_payload := jsonb_build_object(
    'v', 1, 'auction_id', new.id, 'version', new.version,
    'status', new.status, 'payment_state', new.payment_state,
    'current_price', new.current_price, 'leader', v_leader, 'bid_count', new.bid_count,
    'ends_at', new.ends_at, 'extension_count', new.extension_count,
    'bid', v_bid, 'sent_at', bidlock.bidlock_now());

  -- Inner block: only this part runs in a subtransaction (the EXCEPTION clause of a block starts
  -- the subtransaction when the block is entered, so the outer function body must not have one).
  begin
    -- Supabase: realtime.send(payload jsonb, event text, topic text, private boolean). Verify per A-01.
    -- private = false targets public channels (D-19); the A-01 fallback switches this to true.
    perform realtime.send(v_payload, 'auction_changed', 'auction:' || new.id::text, false);
  exception when others then
    -- Never fail a bid because Realtime is unavailable; clients reconcile by polling.
    raise warning 'bidlock realtime publish failed: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

create trigger auctions_publish
  after update on bidlock.auctions
  for each row
  when (old.version is distinct from new.version)
  execute function bidlock._publish_auction();

revoke execute on all functions in schema bidlock from public;
