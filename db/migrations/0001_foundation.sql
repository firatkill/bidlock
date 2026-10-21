create schema if not exists bidlock;
revoke all on schema bidlock from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bidlock_app') then
    create role bidlock_app nologin;
  end if;
end $$;
grant usage on schema bidlock to bidlock_app;
-- No "alter default privileges in schema bidlock revoke … from public": it cannot remove the global
-- PUBLIC EXECUTE default (§6.3). Every migration that defines functions ends with
-- "revoke execute on all functions in schema bidlock from public;" instead. Tables get no PUBLIC
-- privileges by default, so nothing is needed for them.

-- Singleton settings row. Only the owner can change it.
create table bidlock.settings (
  id                    boolean primary key default true check (id),
  env                   text    not null default 'prod' check (env in ('prod', 'test')),
  realtime_mode         text    not null default 'none' check (realtime_mode in ('none', 'broadcast')),
  bidding_paused        boolean not null default false,
  max_active_sandboxes  integer not null default 50 check (max_active_sandboxes between 0 and 1000),
  test_clock_offset_ms  bigint  not null default 0,
  constraint test_clock_only_in_test check (env = 'test' or test_clock_offset_ms = 0)
);
insert into bidlock.settings default values;

-- Time source for every rule. See PRD D-06, D-07.
create or replace function bidlock.bidlock_now()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = bidlock, pg_temp
as $$
declare
  v_override text := nullif(current_setting('bidlock.now_override', true), '');
  v_env      text;
  v_offset   bigint;
begin
  select s.env, s.test_clock_offset_ms into v_env, v_offset from bidlock.settings s;
  if v_override is not null then
    if v_env <> 'test' then
      raise exception using
        errcode = 'BLK01',
        message = 'bidlock.now_override is set but settings.env is not test';
    end if;
    return v_override::timestamptz;
  end if;
  if v_offset <> 0 then
    return clock_timestamp() + make_interval(secs => v_offset / 1000.0);
  end if;
  return clock_timestamp();
end $$;
revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.bidlock_now() to bidlock_app;
