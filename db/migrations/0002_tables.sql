create table bidlock.bidders (
  id               uuid primary key default gen_random_uuid(),
  display_name     text not null check (char_length(display_name) between 2 and 24),
  is_bot           boolean not null default false,
  bot_persona      text check (bot_persona in ('cautious', 'steady', 'sniper')),
  sandbox_id       uuid,                       -- FK added after sandboxes exists
  payment_strikes  integer not null default 0 check (payment_strikes >= 0),
  created_at       timestamptz not null default clock_timestamp(),
  constraint bot_shape check (
    (is_bot and bot_persona is not null and sandbox_id is not null)
    or (not is_bot and bot_persona is null and sandbox_id is null)
  )
);

create table bidlock.sandboxes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references bidlock.bidders (id) on delete cascade,
  bot_seed    integer not null,
  created_at  timestamptz not null,
  expires_at  timestamptz not null,
  check (expires_at > created_at)
);
create index sandboxes_owner_idx on bidlock.sandboxes (owner_id, created_at desc);
create index sandboxes_expires_idx on bidlock.sandboxes (expires_at);

alter table bidlock.bidders
  add constraint bidders_sandbox_fk foreign key (sandbox_id)
  references bidlock.sandboxes (id) on delete cascade;
create index bidders_sandbox_idx on bidlock.bidders (sandbox_id) where sandbox_id is not null;

create table bidlock.auctions (
  id                uuid primary key default gen_random_uuid(),
  lot_no            bigint generated always as identity unique,
  kind              text not null check (kind in ('public', 'sandbox', 'test')),
  sandbox_id        uuid references bidlock.sandboxes (id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 80),
  status            text not null check (status in ('scheduled', 'live', 'closed', 'settled', 'unsold')),
  payment_state     text check (payment_state in ('awaiting_payment', 'offered_to_runner_up', 'paid', 'expired')),
  starting_price    bigint not null check (starting_price between 1 and 100000000),
  current_price     bigint check (current_price between 1 and 100000000),
  leader_bidder_id  uuid references bidlock.bidders (id),
  last_bid_id       uuid,                      -- no FK: avoids a cycle with bids; maintained by place_bid only
  bid_count         integer not null default 0 check (bid_count >= 0),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  original_ends_at  timestamptz not null,
  snipe_window_s    integer not null default 10  check (snipe_window_s between 0 and 300),
  extend_by_s       integer not null default 30  check (extend_by_s between 1 and 600),
  max_extensions    integer not null default 20  check (max_extensions between 0 and 100),
  extension_count   integer not null default 0,
  payment_window_s  integer not null default 180 check (payment_window_s between 10 and 3600),
  closed_at         timestamptz,               -- logical close time = ends_at when closed
  settled_at        timestamptz,
  version           bigint not null default 1 check (version >= 1),
  created_at        timestamptz not null default clock_timestamp(),

  constraint extend_covers_window  check (extend_by_s >= snipe_window_s),
  constraint ends_after_start      check (ends_at > starts_at and original_ends_at > starts_at),
  constraint ends_not_before_orig  check (ends_at >= original_ends_at),
  constraint extension_cap         check (extension_count between 0 and max_extensions),
  constraint sandbox_kind          check ((kind = 'sandbox') = (sandbox_id is not null)),
  constraint price_leader_count    check (
    (bid_count = 0 and current_price is null and leader_bidder_id is null and last_bid_id is null)
    or (bid_count > 0 and current_price is not null and leader_bidder_id is not null and last_bid_id is not null)
  ),
  constraint price_at_least_start  check (current_price is null or current_price >= starting_price),
  constraint status_payment_pair   check ((
    (status in ('scheduled', 'live') and payment_state is null)
    or (status = 'closed'  and payment_state in ('awaiting_payment', 'offered_to_runner_up'))
    or (status = 'settled' and payment_state = 'paid')
    or (status = 'unsold'  and (payment_state is null or payment_state = 'expired'))
  ) is true),
  constraint closed_has_time       check ((status in ('scheduled', 'live')) = (closed_at is null)),
  constraint settled_has_time      check ((status = 'settled') = (settled_at is not null))
);

-- INV-09: at most one open public auction.
create unique index auctions_one_open_public
  on bidlock.auctions (kind)
  where kind = 'public' and status in ('scheduled', 'live');
create index auctions_live_due_idx      on bidlock.auctions (ends_at)   where status = 'live';
create index auctions_scheduled_due_idx on bidlock.auctions (starts_at) where status = 'scheduled';
create index auctions_sandbox_idx       on bidlock.auctions (sandbox_id) where sandbox_id is not null;
create index auctions_public_recent_idx on bidlock.auctions (closed_at desc) where kind = 'public';

create table bidlock.bid_requests (
  id               uuid primary key,
  bidder_id        uuid not null references bidlock.bidders (id) on delete cascade,
  idempotency_key  uuid not null,
  auction_id       uuid not null references bidlock.auctions (id) on delete cascade,
  amount           bigint not null,
  outcome          text not null check (outcome in ('accepted', 'rejected')),
  error_code       text check (error_code in ('AUCTION_NOT_LIVE', 'AUCTION_CLOSED', 'ALREADY_LEADING', 'BID_TOO_LOW', 'BID_TOO_HIGH')),
  result           jsonb not null,
  created_at       timestamptz not null,
  constraint idempotency_unique unique (bidder_id, idempotency_key),
  constraint outcome_code check ((outcome = 'accepted') = (error_code is null))
);
create index bid_requests_auction_idx on bidlock.bid_requests (auction_id);

create table bidlock.bids (
  id              uuid primary key,
  auction_id      uuid not null references bidlock.auctions (id) on delete cascade,
  bid_no          integer not null check (bid_no >= 1),
  bidder_id       uuid not null references bidlock.bidders (id) on delete cascade,
  amount          bigint not null check (amount between 1 and 100000000),
  prev_amount     bigint,
  min_required    bigint not null,
  placed_at       timestamptz not null,
  ends_at_before  timestamptz not null,
  ends_at_after   timestamptz not null,
  request_id      uuid not null unique references bidlock.bid_requests (id) on delete cascade,
  constraint bid_no_unique      unique (auction_id, bid_no),
  constraint meets_minimum      check (amount >= min_required),
  constraint increasing         check (prev_amount is null or amount > prev_amount),
  constraint before_close       check (placed_at < ends_at_before),
  constraint end_not_shortened  check (ends_at_after >= ends_at_before)
);
create index bids_auction_no_idx      on bidlock.bids (auction_id, bid_no desc);
create index bids_auction_bidder_idx  on bidlock.bids (auction_id, bidder_id, amount desc);
create index bids_placed_at_idx       on bidlock.bids (placed_at);

create table bidlock.auction_extensions (
  auction_id   uuid not null references bidlock.auctions (id) on delete cascade,
  n            integer not null check (n >= 1),
  bid_id       uuid not null references bidlock.bids (id) on delete cascade,
  old_ends_at  timestamptz not null,
  new_ends_at  timestamptz not null,
  at           timestamptz not null,
  primary key (auction_id, n),
  check (new_ends_at > old_ends_at)
);

create table bidlock.offers (
  id           uuid primary key default gen_random_uuid(),
  auction_id   uuid not null references bidlock.auctions (id) on delete cascade,
  rank         smallint not null check (rank in (1, 2)),
  bidder_id    uuid not null references bidlock.bidders (id) on delete cascade,
  amount       bigint not null check (amount between 1 and 100000000),
  status       text not null check (status in ('open', 'paid', 'expired')),
  opened_at    timestamptz not null,
  deadline     timestamptz not null,
  resolved_at  timestamptz,
  constraint offer_rank_unique unique (auction_id, rank),
  check (deadline > opened_at),
  check ((status = 'open') = (resolved_at is null))
);
create unique index offers_one_open_idx  on bidlock.offers (auction_id) where status = 'open';
create unique index offers_one_paid_idx  on bidlock.offers (auction_id) where status = 'paid';
create index offers_open_deadline_idx    on bidlock.offers (deadline) where status = 'open';
create index offers_bidder_open_idx      on bidlock.offers (bidder_id) where status = 'open';

create table bidlock.payment_strikes (
  id          bigint generated always as identity primary key,
  bidder_id   uuid not null references bidlock.bidders (id) on delete cascade,
  auction_id  uuid not null references bidlock.auctions (id) on delete cascade,
  offer_id    uuid not null unique references bidlock.offers (id) on delete cascade,
  created_at  timestamptz not null
);

create table bidlock.auction_events (
  id          bigint generated always as identity primary key,
  auction_id  uuid not null references bidlock.auctions (id) on delete cascade,
  type        text not null check (type in (
                'auction_created', 'auction_started', 'bid_accepted', 'auction_extended',
                'auction_closed', 'auction_unsold', 'offer_opened', 'offer_paid',
                'offer_expired', 'strike_recorded')),
  bidder_id   uuid,                            -- no FK: audit rows survive bidder cleanup until the auction is deleted
  data        jsonb not null default '{}'::jsonb,
  at          timestamptz not null
);
create index auction_events_auction_idx on bidlock.auction_events (auction_id, id);
create index auction_events_at_idx      on bidlock.auction_events (at);

create or replace function bidlock._event(p_auction_id uuid, p_type text, p_bidder_id uuid, p_data jsonb, p_at timestamptz)
returns void language sql security definer set search_path = bidlock, pg_temp as $$
  insert into bidlock.auction_events (auction_id, type, bidder_id, data, at)
  values (p_auction_id, p_type, p_bidder_id, coalesce(p_data, '{}'::jsonb), p_at);
$$;
revoke execute on all functions in schema bidlock from public;
