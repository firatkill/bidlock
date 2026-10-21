begin;
select no_plan();
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.bidder() as owner, bidlock_test.bidder() as stranger \gset
create temporary table first_box as select * from bidlock.create_sandbox(:'owner','sandbox-fixture',42);
select is((select outcome from first_box),'accepted','TC-106 sandbox accepted');
select is((select status from bidlock.auctions where id=(select auction_id from first_box)),'live','TC-106 sandbox status');
select is((select starting_price from bidlock.auctions where id=(select auction_id from first_box)),2000::bigint,'TC-106 sandbox starting_price');
select is((select ends_at-starts_at from bidlock.auctions where id=(select auction_id from first_box)),interval '2 minutes','TC-106 sandbox ends_at-starts_at');
select is((select array_agg(bot_persona order by bot_persona) from bidlock.bidders where sandbox_id=(select sandbox_id from first_box)),array['cautious','sniper','steady']::text[],'TC-106 three bot personas');
create temporary table duplicate_box as select * from bidlock.create_sandbox(:'owner','sandbox-fixture',99);
select is((select error_code from duplicate_box),'SANDBOX_EXISTS','TC-107 duplicate rejected');
select is((select sandbox_id from duplicate_box),(select sandbox_id from first_box),'TC-107 same sandbox_id');
select is((select auction_id from duplicate_box),(select auction_id from first_box),'TC-107 same auction_id');
select is((select bidlock.sandbox_bots(:'stranger',sandbox_id) from first_box),null::jsonb,'TC-111 bots hidden from non-owner');
select bidlock_test.bid(auction_id,:'owner',2000) from first_box;
select bidlock_test.set_now('2026-01-01 12:02:00+00');
select bidlock.auction_state(auction_id,:'owner') from first_box;
select bidlock.pay_offer(auction_id,:'owner') from first_box;
create temporary table replacement_box as select * from bidlock.create_sandbox(:'owner','sandbox-fixture',43);
select is((select outcome from replacement_box),'accepted','TC-108 new sandbox after settled');
select bidlock_test.set_now('2026-01-01 12:17:00+00');
select is((select bidlock.sandbox_bots(:'owner',sandbox_id) from replacement_box),null::jsonb,'TC-111 bots hidden after expiry');
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
update bidlock.settings set max_active_sandboxes=2;
select bidlock.create_sandbox(bidlock_test.bidder(),'cap-one',1);
select bidlock.create_sandbox(bidlock_test.bidder(),'cap-two',2);
create temporary table capacity as select * from bidlock.create_sandbox(bidlock_test.bidder(),'cap-three',3);
select is((select error_code from capacity),'SANDBOX_CAPACITY','TC-109 global capacity');
select bidlock_test.clean();
update bidlock.settings set max_active_sandboxes=50;
update bidlock.rate_limits set max_hits=5 where name='sandbox_ip_3600s';
create temporary table attempts(n integer,r bidlock.sandbox_result);
do $$ begin for i in 1..6 loop insert into attempts values(i,bidlock.create_sandbox(bidlock_test.bidder(),'shared-fixture',i)); end loop; end $$;
select is((select count(*) from attempts where (r).outcome='accepted'),5::bigint,'TC-110 first five sandbox creations');
select is((select (r).error_code from attempts where n=6),'RATE_LIMITED','TC-110 sixth sandbox creation limited');
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-30 23:00:00+00');
select bidlock_test.bidder() as old_owner \gset
select sandbox_id as old_sid,auction_id as old_aid from bidlock.create_sandbox(:'old_owner','old-box',1) \gset
select id as old_bot from bidlock.bidders where sandbox_id=:'old_sid' and bot_persona='steady' \gset
select bidlock_test.bid(:'old_aid',:'old_owner',2000);
select bidlock_test.set_now('2026-01-30 23:01:50+00');
select bidlock_test.bid(:'old_aid',:'old_bot',2100);
select bidlock_test.set_now('2026-01-30 23:02:20+00');
select bidlock.auction_state(:'old_aid',:'old_owner');
select bidlock_test.set_now('2026-01-30 23:05:20+00');
select * from bidlock.pay_offer(:'old_aid',:'old_bot');
select * from bidlock.pay_offer(:'old_aid',:'old_owner');
select bidlock_test.set_now('2026-02-01 00:00:00+00');
select sandbox_id as today_sid from bidlock.create_sandbox(bidlock_test.bidder(),'today-box',2) \gset
select bidlock_test.set_now('2026-01-20 12:00:00+00');
select bidlock_test.auction() as old_public \gset
update bidlock.auctions set kind='public' where id=:'old_public';
select bidlock_test.set_now('2026-01-20 12:05:00+00');
select bidlock.auction_state(:'old_public',null);
select bidlock_test.bidder() as idle, bidlock_test.bidder() as referenced \gset
update bidlock.bidders set created_at='2025-12-01 00:00:00+00' where id in (:'idle',:'referenced');
select bidlock_test.set_now('2026-02-01 11:00:00+00');
select bidlock_test.auction() as reference_aid \gset
select bidlock_test.bid(:'reference_aid',:'referenced',1000);
select bidlock_test.set_now('2026-02-01 12:00:00+00');
select bidlock.cleanup_expired();
select is((select count(*) from bidlock.sandboxes where id=:'old_sid'),0::bigint,'TC-112 cleanup sandboxes');
select is((select count(*) from bidlock.auctions where id=:'old_aid'),0::bigint,'TC-112 cleanup auctions');
select is((select count(*) from bidlock.bidders where sandbox_id=:'old_sid'),0::bigint,'TC-112 cleanup bidders');
select is((select count(*) from bidlock.bids where auction_id=:'old_aid'),0::bigint,'TC-112 cleanup bids');
select is((select count(*) from bidlock.bid_requests where auction_id=:'old_aid'),0::bigint,'TC-112 cleanup bid_requests');
select is((select count(*) from bidlock.offers where auction_id=:'old_aid'),0::bigint,'TC-112 cleanup offers');
select is((select count(*) from bidlock.auction_extensions where auction_id=:'old_aid'),0::bigint,'TC-112 cleanup auction_extensions');
select is((select count(*) from bidlock.payment_strikes where auction_id=:'old_aid'),0::bigint,'TC-112 cleanup payment_strikes');
select is((select count(*) from bidlock.auction_events where auction_id=:'old_aid'),0::bigint,'TC-112 cleanup auction_events');
select is((select count(*) from bidlock.auctions where id=:'old_public'),0::bigint,'TC-112 cleanup auctions');
select is((select count(*) from bidlock.bidders where id=:'idle'),0::bigint,'TC-112 cleanup bidders');
select is((select count(*) from bidlock.sandboxes where id=:'today_sid'),1::bigint,'TC-112 keeps today expired sandbox');
select is((select count(*) from bidlock.bidders where id=:'referenced'),1::bigint,'TC-112 keeps referenced old bidder');
select * from finish();
rollback;
