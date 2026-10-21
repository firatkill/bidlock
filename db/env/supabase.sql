update bidlock.settings set env = 'prod', realtime_mode = 'broadcast', test_clock_offset_ms = 0;
alter role bidlock_app login password :'app_password';
-- Supabase-specific hardening: schema bidlock is not in the API's exposed schemas; make sure:
revoke all on schema bidlock from anon, authenticated, service_role;
revoke all on all functions in schema bidlock from anon, authenticated, service_role;
revoke all on all tables in schema bidlock from anon, authenticated, service_role;
