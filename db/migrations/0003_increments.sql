create table bidlock.increment_bands (
  lower_bound  bigint primary key check (lower_bound >= 0),
  increment    bigint not null check (increment > 0)
);
insert into bidlock.increment_bands (lower_bound, increment) values
  (0,       50),     -- $0.00   – $9.99     -> $0.50
  (1000,    100),    -- $10.00  – $49.99    -> $1.00
  (5000,    200),    -- $50.00  – $99.99    -> $2.00
  (10000,   500),    -- $100.00 – $249.99   -> $5.00
  (25000,   1000),   -- $250.00 – $499.99   -> $10.00
  (50000,   2500),   -- $500.00 – $999.99   -> $25.00
  (100000,  5000),   -- $1,000  – $2,499.99 -> $50.00
  (250000,  10000),  -- $2,500  – $4,999.99 -> $100.00
  (500000,  25000);  -- $5,000+             -> $250.00

create or replace function bidlock.increment_for(p_price bigint)
returns bigint language sql stable security definer set search_path = bidlock, pg_temp as $$
  select b.increment from bidlock.increment_bands b
  where b.lower_bound <= greatest(p_price, 0)
  order by b.lower_bound desc
  limit 1;
$$;

-- Minimum acceptable next bid. First bid: starting price. Otherwise: price + increment(price).
create or replace function bidlock.min_next_bid(p_starting_price bigint, p_current_price bigint)
returns bigint language sql stable security definer set search_path = bidlock, pg_temp as $$
  select case when p_current_price is null then p_starting_price
              else p_current_price + bidlock.increment_for(p_current_price) end;
$$;

-- Anti-typo cap (D-12).
create or replace function bidlock.max_bid(p_starting_price bigint, p_current_price bigint)
returns bigint language sql stable security definer set search_path = bidlock, pg_temp as $$
  select least(
    bidlock.min_next_bid(p_starting_price, p_current_price)
      + 100 * bidlock.increment_for(coalesce(p_current_price, p_starting_price)),
    100000000);
$$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.increment_for(bigint), bidlock.min_next_bid(bigint, bigint),
  bidlock.max_bid(bigint, bigint) to bidlock_app;
grant select on bidlock.increment_bands to bidlock_app;   -- read by INT-03 parity test and /how-it-works
