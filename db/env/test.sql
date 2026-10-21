update bidlock.settings set env = 'test', realtime_mode = 'none', bidding_paused = false, test_clock_offset_ms = 0;
alter role bidlock_app login password 'bidlock_app';
create extension if not exists pgtap;            -- line removed by apply-env --no-pgtap (§6.1); keep it on its own line
-- e2e runs many sandboxes, guests and bids from one IP ("local" with TRUST_PROXY=none), in parallel
-- workers; per-bidder and per-bot limits stay at production values so E2E-08 and the bots see them:
update bidlock.rate_limits set max_hits = 10000
 where name in ('sandbox_ip_3600s', 'bidder_create_ip_3600s', 'bid_ip_60s');
