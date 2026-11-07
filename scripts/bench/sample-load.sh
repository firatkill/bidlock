#!/usr/bin/env bash
# Bounded by the workflow's timeout; only fixed operation labels, never query text.
set -eu
while :; do
  docker compose -f docker/compose.yml exec -T db psql -X -U postgres -d bidlock_load -Atc "
    select json_build_object('ts', extract(epoch from clock_timestamp()), 'sessions', coalesce(json_agg(json_build_object(
      'pid', pid, 'state', state, 'wait_type', wait_event_type, 'wait_event', wait_event,
      'operation', case when query like '%submit_bid%' then 'submit_bid'
                        when query like '%check_bid_rate%' then 'check_bid_rate'
                        when query like '%place_bid%' then 'place_bid'
                        when query like '%get_me%' then 'getMe' else 'other' end,
      'age_ms', extract(epoch from clock_timestamp() - query_start) * 1000,
      'blockers', pg_blocking_pids(pid))), '[]'::json))
    from pg_stat_activity where datname = 'bidlock_load' and application_name = 'bidlock-app';"
  sleep 0.2
done
