create schema if not exists bidlock_test;
create or replace function bidlock_test.set_now(ts timestamptz)
returns text language sql security definer set search_path = bidlock, pg_temp
as $$ select set_config('bidlock.now_override', ts::text, true) $$;
revoke execute on all functions in schema bidlock_test from public;
