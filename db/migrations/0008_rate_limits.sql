create table bidlock.rate_limits (
  name      text primary key,
  window_s  integer not null check (window_s between 1 and 86400),
  max_hits  integer not null check (max_hits >= 1)
);
insert into bidlock.rate_limits (name, window_s, max_hits) values
  ('bid_bidder_1s',          1,    3),     -- human burst
  ('bid_bidder_60s',         60,   60),    -- human sustained
  ('bid_bot_2s',             2,    1),     -- bot: 1 bid per 2 s
  ('bid_ip_60s',             60,   200),   -- per IP hash
  ('sandbox_ip_3600s',       3600, 5),     -- sandbox creation
  ('bidder_create_ip_3600s', 3600, 20);    -- guest creation

-- UNLOGGED: counters are disposable; losing them on crash only resets limits.
create unlogged table bidlock.rate_counters (
  bucket        text        not null,     -- '<limit name>:<subject>'
  window_start  timestamptz not null,
  hits          integer     not null,
  primary key (bucket, window_start)
);
create index rate_counters_window_idx on bidlock.rate_counters (window_start);

-- Returns 0 when allowed, else milliseconds until the window resets. Counts every call (also rejected ones).
create or replace function bidlock.rate_hit(p_limit text, p_subject text, p_now timestamptz)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_window integer;
  v_max    integer;
  v_start  timestamptz;
  v_hits   integer;
begin
  select l.window_s, l.max_hits into v_window, v_max from bidlock.rate_limits l where l.name = p_limit;
  if not found then
    raise exception using errcode = 'BLK20', message = format('unknown rate limit %s', p_limit);
  end if;
  v_start := to_timestamp(floor(extract(epoch from p_now) / v_window) * v_window);

  insert into bidlock.rate_counters as c (bucket, window_start, hits)
  values (p_limit || ':' || p_subject, v_start, 1)
  on conflict (bucket, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;

  if v_hits <= v_max then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window) - p_now)) * 1000))::integer;
end $$;

-- Called by POST /bids in its own statement BEFORE place_bid (D-10).
create or replace function bidlock.check_bid_rate(p_bidder_id uuid, p_ip_hash text)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_now    timestamptz := bidlock.bidlock_now();
  v_is_bot boolean;
  v_retry  integer := 0;
begin
  select d.is_bot into v_is_bot from bidlock.bidders d where d.id = p_bidder_id;
  if not found then
    return 0;                               -- place_bid will answer NOT_FOUND
  end if;
  if v_is_bot then
    v_retry := greatest(v_retry, bidlock.rate_hit('bid_bot_2s', p_bidder_id::text, v_now));
  else
    v_retry := greatest(v_retry, bidlock.rate_hit('bid_bidder_1s', p_bidder_id::text, v_now));
    v_retry := greatest(v_retry, bidlock.rate_hit('bid_bidder_60s', p_bidder_id::text, v_now));
  end if;
  v_retry := greatest(v_retry, bidlock.rate_hit('bid_ip_60s', p_ip_hash, v_now));
  return v_retry;
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.check_bid_rate(uuid, text) to bidlock_app;
