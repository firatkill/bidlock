begin;
select no_plan();
select bidlock_test.bidder() as b1, bidlock_test.bidder() as b2 \gset
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() as early_id \gset
select bidlock_test.set_now('2026-01-01 12:04:49+00');
create temporary table early as select * from bidlock_test.bid(:'early_id', :'b1', 1000);
select is((select extended from early), false, 'TC-057 early extended');
select is((select ends_at from early), '2026-01-01 12:05:00+00'::timestamptz, 'TC-057 early end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from early)), (select ends_at from early), 'TC-064 stored end matches result');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from early)), 'TC-063 ends never decrease');
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() as boundary_id \gset
select bidlock_test.set_now('2026-01-01 12:04:50+00');
create temporary table boundary as select * from bidlock_test.bid(:'boundary_id', :'b1', 1000);
select is((select extended from boundary), true, 'TC-058 boundary extended');
select is((select ends_at from boundary), '2026-01-01 12:05:20+00'::timestamptz, 'TC-058 boundary end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from boundary)), (select ends_at from boundary), 'TC-064 stored end matches result');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from boundary)), 'TC-063 ends never decrease');
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() as last_ms_id \gset
select bidlock_test.set_now('2026-01-01 12:04:59.999+00');
create temporary table last_ms as select * from bidlock_test.bid(:'last_ms_id', :'b1', 1000);
select is((select extended from last_ms), true, 'TC-059 last_ms extended');
select is((select ends_at from last_ms), '2026-01-01 12:05:29.999+00'::timestamptz, 'TC-059 last_ms end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from last_ms)), (select ends_at from last_ms), 'TC-064 stored end matches result');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from last_ms)), 'TC-063 ends never decrease');
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction(snipe => 5, extend => 20) as custom_id \gset
select bidlock_test.set_now('2026-01-01 12:04:55+00');
create temporary table custom as select * from bidlock_test.bid(:'custom_id', :'b1', 1000);
select is((select extended from custom), true, 'TC-060 custom extended');
select is((select ends_at from custom), '2026-01-01 12:05:15+00'::timestamptz, 'TC-060 custom end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from custom)), (select ends_at from custom), 'TC-064 stored end matches result');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from custom)), 'TC-063 ends never decrease');
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction(snipe => 0) as disabled_id \gset
select bidlock_test.set_now('2026-01-01 12:04:59+00');
create temporary table disabled as select * from bidlock_test.bid(:'disabled_id', :'b1', 1000);
select is((select extended from disabled), false, 'TC-061 disabled extended');
select is((select ends_at from disabled), '2026-01-01 12:05:00+00'::timestamptz, 'TC-061 disabled end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from disabled)), (select ends_at from disabled), 'TC-064 stored end matches result');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from disabled)), 'TC-063 ends never decrease');
select is((select n from bidlock.auction_extensions where auction_id=:'boundary_id'), 1, 'TC-058 extension row numbered one');
select is((select count(*) from bidlock.auction_events where auction_id=:'boundary_id' and type='auction_extended'), 1::bigint, 'TC-058 extension audit event');
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction(cap => 3) as cap_id \gset
select bidlock_test.set_now('2026-01-01 12:04:50+00');
create temporary table cap_0 as select * from bidlock_test.bid(:'cap_id', :'b1', 1000);
select is((select outcome from cap_0), 'accepted', 'TC-062 cap bid 1 accepted');
select is((select extended from cap_0), true, 'TC-062 extension cap at bid 1');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from cap_0)), 'TC-063 cap never shortens end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from cap_0)), (select ends_at from cap_0), 'TC-064 cap stored end');
select bidlock_test.set_now('2026-01-01 12:05:10+00');
create temporary table cap_1 as select * from bidlock_test.bid(:'cap_id', :'b2', 1100);
select is((select outcome from cap_1), 'accepted', 'TC-062 cap bid 2 accepted');
select is((select extended from cap_1), true, 'TC-062 extension cap at bid 2');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from cap_1)), 'TC-063 cap never shortens end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from cap_1)), (select ends_at from cap_1), 'TC-064 cap stored end');
select bidlock_test.set_now('2026-01-01 12:05:30+00');
create temporary table cap_2 as select * from bidlock_test.bid(:'cap_id', :'b1', 1200);
select is((select outcome from cap_2), 'accepted', 'TC-062 cap bid 3 accepted');
select is((select extended from cap_2), true, 'TC-062 extension cap at bid 3');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from cap_2)), 'TC-063 cap never shortens end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from cap_2)), (select ends_at from cap_2), 'TC-064 cap stored end');
select bidlock_test.set_now('2026-01-01 12:05:50+00');
create temporary table cap_3 as select * from bidlock_test.bid(:'cap_id', :'b2', 1300);
select is((select outcome from cap_3), 'accepted', 'TC-062 cap bid 4 accepted');
select is((select extended from cap_3), false, 'TC-062 extension cap at bid 4');
select ok((select ends_at_after >= ends_at_before from bidlock.bids where id=(select bid_id from cap_3)), 'TC-063 cap never shortens end');
select is((select ends_at_after from bidlock.bids where id=(select bid_id from cap_3)), (select ends_at from cap_3), 'TC-064 cap stored end');
select is((select extension_count from bidlock.auctions where id=:'cap_id'), 3, 'TC-062 only three extensions');
select is((select ends_at from cap_3), (select ends_at from cap_2), 'TC-062 fourth late bid leaves end unchanged');
select * from finish();
rollback;
