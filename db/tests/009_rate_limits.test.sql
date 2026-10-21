begin;
select no_plan();
select bidlock_test.clean();
update bidlock.rate_limits set max_hits = case name when 'bid_bidder_1s' then 3 when 'bid_bidder_60s' then 60 when 'bid_bot_2s' then 1 when 'bid_ip_60s' then 200 when 'sandbox_ip_3600s' then 5 when 'bidder_create_ip_3600s' then 20 end;
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.bidder() as human, bidlock_test.bidder() as other_human \gset
select is(bidlock.check_bid_rate(:'human','burst-fixture'),0,'TC-085 human first burst hit');
select is(bidlock.check_bid_rate(:'human','burst-fixture'),0,'TC-085 human second burst hit');
select is(bidlock.check_bid_rate(:'human','burst-fixture'),0,'TC-085 human third burst hit');
select ok(bidlock.check_bid_rate(:'human','burst-fixture') between 1 and 1000,'TC-085 fourth burst limited');
select is(bidlock.check_bid_rate(:'other_human','burst-fixture'),0,'TC-093 another subject unaffected');
select bidlock_test.set_now('2026-01-01 12:00:01+00');
select is(bidlock.check_bid_rate(:'human','burst-fixture'),0,'TC-086 next second resets burst');
create temporary table sustained (n integer, retry integer);
create temporary table sustained_bidder as select bidlock_test.bidder() as id;
do $$
declare i integer; j integer;
begin
  for i in 0..19 loop
    perform bidlock_test.set_now('2026-01-01 12:00:00+00'::timestamptz + make_interval(secs=>i));
    for j in 1..3 loop
      insert into sustained values (i*3+j,bidlock.check_bid_rate((select id from sustained_bidder),'sustained-fixture'));
    end loop;
  end loop;
end $$;
select is((select count(*) from sustained where retry=0),60::bigint,'TC-087 first sixty within minute allowed');
select bidlock_test.set_now('2026-01-01 12:00:20+00');
select ok(bidlock.check_bid_rate((select id from sustained_bidder),'sustained-fixture')>0,'TC-087 sixty-first minute hit limited');
insert into bidlock.sandboxes(owner_id,bot_seed,created_at,expires_at) values (:'human',1,bidlock.bidlock_now(),bidlock.bidlock_now()+interval '15 minutes') returning id as sid \gset
insert into bidlock.bidders(display_name,is_bot,bot_persona,sandbox_id) values ('Rate bot',true,'steady',:'sid') returning id as bot \gset
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select is(bidlock.check_bid_rate(:'bot','bot-fixture'),0,'TC-088 first bot hit');
select ok(bidlock.check_bid_rate(:'bot','bot-fixture')>0,'TC-088 second bot hit limited');
select bidlock_test.set_now('2026-01-01 12:00:02+00');
select is(bidlock.check_bid_rate(:'bot','bot-fixture'),0,'TC-088 bot allowed after two seconds');
create temporary table ip_hits as select n,bidlock.rate_hit('bid_ip_60s','ip-fixture','2026-01-01 12:00:59.250+00') as retry from generate_series(1,201) n;
select is((select count(*) from ip_hits where retry=0),200::bigint,'TC-089 two hundred IP hits allowed');
select ok((select retry from ip_hits where n=201)>0,'TC-089 201st IP hit limited');
select is((select retry from ip_hits where n=201),750,'TC-090 exact milliseconds to window end');
select throws_ok($$select bidlock.rate_hit('missing','fixture',bidlock.bidlock_now())$$,'BLK20','unknown rate limit missing','TC-091 unknown limit rejected');
select * from finish();
rollback;
