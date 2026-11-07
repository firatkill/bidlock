begin;
select no_plan();
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');

-- Legacy sequencing is the oracle; rollback its writes before invoking the new path.
create function pg_temp.legacy_submit(s uuid,b uuid,a uuid,m bigint,k uuid,ip text)
returns jsonb language plpgsql security definer set search_path=bidlock,pg_temp as $$
declare r integer; v bidlock.bid_result;
begin
  if bidlock.get_me(s) is null then
    return jsonb_build_object('kind','error','error_code',case when b is null then 'NO_SESSION' else 'BOT_TOKEN_INVALID' end,'retry_after_ms',null);
  end if;
  r := bidlock.check_bid_rate(coalesce(b,s),ip);
  if r>0 then return jsonb_build_object('kind','error','error_code','RATE_LIMITED','retry_after_ms',r); end if;
  select * into v from bidlock.place_bid(a,coalesce(b,s),m,k);
  return jsonb_build_object('kind','bid','result',to_jsonb(v));
end $$;
create function pg_temp.compare_paths(s uuid,b uuid,a uuid,m bigint,k uuid,expected text)
returns table(test_name text,actual jsonb,wanted jsonb) language plpgsql security definer set search_path=bidlock,pg_temp as $$
declare old_result jsonb; new_result jsonb; old_rates jsonb; new_rates jsonb;
begin
  begin
    old_result := pg_temp.legacy_submit(s,b,a,m,k,'parity-hash');
    select coalesce(jsonb_agg(to_jsonb(r) order by bucket,window_start),'[]') into old_rates from bidlock.rate_counters r;
    raise exception using errcode='P0002';
  exception when no_data_found then null;
  end;
  new_result := bidlock.submit_bid(s,b,a,m,k,'parity-hash');
  select coalesce(jsonb_agg(to_jsonb(r) order by bucket,window_start),'[]') into new_rates from bidlock.rate_counters r;
  return query select 'TC-278 exact result parity: '||expected,new_result #- '{result,bid_id}', old_result #- '{result,bid_id}';
  return query select 'TC-278 rate counter parity: '||expected,new_rates,old_rates;
  return query select 'TC-278 expected code: '||expected,to_jsonb(coalesce(new_result->>'error_code',new_result#>>'{result,error_code}',new_result#>>'{result,outcome}')),to_jsonb(expected);
end $$;

create temporary table f as select bidlock_test.bidder('Owner') s, bidlock_test.bidder('Other') other,
  bidlock_test.auction() a, gen_random_uuid() k, gen_random_uuid() rejected_key;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(null,null,a,1000,gen_random_uuid(),'NO_SESSION') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(gen_random_uuid(),null,a,1000,gen_random_uuid(),'NO_SESSION') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(gen_random_uuid(),other,a,1000,gen_random_uuid(),'BOT_TOKEN_INVALID') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1000,k,'accepted') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1000,k,'accepted') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1100,k,'IDEMPOTENCY_MISMATCH') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1100,gen_random_uuid(),'ALREADY_LEADING') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(other,null,a,1000,rejected_key,'BID_TOO_LOW') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(other,null,a,1000,rejected_key,'BID_TOO_LOW') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(other,null,a,100000000,gen_random_uuid(),'BID_TOO_HIGH') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(other,null,a,0,gen_random_uuid(),'VALIDATION') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,gen_random_uuid(),1000,gen_random_uuid(),'NOT_FOUND') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,gen_random_uuid(),a,1000,gen_random_uuid(),'NOT_FOUND') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,bidlock_test.auction(starts_offset_s=>60),1000,gen_random_uuid(),'AUCTION_NOT_LIVE') t;

select is((select count(*)::integer from bidlock.bids where auction_id=f.a),1,'TC-278 replay adds no second bid') from f;
truncate bidlock.rate_counters;
update bidlock.settings set bidding_paused=true;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1100,gen_random_uuid(),'BIDDING_PAUSED') t;
update bidlock.settings set bidding_paused=false;
create temporary table ended as select bidlock_test.auction(duration_s=>5) a;
select bidlock_test.set_now('2026-01-01 12:00:10+00');
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f,ended cross join lateral pg_temp.compare_paths((select s from f),null,ended.a,1000,gen_random_uuid(),'AUCTION_CLOSED') t;
truncate bidlock.rate_counters;
-- A rate-limited replay still fails before idempotency and commits the hit.
insert into bidlock.rate_counters select 'bid_bidder_1s:'||s,bidlock.bidlock_now(),3 from f;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1000,k,'RATE_LIMITED') t;
select is((select hits from bidlock.rate_counters where bucket='bid_bidder_1s:'||s),4,'TC-278 rate-limit rejection counts hit') from f;
truncate bidlock.rate_counters;
create temporary table sandbox as select (bidlock_test.sandbox(s)).* from f;
select public.is(t.actual,t.wanted,t.test_name) from f,sandbox cross join lateral pg_temp.compare_paths((select other from f),null,sandbox.auction_id,1000,gen_random_uuid(),'NOT_FOUND') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f,sandbox cross join lateral pg_temp.compare_paths((select s from f),(select id from bidlock.bidders where is_bot and sandbox_id=sandbox.sandbox_id limit 1),sandbox.auction_id,(select starting_price from bidlock.auctions where id=sandbox.auction_id),gen_random_uuid(),'accepted') t;
truncate bidlock.rate_counters;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths((select id from bidlock.bidders where is_bot limit 1),null,a,1000,gen_random_uuid(),'NO_SESSION') t;
truncate bidlock.rate_counters;
insert into bidlock.rate_counters select 'bid_bidder_60s:'||s,date_trunc('minute',bidlock.bidlock_now()),60 from f;
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1000,k,'RATE_LIMITED') t;
truncate bidlock.rate_counters;
insert into bidlock.rate_counters select 'bid_ip_60s:parity-hash',date_trunc('minute',bidlock.bidlock_now()),max_hits from bidlock.rate_limits where name='bid_ip_60s';
select public.is(t.actual,t.wanted,t.test_name) from f cross join lateral pg_temp.compare_paths(s,null,a,1000,k,'RATE_LIMITED') t;
truncate bidlock.rate_counters;
insert into bidlock.rate_counters select 'bid_bot_2s:'||id,bidlock.bidlock_now(),1 from bidlock.bidders where is_bot;
select public.is(t.actual,t.wanted,t.test_name) from f,sandbox cross join lateral pg_temp.compare_paths((select s from f),(select id from bidlock.bidders where is_bot and sandbox_id=sandbox.sandbox_id limit 1),sandbox.auction_id,1000,gen_random_uuid(),'RATE_LIMITED') t;
select ok(has_function_privilege('bidlock_app','bidlock.submit_bid(uuid,uuid,uuid,bigint,uuid,text)','execute'),'TC-278 app can submit');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) acl where p.oid='bidlock.submit_bid(uuid,uuid,uuid,bigint,uuid,text)'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE'),'TC-278 no PUBLIC execute');
select ok((select prosecdef and proconfig @> array['search_path=bidlock, pg_temp'] from pg_proc where oid='bidlock.submit_bid(uuid,uuid,uuid,bigint,uuid,text)'::regprocedure),'TC-278 definer search path fixed');
select * from finish();
rollback;
