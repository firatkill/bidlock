begin;
select no_plan();
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction(snipe => 0) as aid, bidlock_test.bidder() as b1, bidlock_test.bidder() as b2 \gset
select bidlock_test.bid(:'aid', :'b1', 1000);
select bidlock_test.set_now('2026-01-01 12:05:10+00');
create temporary table late_bid as select * from bidlock_test.bid(:'aid', :'b2', 1100);
select is((select error_code from late_bid), 'AUCTION_CLOSED', 'TC-065 lazy close rejects bid');
select is((select status from bidlock.auctions where id=:'aid'), 'closed', 'TC-065 closed status');
select is((select rank from bidlock.offers where auction_id=:'aid'), 1::smallint, 'TC-065 winner offer');
select is((select closed_at from bidlock.auctions where id=:'aid'), '2026-01-01 12:05:00+00'::timestamptz, 'TC-065 logical close time');
select bidlock_test.auction(duration_s => 10) as empty_id \gset
select bidlock_test.set_now('2026-01-01 12:05:21+00');
select bidlock.advance_auction_locked(a,bidlock.bidlock_now()) from bidlock.auctions a where id=:'empty_id';
select is((select status from bidlock.auctions where id=:'empty_id'), 'unsold', 'TC-067 no bids unsold');
select is((select payment_state from bidlock.auctions where id=:'empty_id'), null, 'TC-067 no payment');
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() from generate_series(1,3);
select bidlock_test.auction(duration_s => 3600) as future_id \gset
select bidlock_test.set_now('2026-01-01 12:05:00+00');
select is(bidlock.close_due_auctions(), 3, 'TC-068 closes three due auctions');
select is(bidlock.close_due_auctions(), 0, 'TC-068 second close is no-op');
select is((select status from bidlock.auctions where id=:'future_id'), 'live', 'TC-069 future untouched');
select bidlock_test.auction(starts_offset_s => 60) as scheduled_id \gset
select bidlock_test.set_now('2026-01-01 12:06:00+00');
select bidlock.close_due_auctions();
select is((select status from bidlock.auctions where id=:'scheduled_id'), 'live', 'TC-070 starts due scheduled auction');
select bidlock_test.auction(duration_s => 10, starts_offset_s => 10) as overdue_id \gset
select bidlock_test.set_now('2026-01-01 12:06:21+00');
select bidlock.close_due_auctions();
select is((select status from bidlock.auctions where id=:'overdue_id'), 'unsold', 'TC-071 starts and closes overdue scheduled auction');
create temporary table tick_result as select bidlock.tick() as result;
select is((select jsonb_typeof(result->'closed_or_started') from tick_result), 'number', 'TC-072 tick close count');
select is((select jsonb_typeof(result->'offers_expired') from tick_result), 'number', 'TC-072 tick expiry count');
select ok((select exists(select 1 from bidlock.auctions where id=(result->>'public_auction_id')::uuid) from tick_result), 'TC-072 tick public id exists');
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
create temporary table failing_auction as select bidlock_test.auction() as id;
select bidlock_test.auction() as good_id \gset
create function pg_temp.fail_one() returns trigger language plpgsql security definer set search_path=bidlock,pg_temp as $$
begin
  if new.id=(select id from pg_temp.failing_auction) then raise exception 'deliberate D-28 fixture failure'; end if;
  return new;
end $$;
create trigger test_fail_one before update on bidlock.auctions for each row execute function pg_temp.fail_one();
select bidlock_test.set_now('2026-01-01 12:05:00+00');
select is(bidlock.close_due_auctions(), 1, 'TC-073 batch continues after one failure');
select is((select status from bidlock.auctions where id=:'good_id'), 'unsold', 'TC-073 healthy auction advanced');
select is((select status from bidlock.auctions where id=(select id from failing_auction)), 'live', 'TC-073 failed auction rolled back');
drop trigger test_fail_one on bidlock.auctions;
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction(snipe => 0) as read_id, bidlock_test.bidder() as reader \gset
select bidlock_test.bid(:'read_id',:'reader',1000);
select bidlock_test.set_now('2026-01-01 12:05:01+00');
select is(bidlock.auction_state(:'read_id',:'reader')->>'status','closed','TC-066 state read closes due auction');
select is((select rank from bidlock.offers where auction_id=:'read_id'),1::smallint,'TC-066 state read creates winner offer');
select * from finish();
rollback;
