create schema if not exists bidlock_test;
create or replace function bidlock_test.set_now(ts timestamptz)
returns text language sql security definer set search_path = bidlock, pg_temp
as $$ select set_config('bidlock.now_override', ts::text, true) $$;
revoke execute on all functions in schema bidlock_test from public;

create or replace function bidlock_test.bidder(name text default null)
returns uuid language sql security definer set search_path = bidlock, pg_temp as $$
  insert into bidlock.bidders (display_name)
  values (coalesce(name, 'Bidder ' || left(gen_random_uuid()::text, 8))) returning id;
$$;
create or replace function bidlock_test.auction(
  duration_s int default 300, starting_price bigint default 1000,
  starts_offset_s int default 0, snipe int default 10, extend int default 30,
  cap int default 20, pay_window int default 180
) returns uuid language sql security definer set search_path = bidlock, pg_temp as $$
  insert into bidlock.auctions (kind, title, status, starting_price, starts_at, ends_at,
    original_ends_at, snipe_window_s, extend_by_s, max_extensions, payment_window_s)
  values ('test', 'Test auction', case when starts_offset_s > 0 then 'scheduled' else 'live' end,
    starting_price, bidlock.bidlock_now() + make_interval(secs => starts_offset_s),
    bidlock.bidlock_now() + make_interval(secs => starts_offset_s + duration_s),
    bidlock.bidlock_now() + make_interval(secs => starts_offset_s + duration_s),
    snipe, extend, cap, pay_window) returning id;
$$;
revoke execute on all functions in schema bidlock_test from public;

create or replace function bidlock_test.bid(auction uuid, bidder uuid, amount bigint, key uuid default gen_random_uuid())
returns bidlock.bid_result language sql security definer set search_path = bidlock, pg_temp as $$
  select * from bidlock.place_bid(auction, bidder, amount, key);
$$;
revoke execute on all functions in schema bidlock_test from public;

create or replace function bidlock_test.clean()
returns void language plpgsql security definer set search_path=bidlock,pg_temp as $$
begin
  delete from bidlock.sandboxes;
  delete from bidlock.auctions;
  delete from bidlock.bidders;
  -- Counters arrive in T-14; until then there are none to clean.
  if to_regclass('bidlock.rate_counters') is not null then
    delete from bidlock.rate_counters;
  end if;
end $$;
revoke execute on all functions in schema bidlock_test from public;
