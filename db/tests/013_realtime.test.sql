begin;
select no_plan();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
create schema realtime;
create temporary table broadcasts(payload jsonb,event text,topic text,private boolean);
create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql security definer set search_path=bidlock,pg_temp as $$
  insert into pg_temp.broadcasts values(payload,event,topic,private);
$$;
select has_function('realtime','send',array['jsonb','text','text','boolean'],'TC-113 realtime stub installed');
select bidlock_test.auction(snipe => 0) as aid,bidlock_test.bidder() as b1,bidlock_test.bidder() as b2 \gset
update bidlock.settings set realtime_mode='broadcast';
select bidlock_test.bid(:'aid',:'b1',1000);
select is((select count(*) from broadcasts),1::bigint,'TC-114 one message per accepted bid');
select is((select topic from broadcasts),'auction:'||:'aid','TC-114 auction topic');
select is((select event from broadcasts),'auction_changed','TC-114 event name');
select is((select private from broadcasts),false,'TC-114 public broadcast');
select is((select (payload->>'version')::bigint from broadcasts),2::bigint,'TC-114 payload version');
select is((select (payload->'bid'->>'bid_no')::integer from broadcasts),1,'TC-114 payload bid number');
select bidlock_test.bid(:'aid',:'b2',999);
select is((select count(*) from broadcasts),1::bigint,'TC-116 rejection has no broadcast');
select bidlock_test.set_now('2026-01-01 12:05:00+00');
select bidlock.auction_state(:'aid',:'b1');
select is((select count(*) from broadcasts),2::bigint,'TC-115 close has one broadcast');
select * from bidlock.pay_offer(:'aid',:'b1');
select is((select count(*) from broadcasts),3::bigint,'TC-115 payment has one broadcast');
create or replace function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language plpgsql security definer set search_path=bidlock,pg_temp as $$ begin raise exception 'deliberate realtime outage'; end $$;
select bidlock_test.auction() as outage_id \gset
create temporary table outage as select * from bidlock_test.bid(:'outage_id',:'b1',1000);
select is((select outcome from outage),'accepted','TC-117 realtime outage cannot reject bid');
update bidlock.settings set realtime_mode='none';
create or replace function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql security definer set search_path=bidlock,pg_temp as $$ insert into pg_temp.broadcasts values(payload,event,topic,private); $$;
select bidlock_test.bid(:'outage_id',:'b2',1100);
select is((select count(*) from broadcasts),3::bigint,'TC-118 none mode sends no messages');
select * from finish();
rollback;
