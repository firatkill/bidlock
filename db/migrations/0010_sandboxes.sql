create type bidlock.sandbox_result as (
  outcome         text,
  error_code      text,       -- NOT_FOUND | SANDBOX_EXISTS | SANDBOX_CAPACITY | RATE_LIMITED
  sandbox_id      uuid,
  auction_id      uuid,
  expires_at      timestamptz,
  bot_seed        integer,
  retry_after_ms  integer
);

create or replace function bidlock.create_sandbox(p_owner_id uuid, p_ip_hash text, p_seed integer default null)
returns bidlock.sandbox_result
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  r          bidlock.sandbox_result;
  v_now      timestamptz;
  v_existing record;
  v_active   integer;
  v_cap      integer;
  v_seed     integer;
  v_sid      uuid;
  v_aid      uuid;
begin
  -- Serialize per owner so double clicks cannot create two sandboxes.
  -- FOR NO KEY UPDATE (not FOR UPDATE) so it does not block the FOR KEY SHARE lock that the
  -- bids.bidder_id FK check of this owner's concurrent place_bid takes.
  perform 1 from bidlock.bidders where id = p_owner_id and not is_bot for no key update;
  if not found then
    r.outcome := 'rejected'; r.error_code := 'NOT_FOUND'; return r;
  end if;
  v_now := bidlock.bidlock_now();

  select s.id as sandbox_id, a.id as auction_id, s.expires_at, s.bot_seed into v_existing
    from bidlock.sandboxes s join bidlock.auctions a on a.sandbox_id = s.id
   where s.owner_id = p_owner_id and s.expires_at > v_now and a.status in ('scheduled', 'live', 'closed')
   order by s.created_at desc limit 1;
  if found then
    r.outcome := 'rejected'; r.error_code := 'SANDBOX_EXISTS';
    r.sandbox_id := v_existing.sandbox_id; r.auction_id := v_existing.auction_id;
    r.expires_at := v_existing.expires_at; r.bot_seed := v_existing.bot_seed;
    return r;
  end if;

  r.retry_after_ms := bidlock.rate_hit('sandbox_ip_3600s', p_ip_hash, v_now);
  if r.retry_after_ms > 0 then
    r.outcome := 'rejected'; r.error_code := 'RATE_LIMITED'; return r;
  end if;

  -- Global cap: serialize creators across all owners (low volume, short hold).
  perform pg_advisory_xact_lock(hashtextextended('bidlock.create_sandbox', 0));
  select s.max_active_sandboxes into v_cap from bidlock.settings s;
  select count(*) into v_active
    from bidlock.sandboxes s join bidlock.auctions a on a.sandbox_id = s.id
   where s.expires_at > v_now and a.status in ('scheduled', 'live', 'closed');
  if v_active >= v_cap then
    r.outcome := 'rejected'; r.error_code := 'SANDBOX_CAPACITY'; return r;
  end if;

  v_seed := coalesce(p_seed, floor(random() * 2147483647)::integer);
  insert into bidlock.sandboxes (owner_id, bot_seed, created_at, expires_at)
  values (p_owner_id, v_seed, v_now, v_now + interval '15 minutes')
  returning id into v_sid;

  insert into bidlock.auctions
    (kind, sandbox_id, title, status, starting_price, starts_at, ends_at, original_ends_at)
  values
    ('sandbox', v_sid, bidlock.generate_lot_title(v_seed), 'live', 2000,
     v_now, v_now + interval '2 minutes', v_now + interval '2 minutes')
  returning id into v_aid;

  insert into bidlock.bidders (display_name, is_bot, bot_persona, sandbox_id) values
    ('Cautious bot', true, 'cautious', v_sid),
    ('Steady bot',   true, 'steady',   v_sid),
    ('Sniper bot',   true, 'sniper',   v_sid);

  perform bidlock._event(v_aid, 'auction_created', p_owner_id, jsonb_build_object('kind', 'sandbox'), v_now);

  r.outcome := 'accepted'; r.sandbox_id := v_sid; r.auction_id := v_aid;
  r.expires_at := v_now + interval '15 minutes'; r.bot_seed := v_seed; r.retry_after_ms := 0;
  return r;
end $$;

-- Data needed to mint bot tokens. Null unless p_owner_id owns a non-expired sandbox.
create or replace function bidlock.sandbox_bots(p_owner_id uuid, p_sandbox_id uuid)
returns jsonb
language sql stable security definer set search_path = bidlock, pg_temp as $$
  select jsonb_build_object(
           'sandbox_id', s.id, 'auction_id', a.id, 'expires_at', s.expires_at, 'bot_seed', s.bot_seed,
           'bots', (select jsonb_agg(jsonb_build_object('id', d.id, 'persona', d.bot_persona, 'display_name', d.display_name)
                                     order by array_position(array['cautious','steady','sniper'], d.bot_persona))
                      from bidlock.bidders d where d.sandbox_id = s.id))
    from bidlock.sandboxes s join bidlock.auctions a on a.sandbox_id = s.id
   where s.id = p_sandbox_id and s.owner_id = p_owner_id and s.expires_at > bidlock.bidlock_now();
$$;

create or replace function bidlock.cleanup_expired()
returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_now     timestamptz := bidlock.bidlock_now();
  v_today   timestamptz := date_trunc('day', v_now, 'UTC');
  n_sandbox integer; n_public integer; n_bidders integer; n_rate integer;
begin
  -- Only sandboxes that expired before today (UTC), so "bids today" stats are never reduced.
  delete from bidlock.sandboxes where expires_at < v_today;
  get diagnostics n_sandbox = row_count;

  delete from bidlock.auctions
   where kind in ('public', 'test') and status in ('settled', 'unsold') and closed_at < v_today - interval '7 days';
  get diagnostics n_public = row_count;

  delete from bidlock.bidders d
   where not d.is_bot and d.created_at < v_today - interval '30 days'
     and not exists (select 1 from bidlock.bids b where b.bidder_id = d.id)
     and not exists (select 1 from bidlock.bid_requests q where q.bidder_id = d.id)
     and not exists (select 1 from bidlock.sandboxes s where s.owner_id = d.id)
     and not exists (select 1 from bidlock.offers o where o.bidder_id = d.id)
     and not exists (select 1 from bidlock.auctions a where a.leader_bidder_id = d.id);
  get diagnostics n_bidders = row_count;

  delete from bidlock.rate_counters where window_start < v_now - interval '2 hours';
  get diagnostics n_rate = row_count;

  return jsonb_build_object('sandboxes', n_sandbox, 'public_auctions', n_public, 'bidders', n_bidders, 'rate_counters', n_rate);
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.create_sandbox(uuid, text, integer), bidlock.sandbox_bots(uuid, uuid) to bidlock_app;
