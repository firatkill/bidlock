create or replace function bidlock.close_due_auctions(p_limit integer default 100)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a     bidlock.auctions;
  v_now timestamptz := bidlock.bidlock_now();
  n     integer := 0;
begin
  -- Rows locked by an in-flight bid are skipped: that bid closes the auction lazily.
  for a in
    select * from bidlock.auctions
     where status = 'live' and ends_at <= v_now
     order by ends_at
     limit p_limit
     for update skip locked
  loop
    n := n + bidlock._advance_one(a);
  end loop;

  for a in
    select * from bidlock.auctions
     where status = 'scheduled' and starts_at <= v_now
     order by starts_at
     limit p_limit
     for update skip locked
  loop
    n := n + bidlock._advance_one(a);
  end loop;
  return n;
end $$;

-- One auction per subtransaction: an error on one auction (BLK03, a detected deadlock between two
-- concurrent scheduler runs, a Realtime stub failure) rolls back only that auction's changes and
-- is reported as a WARNING (visible in the Postgres log); the rest of the batch still commits.
-- Returns 1 when the auction was advanced, 0 when it failed.
create or replace function bidlock._advance_one(a bidlock.auctions)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
begin
  perform bidlock.advance_auction_locked(a, bidlock.bidlock_now());
  return 1;
exception when others then
  raise warning 'bidlock scheduler: auction % not advanced: % (%)', a.id, sqlerrm, sqlstate;
  return 0;
end $$;

create or replace function bidlock.expire_due_offers(p_limit integer default 100)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a     bidlock.auctions;
  v_now timestamptz := bidlock.bidlock_now();
  n     integer := 0;
begin
  for a in
    select au.* from bidlock.auctions au
     where au.status = 'closed'
       and exists (select 1 from bidlock.offers o
                    where o.auction_id = au.id and o.status = 'open' and o.deadline <= v_now)
     order by au.closed_at
     limit p_limit
     for update of au skip locked
  loop
    n := n + bidlock._advance_one(a);
  end loop;
  return n;
end $$;

create or replace function bidlock.generate_lot_title(p_seed bigint)
returns text language sql immutable security definer set search_path = bidlock, pg_temp as $$
  select (array['Walnut','Brass','Enamel','Oak','Teak','Copper','Linen','Chrome','Leather','Marble','Rattan','Pewter'])
           [1 + (abs(p_seed) % 12)::int]
      || ' '
      || (array['Desk Lamp','Wall Clock','Writing Desk','Typewriter','Radio','Side Table','Camera Case','Vase',
                'Record Cabinet','Bookshelf','Mirror','Tea Tray'])[1 + ((abs(p_seed) / 12) % 12)::int]
      || ', '
      || (array['1950s','1960s','1970s','1980s','1990s'])[1 + ((abs(p_seed) / 144) % 5)::int];
$$;

-- INV-09. Safe to call concurrently: the unique partial index arbitrates.
create or replace function bidlock.ensure_public_auction()
returns uuid
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a         bidlock.auctions;
  v_id      uuid;
  v_now     timestamptz := bidlock.bidlock_now();
  v_last    timestamptz;
  v_starts  timestamptz;
begin
  select * into a from bidlock.auctions
   where kind = 'public' and status in ('scheduled', 'live')
   limit 1;
  if found then
    if not bidlock._is_due(a, v_now) then
      return a.id;
    end if;
    -- Due (e.g. past ends_at and nobody touched it): try to advance without waiting on a bid.
    -- Keep the id: SELECT INTO with no row sets every field of "a" to null.
    v_id := a.id;
    select * into a from bidlock.auctions where id = v_id for update skip locked;
    if not found then
      return v_id;                         -- an in-flight bid holds it and will close it
    end if;
    a := bidlock.advance_auction_locked(a, v_now);
    if a.status in ('scheduled', 'live') then
      return a.id;
    end if;
  end if;

  select max(closed_at) into v_last from bidlock.auctions where kind = 'public';
  v_starts := greatest(v_now, coalesce(v_last + interval '15 seconds', v_now));

  v_id := null;                            -- RETURNING INTO leaves it null when ON CONFLICT skips the row
  insert into bidlock.auctions
    (kind, title, status, starting_price, starts_at, ends_at, original_ends_at)
  values
    ('public',
     bidlock.generate_lot_title(hashtextextended(gen_random_uuid()::text, 0) % 1000000),
     case when v_starts <= v_now then 'live' else 'scheduled' end,
     1000, v_starts, v_starts + interval '5 minutes', v_starts + interval '5 minutes')
  on conflict (kind) where kind = 'public' and status in ('scheduled', 'live') do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from bidlock.auctions
     where kind = 'public' and status in ('scheduled', 'live') limit 1;
  else
    perform bidlock._event(v_id, 'auction_created', null, jsonb_build_object('kind', 'public'), v_now);
  end if;
  return v_id;
end $$;

-- Cron entry point (production, every minute) and `pnpm db:tick` locally.
create or replace function bidlock.tick()
returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare v_closed integer; v_expired integer; v_public uuid;
begin
  v_closed  := bidlock.close_due_auctions(200);
  v_expired := bidlock.expire_due_offers(200);
  v_public  := bidlock.ensure_public_auction();
  return jsonb_build_object('closed_or_started', v_closed, 'offers_expired', v_expired, 'public_auction_id', v_public);
end $$;

revoke execute on all functions in schema bidlock from public;
