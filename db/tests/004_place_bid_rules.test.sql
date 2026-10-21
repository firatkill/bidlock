begin;
select no_plan();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() as aid, bidlock_test.bidder() as b1, bidlock_test.bidder() as b2 \gset
create temporary table low as select * from bidlock_test.bid( :'aid', :'b1', 999);
select is((select error_code from low), 'BID_TOO_LOW', 'TC-033 low error_code');
select is((select min_next_bid from low), 1000::bigint, 'TC-033 low min_next_bid');
create temporary table first_bid as select * from bidlock_test.bid( :'aid', :'b1', 1000);
select is((select outcome from first_bid), 'accepted', 'TC-034 first_bid outcome');
select is((select bid_no from first_bid), 1, 'TC-034 first_bid bid_no');
select is((select version from first_bid), 2::bigint, 'TC-034 first_bid version');
select is((select leader_bidder_id from first_bid), :'b1'::uuid, 'TC-034 first_bid leader_bidder_id');
select is((select replayed from first_bid), false, 'TC-034 first_bid replayed');
create temporary table same_leader as select * from bidlock_test.bid( :'aid', :'b1', 1100);
select is((select error_code from same_leader), 'ALREADY_LEADING', 'TC-035 same_leader error_code');
create temporary table low_next as select * from bidlock_test.bid( :'aid', :'b2', 1099);
select is((select error_code from low_next), 'BID_TOO_LOW', 'TC-036 low_next error_code');
create temporary table next_bid as select * from bidlock_test.bid( :'aid', :'b2', 1100);
select is((select outcome from next_bid), 'accepted', 'TC-037 next_bid outcome');
select is((select min_next_bid from first_bid), 1100::bigint, 'TC-039 first_bid min_next_bid');
select bidlock_test.auction(starting_price => 990) as band_aid \gset
create temporary table band_first as select * from bidlock_test.bid(:'band_aid', :'b1', 990);
select is((select min_next_bid from band_first), 1040::bigint, 'TC-038 band_first min_next_bid');
create temporary table band_low as select * from bidlock_test.bid(:'band_aid', :'b2', 1039);
select is((select error_code from band_low), 'BID_TOO_LOW', 'TC-038 band_low error_code');
create temporary table band_next as select * from bidlock_test.bid(:'band_aid', :'b2', 1040);
select is((select outcome from band_next), 'accepted', 'TC-038 band_next outcome');
select bidlock_test.auction() as cap_aid \gset
create temporary table too_high as select * from bidlock_test.bid(:'cap_aid', :'b1', 11001);
select is((select error_code from too_high), 'BID_TOO_HIGH', 'TC-040 too_high error_code');
create temporary table at_cap as select * from bidlock_test.bid(:'cap_aid', :'b1', 11000);
select is((select outcome from at_cap), 'accepted', 'TC-040 at_cap outcome');
select gen_random_uuid() as invalid_key, gen_random_uuid() as missing_key \gset
create temporary table zero as select * from bidlock_test.bid( :'aid', :'b1', 0, :'invalid_key');
select is((select error_code from zero), 'VALIDATION', 'TC-041 zero error_code');
create temporary table missing_bidder as select * from bidlock_test.bid( :'aid', gen_random_uuid(), 1000, :'missing_key');
select is((select error_code from missing_bidder), 'NOT_FOUND', 'TC-045 missing_bidder error_code');
create temporary table missing_auction as select * from bidlock_test.bid(gen_random_uuid(), :'b1', 1000);
select is((select error_code from missing_auction), 'NOT_FOUND', 'TC-045 missing_auction error_code');
select is((select count(*) from bidlock.bid_requests where idempotency_key in (:'invalid_key', :'missing_key')), 0::bigint, 'TC-049 no request for validation or missing bidder');
select is((select count(*) from bidlock.bid_requests where auction_id = :'aid' and outcome = 'rejected'), 3::bigint, 'TC-049 rule rejections stored');
select bidlock_test.auction(starts_offset_s => 60) as scheduled_aid \gset
create temporary table scheduled as select * from bidlock_test.bid(:'scheduled_aid', :'b1', 1000);
select is((select error_code from scheduled), 'AUCTION_NOT_LIVE', 'TC-042 scheduled error_code');
select bidlock_test.set_now('2026-01-01 12:01:01+00');
create temporary table lazy_start as select * from bidlock_test.bid(:'scheduled_aid', :'b1', 1000);
select is((select outcome from lazy_start), 'accepted', 'TC-043 lazy_start outcome');
select is((select status from lazy_start), 'live', 'TC-043 lazy_start status');
select bidlock_test.set_now('2026-01-01 12:05:00+00');
create temporary table at_end as select * from bidlock_test.bid( :'aid', :'b1', 1200);
select is((select error_code from at_end), 'AUCTION_CLOSED', 'TC-044 at_end error_code');
select is((select status from at_end), 'closed', 'TC-044 at_end status');
select bidlock_test.set_now('2026-01-01 12:00:00+00');
insert into bidlock.sandboxes(owner_id, bot_seed, created_at, expires_at) values (:'b1', 1, bidlock.bidlock_now(), bidlock.bidlock_now()+interval '1 day') returning id as sid \gset
insert into bidlock.sandboxes(owner_id, bot_seed, created_at, expires_at) values (:'b2', 2, bidlock.bidlock_now(), bidlock.bidlock_now()+interval '1 day') returning id as sid2 \gset
insert into bidlock.bidders(display_name, is_bot, bot_persona, sandbox_id) values ('Own bot', true, 'steady', :'sid') returning id as bot \gset
insert into bidlock.bidders(display_name, is_bot, bot_persona, sandbox_id) values ('Other bot', true, 'steady', :'sid2') returning id as otherbot \gset
select bidlock_test.auction() as sandbox_aid \gset
update bidlock.auctions set kind='sandbox', sandbox_id=:'sid' where id=:'sandbox_aid';
create temporary table stranger as select * from bidlock_test.bid(:'sandbox_aid', :'b2', 1000);
select is((select error_code from stranger), 'NOT_FOUND', 'TC-046 stranger error_code');
create temporary table owner as select * from bidlock_test.bid(:'sandbox_aid', :'b1', 1000);
select is((select outcome from owner), 'accepted', 'TC-046 owner outcome');
create temporary table own_bot as select * from bidlock_test.bid(:'sandbox_aid', :'bot', 1100);
select is((select outcome from own_bot), 'accepted', 'TC-046 own_bot outcome');
create temporary table other_bot as select * from bidlock_test.bid(:'sandbox_aid', :'otherbot', 1200);
select is((select error_code from other_bot), 'NOT_FOUND', 'TC-046 other_bot error_code');
create temporary table bot_test as select * from bidlock_test.bid(:'cap_aid', :'bot', 12000);
select is((select error_code from bot_test), 'NOT_FOUND', 'TC-046 bot_test error_code');
select gen_random_uuid() as paused_key \gset
update bidlock.settings set bidding_paused=true;
create temporary table paused as select * from bidlock_test.bid(:'cap_aid', :'b2', 12000, :'paused_key');
select is((select error_code from paused), 'BIDDING_PAUSED', 'TC-047 paused error_code');
select is((select count(*) from bidlock.bid_requests where idempotency_key=:'paused_key'), 0::bigint, 'TC-047 paused does not store request');
select is((select prev_amount from bidlock.bids where id=(select bid_id from first_bid)), null::bigint, 'TC-048 first previous amount');
select is((select prev_amount from bidlock.bids where id=(select bid_id from next_bid)), 1000::bigint, 'TC-048 next previous amount');
select is((select min_required from bidlock.bids where id=(select bid_id from next_bid)), 1100::bigint, 'TC-048 minimum persisted');
select is((select ends_at_before = ends_at_after from bidlock.bids where id=(select bid_id from next_bid)), true, 'TC-048 normal bid end timestamps');
select * from finish();
rollback;
