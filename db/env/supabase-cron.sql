-- pg_cron must be enabled in the Supabase dashboard first (Database -> Extensions -> pg_cron).
-- cron.schedule(job_name, schedule, command) replaces an existing job with the same name (A-03).
-- Run as postgres in database postgres; jobs then run as postgres there. pg_cron never runs two
-- instances of one job concurrently (a late run is queued), so tick() batches do not overlap.
select cron.schedule('bidlock-tick',          '* * * * *',   $$select bidlock.tick()$$);
select cron.schedule('bidlock-rate-gc',       '*/10 * * * *', $$delete from bidlock.rate_counters where window_start < now() - interval '2 hours'$$);
select cron.schedule('bidlock-cleanup',       '10 0 * * *',  $$select bidlock.cleanup_expired()$$);
select cron.schedule('bidlock-cron-log-gc',   '20 0 * * *',  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$);
