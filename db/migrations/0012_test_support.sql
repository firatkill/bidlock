create or replace function bidlock._require_test_env() returns void
language plpgsql stable security definer set search_path = bidlock, pg_temp as $$
begin
  if (select s.env from bidlock.settings s) <> 'test' then
    raise exception using errcode = 'BLK30', message = 'test support function called outside test env';
  end if;
end $$;

create or replace function bidlock.create_test_auction(
  p_duration_s integer default 120, p_starting_price bigint default 1000,
  p_snipe_window_s integer default 10, p_extend_by_s integer default 30,
  p_max_extensions integer default 20, p_payment_window_s integer default 180,
  p_starts_in_s integer default 0, p_title text default null
) returns uuid
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare v_now timestamptz; v_id uuid; v_start timestamptz;
begin
  perform bidlock._require_test_env();
  v_now := bidlock.bidlock_now();
  v_start := v_now + make_interval(secs => p_starts_in_s);
  insert into bidlock.auctions (kind, title, status, starting_price, starts_at, ends_at, original_ends_at,
                                snipe_window_s, extend_by_s, max_extensions, payment_window_s)
  values ('test', coalesce(p_title, bidlock.generate_lot_title(hashtextextended(gen_random_uuid()::text, 0) % 1000000)),
          case when p_starts_in_s <= 0 then 'live' else 'scheduled' end, p_starting_price,
          v_start, v_start + make_interval(secs => p_duration_s), v_start + make_interval(secs => p_duration_s),
          p_snipe_window_s, p_extend_by_s, p_max_extensions, p_payment_window_s)
  returning id into v_id;
  perform bidlock._event(v_id, 'auction_created', null, jsonb_build_object('kind', 'test'), v_now);
  return v_id;
end $$;

create or replace function bidlock.set_test_clock(p_offset_ms bigint) returns timestamptz
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
begin
  perform bidlock._require_test_env();
  update bidlock.settings set test_clock_offset_ms = p_offset_ms;
  return bidlock.bidlock_now();
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.create_test_auction(integer, bigint, integer, integer, integer, integer, integer, text),
  bidlock.set_test_clock(bigint) to bidlock_app;
