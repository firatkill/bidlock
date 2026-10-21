begin;
select plan(5);
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() as aid, bidlock_test.bidder() as bidder \gset
create temporary table first_bid as select * from bidlock_test.bid(:'aid', :'bidder', 1000);
select is((select outcome from first_bid), 'accepted', 'TC-034 DB-04 first bid accepted');
select is((select bid_no from first_bid), 1, 'TC-034 DB-04 first bid number');
select is((select version from first_bid), 2::bigint, 'TC-034 DB-04 version increments');
select is((select leader_bidder_id from bidlock.auctions where id = :'aid'), :'bidder'::uuid, 'TC-034 DB-04 leader stored');
select is((select replayed from first_bid), false, 'TC-034 DB-04 first invocation is not a replay (D-48)');
select * from finish();
rollback;
