update bidlock.settings set env = 'test', realtime_mode = 'none', bidding_paused = false, test_clock_offset_ms = 0;
alter role bidlock_app login password 'bidlock_app';
-- All k6 VUs share one IP. Per-bidder limits stay at production values.
update bidlock.rate_limits set max_hits = 1000000 where name in ('bid_ip_60s', 'bidder_create_ip_3600s');
