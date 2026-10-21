# M0 — Setup test cases

Designed from PRD, TRD and T-01–T-04 before implementation. Preconditions: Node ≥22, pnpm, Docker available; GitHub and isolated local database lifecycle approved (D-44/D-45). No k6 or production traffic.

## TC-001: Strict toolchain and server-only test alias

- Milestone: M0 — Setup
- PRD / acceptance reference: NFR-40, NFR-43; T-01 acceptance
- TRD test ID / section: T-01 smoke
- Priority: High
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Install frozen lockfile; run lint, typecheck, unit, guards and build; import a server-only module in Vitest.
- Expected result: All commands pass; server-only import works only via the test alias.

## TC-002: Static CI

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-96; T-01 acceptance
- TRD test ID / section: TRD §16.1 static
- Priority: High
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Push the task branch and inspect the static workflow.
- Expected result: Lint, typecheck, unit coverage and guard steps pass.

## TC-003: Required environment and secret validation

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-88; T-02 acceptance
- TRD test ID / section: TRD §5 env
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Parse valid configuration; remove each required secret; supply short secrets and invalid database URL.
- Expected result: Valid configuration parses; missing/short secrets and invalid URLs are rejected.

## TC-004: Production test-variable refusal

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-52, FR-88; T-02 acceptance
- TRD test ID / section: TRD §5 env
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Parse production configuration with TEST_API_SECRET or BOT_SEED_OVERRIDE.
- Expected result: Both configurations fail validation.

## TC-005: Origin allowlist and cache

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-85; T-02 acceptance
- TRD test ID / section: TRD §5 env
- Priority: High
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Parse comma-separated root origins; reject paths; read cached configuration then reset under Vitest.
- Expected result: Origins normalized to a list; path-bearing entries rejected; cache stable until test-only reset.

## TC-006: Structured redacted logs

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-80
- TRD test ID / section: TRD §14 log
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Log nested objects with cookie, authorization, token, secret, password and ip fields; test level filtering.
- Expected result: JSON log contains metadata and allowed fields, no forbidden keys at any depth; below-threshold messages omitted.

## TC-007: Error status mapping

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-51; T-02 acceptance
- TRD test ID / section: UT-09 / TRD §10.12
- Priority: High
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Compare all documented error codes with status mapping and AppError.
- Expected result: Every documented code maps to the specified status. Copy-key and DB-result checks follow their implementation tasks.

## TC-008: Postgres and pgTAP availability

- Milestone: M0 — Setup
- PRD / acceptance reference: FR-90; T-03 acceptance
- TRD test ID / section: TRD §17.2 / A-07
- Priority: High
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Start db; count the three project databases; locate pg_prove and pgtap extension.
- Expected result: Three databases, pg_prove binary and pgtap extension available on PostgreSQL 17.

## TC-009: Repeatable migration with checksum protection

- Milestone: M0 — Setup
- PRD / acceptance reference: PRD D-05; T-04 acceptance
- TRD test ID / section: TRD §6.1 migrate integration
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Apply scratch migrations twice; edit an applied fixture; run again.
- Expected result: Second apply is a no-op; edited migration fails with checksum mismatch.

## TC-010: Status and dry-run

- Milestone: M0 — Setup
- PRD / acceptance reference: PRD D-05; T-04 acceptance
- TRD test ID / section: TRD §6.1 migrate integration
- Priority: High
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Inspect pending fixture migrations using status and dry-run before applying.
- Expected result: Pending files reported without applying their schema changes.

## TC-011: Reset host and database safety

- Milestone: M0 — Setup
- PRD / acceptance reference: PRD D-34; T-04 acceptance
- TRD test ID / section: TRD §6.1 reset integration
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Check default target, --db override and non-local host refusal.
- Expected result: Default is bidlock_test; --db bidlock targets dev; external reset rejected before connection.

## TC-012: Environment SQL safety and substitutions

- Milestone: M0 — Setup
- PRD / acceptance reference: PRD D-22; T-04 acceptance
- TRD test ID / section: TRD §6.1 apply-env integration
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Run fixtures with --no-pgtap; check missing placeholders and unsafe environment/host combinations.
- Expected result: pgTAP creation removed; missing variable rejected; test/load external and supabase local refused.

## TC-013: Migration transaction rollback

- Milestone: M0 — Setup
- PRD / acceptance reference: PRD D-05; T-04 acceptance
- TRD test ID / section: TRD §6.1 migrate integration
- Priority: Critical
- Automatable: yes
- Preconditions: M0 toolchain; for database cases, only the approved local project databases.
- Steps: Apply a scratch migration containing a later invalid statement.
- Expected result: Schema changes and migration record roll back together.

# M1 — Schema, functions, pgTAP

Designed from TRD §15.2–15.4 before M1 implementation. Each case uses an isolated transaction or its own records; no concurrent browser/load run may use the test database. SQL clock changes roll back.

## TC-014: DB-01 — no override → within 1 s of `clock_timestamp()`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-06; D-06; D-07
- TRD test ID / section: DB-01, §15.2, `001_now.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: no override → within 1 s of `clock_timestamp()`.

## TC-015: DB-01 — override honoured when env=test

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-06; D-06; D-07
- TRD test ID / section: DB-01, §15.2, `001_now.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: override honoured when env=test.

## TC-016: DB-01 — env=prod + override → throws `BLK01`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-06; D-06; D-07
- TRD test ID / section: DB-01, §15.2, `001_now.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: env=prod + override → throws `BLK01`.

## TC-017: DB-01 — offset 60000 → +60 s

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-06; D-06; D-07
- TRD test ID / section: DB-01, §15.2, `001_now.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: offset 60000 → +60 s.

## TC-018: DB-01 — `update settings set env='prod', test_clock_offset_ms=5` → throws check violation (23514)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-06; D-06; D-07
- TRD test ID / section: DB-01, §15.2, `001_now.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `update settings set env='prod', test_clock_offset_ms=5` → throws check violation (23514).

## TC-019: DB-02 — tables and key columns exist with types

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: tables and key columns exist with types.

## TC-020: DB-02 — CHECK `status_payment_pair` rejects (`live`,`paid`), (`settled`, null), (`closed`, null)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: CHECK `status_payment_pair` rejects (`live`,`paid`), (`settled`, null), (`closed`, null).

## TC-021: DB-02 — `price_leader_count` rejects inconsistent rows

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `price_leader_count` rejects inconsistent rows.

## TC-022: DB-02 — unique `auctions_one_open_public`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: unique `auctions_one_open_public`.

## TC-023: DB-02 — `set role bidlock_app` then direct `insert into bidlock.auctions` throws 42501

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `set role bidlock_app` then direct `insert into bidlock.auctions` throws 42501.

## TC-024: DB-02 — `bidlock_app` can execute `place_bid`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `bidlock_app` can execute `place_bid`.

## TC-025: DB-02 — cannot execute `tick`, `advance_auction_locked`, `rate_hit`, `close_due_auctions`, `cleanup_expired`, `_event`, `ensure_public_auction` (`throws_ok(…, '42501')` after `set local role bidlock_app`)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: cannot execute `tick`, `advance_auction_locked`, `rate_hit`, `close_due_auctions`, `cleanup_expired`, `_event`, `ensure_public_auction` (`throws_ok(…, '42501')` after `set local role bidlock_app`).

## TC-026: DB-02 — no function in schema `bidlock` is executable through `PUBLIC`: inside the test transaction `create role bidlock_probe nologin`, then `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bidlock' and has_function_privilege('bidlock_probe', p.oid, 'execute')` must be 0 (catches a migration that forgot the §6.3 revoke)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-01; INV-09; INV-13
- TRD test ID / section: DB-02, §15.2, `002_schema.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: no function in schema `bidlock` is executable through `PUBLIC`: inside the test transaction `create role bidlock_probe nologin`, then `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bidlock' and has_function_privilege('bidlock_probe', p.oid, 'execute')` must be 0 (catches a migration that forgot the §6.3 revoke).

## TC-027: DB-03 — `increment_for` at 0, 999, 1000, 4999, 5000, 9999, 10000, 24999, 25000, 49999, 50000, 99999, 100000, 249999, 250000, 499999, 500000, 100000000

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-03; D-12
- TRD test ID / section: DB-03, §15.2, `003_increments.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `increment_for` at 0, 999, 1000, 4999, 5000, 9999, 10000, 24999, 25000, 49999, 50000, 99999, 100000, 249999, 250000, 499999, 500000, 100000000.

## TC-028: DB-03 — `min_next_bid(1000, null) = 1000`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-03; D-12
- TRD test ID / section: DB-03, §15.2, `003_increments.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `min_next_bid(1000, null) = 1000`.

## TC-029: DB-03 — `min_next_bid(1000, 999) = 1049`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-03; D-12
- TRD test ID / section: DB-03, §15.2, `003_increments.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `min_next_bid(1000, 999) = 1049`.

## TC-030: DB-03 — `min_next_bid(1000, 4950) = 5050`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-03; D-12
- TRD test ID / section: DB-03, §15.2, `003_increments.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `min_next_bid(1000, 4950) = 5050`.

## TC-031: DB-03 — `max_bid(1000, null) = 1000 + 100*100 = 11000`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-03; D-12
- TRD test ID / section: DB-03, §15.2, `003_increments.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `max_bid(1000, null) = 1000 + 100*100 = 11000`.

## TC-032: DB-03 — cap at 100000000

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-03; D-12
- TRD test ID / section: DB-03, §15.2, `003_increments.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: cap at 100000000.

## TC-033: DB-04 — first bid < start → `BID_TOO_LOW` with `min_next_bid = start`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: first bid < start → `BID_TOO_LOW` with `min_next_bid = start`.

## TC-034: DB-04 — = start accepted, `bid_no = 1`, `version` +1, leader set

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: = start accepted, `bid_no = 1`, `version` +1, leader set.

## TC-035: DB-04 — second bid by same bidder → `ALREADY_LEADING`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: second bid by same bidder → `ALREADY_LEADING`.

## TC-036: DB-04 — other bidder at price+inc−1 → `BID_TOO_LOW`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: other bidder at price+inc−1 → `BID_TOO_LOW`.

## TC-037: DB-04 — at price+inc → accepted

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: at price+inc → accepted.

## TC-038: DB-04 — band crossing (price 990 → min 1040

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: band crossing (price 990 → min 1040.

## TC-039: DB-04 — price 1000 → min 1100)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: price 1000 → min 1100).

## TC-040: DB-04 — `BID_TOO_HIGH` at max+1, accepted at max

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `BID_TOO_HIGH` at max+1, accepted at max.

## TC-041: DB-04 — amount 0 → `VALIDATION`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: amount 0 → `VALIDATION`.

## TC-042: DB-04 — scheduled → `AUCTION_NOT_LIVE`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: scheduled → `AUCTION_NOT_LIVE`.

## TC-043: DB-04 — scheduled whose `starts_at` passed → accepted (lazy start)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: scheduled whose `starts_at` passed → accepted (lazy start).

## TC-044: DB-04 — at `ends_at` → `AUCTION_CLOSED` and status now `closed`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: at `ends_at` → `AUCTION_CLOSED` and status now `closed`.

## TC-045: DB-04 — unknown auction / bidder → `NOT_FOUND`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: unknown auction / bidder → `NOT_FOUND`.

## TC-046: DB-04 — sandbox: stranger `NOT_FOUND`, owner accepted, own bot accepted, other sandbox's bot `NOT_FOUND`, bot on test auction `NOT_FOUND`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: sandbox: stranger `NOT_FOUND`, owner accepted, own bot accepted, other sandbox's bot `NOT_FOUND`, bot on test auction `NOT_FOUND`.

## TC-047: DB-04 — `bidding_paused` → `BIDDING_PAUSED` and no request row

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `bidding_paused` → `BIDDING_PAUSED` and no request row.

## TC-048: DB-04 — bids row fields (`prev_amount`, `min_required`, `ends_at_before/after`)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: bids row fields (`prev_amount`, `min_required`, `ends_at_before/after`).

## TC-049: DB-04 — `bid_requests` row stored for rule rejections and not for `NOT_FOUND`/`VALIDATION`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-02; FR-04; INV-01–INV-05; INV-07
- TRD test ID / section: DB-04, §15.2, `004_place_bid_rules.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `bid_requests` row stored for rule rejections and not for `NOT_FOUND`/`VALIDATION`.

## TC-050: DB-05 — replay accepted → same `bid_id`, `replayed = true`, `bid_count` unchanged, no new event

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: replay accepted → same `bid_id`, `replayed = true`, `bid_count` unchanged, no new event.

## TC-051: DB-05 — replay after being outbid → still original accepted result

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: replay after being outbid → still original accepted result.

## TC-052: DB-05 — replay of rejection → same code, `replayed = true`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: replay of rejection → same code, `replayed = true`.

## TC-053: DB-05 — same key + different amount → `IDEMPOTENCY_MISMATCH`, request count unchanged

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: same key + different amount → `IDEMPOTENCY_MISMATCH`, request count unchanged.

## TC-054: DB-05 — same key + other auction → `IDEMPOTENCY_MISMATCH`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: same key + other auction → `IDEMPOTENCY_MISMATCH`.

## TC-055: DB-05 — two bidders using the same key → both processed independently

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: two bidders using the same key → both processed independently.

## TC-056: DB-05 — replay after auction closed → original result

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-04; INV-07
- TRD test ID / section: DB-05, §15.2, `005_idempotency.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: replay after auction closed → original result.

## TC-057: DB-06 — bid at `ends_at − 11 s` → no extension

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: bid at `ends_at − 11 s` → no extension.

## TC-058: DB-06 — at `ends_at − 10 s` → `ends_at = now + 30 s`, `extended = true`, extension row n=1, event `auction_extended`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: at `ends_at − 10 s` → `ends_at = now + 30 s`, `extended = true`, extension row n=1, event `auction_extended`.

## TC-059: DB-06 — at `ends_at − 1 ms` → extends

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: at `ends_at − 1 ms` → extends.

## TC-060: DB-06 — custom window 5 / extend 20 honoured

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: custom window 5 / extend 20 honoured.

## TC-061: DB-06 — `snipe_window_s = 0` → never extends

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `snipe_window_s = 0` → never extends.

## TC-062: DB-06 — cap: with `max_extensions = 3`, the 4th late bid accepted with `extended = false` and `extension_count = 3`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: cap: with `max_extensions = 3`, the 4th late bid accepted with `extended = false` and `extension_count = 3`.

## TC-063: DB-06 — `ends_at` never decreases

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `ends_at` never decreases.

## TC-064: DB-06 — `ends_at_after` on bid rows matches

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-07; INV-08
- TRD test ID / section: DB-06, §15.2, `006_soft_close.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `ends_at_after` on bid rows matches.

## TC-065: DB-07 — lazy close via `place_bid` (status `closed`, offer rank 1, `closed_at = ends_at`, not the processing time)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: lazy close via `place_bid` (status `closed`, offer rank 1, `closed_at = ends_at`, not the processing time).

## TC-066: DB-07 — lazy close via `auction_state`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: lazy close via `auction_state`.

## TC-067: DB-07 — no bids → `unsold`, `payment_state` null

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: no bids → `unsold`, `payment_state` null.

## TC-068: DB-07 — `close_due_auctions()` closes 3 due auctions and returns 3, second call returns 0

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `close_due_auctions()` closes 3 due auctions and returns 3, second call returns 0.

## TC-069: DB-07 — not-yet-due auction untouched

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: not-yet-due auction untouched.

## TC-070: DB-07 — scheduled due → `live`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: scheduled due → `live`.

## TC-071: DB-07 — scheduled with passed `ends_at` → `unsold` in one call

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: scheduled with passed `ends_at` → `unsold` in one call.

## TC-072: DB-07 — `tick()` returns counts and a public auction id

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `tick()` returns counts and a public auction id.

## TC-073: DB-07 — D-28: with a test-only `before update` trigger on `bidlock.auctions` (created inside the test transaction) that raises for one chosen auction id, `close_due_auctions()` still closes the other due auctions and the chosen one stays `live`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-10; INV-06; INV-09
- TRD test ID / section: DB-07, §15.2, `007_closing.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: D-28: with a test-only `before update` trigger on `bidlock.auctions` (created inside the test transaction) that raises for one chosen auction id, `close_due_auctions()` still closes the other due auctions and the chosen one stays `live`.

## TC-074: DB-08 — offer deadline = processing time + `payment_window_s`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: offer deadline = processing time + `payment_window_s`.

## TC-075: DB-08 — winner pays before deadline → `settled`/`paid`, `settled_at`, event

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: winner pays before deadline → `settled`/`paid`, `settled_at`, event.

## TC-076: DB-08 — second pay → `replayed = true`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: second pay → `replayed = true`.

## TC-077: DB-08 — non-winner pays → `NOT_PAYABLE`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: non-winner pays → `NOT_PAYABLE`.

## TC-078: DB-08 — winner pays after deadline → `OFFER_EXPIRED`, runner-up offer rank 2 at runner-up's highest bid, strike count 1 and strike row

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: winner pays after deadline → `OFFER_EXPIRED`, runner-up offer rank 2 at runner-up's highest bid, strike count 1 and strike row.

## TC-079: DB-08 — runner-up selection with three bidders (A 10, B 11, C 12, B 13, C 14 → winner C, runner-up B at 13)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: runner-up selection with three bidders (A 10, B 11, C 12, B 13, C 14 → winner C, runner-up B at 13).

## TC-080: DB-08 — runner-up pays → `settled` rank 2

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: runner-up pays → `settled` rank 2.

## TC-081: DB-08 — runner-up expires → `unsold`/`expired`, winner strike still 1, runner-up strike 0

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: runner-up expires → `unsold`/`expired`, winner strike still 1, runner-up strike 0.

## TC-082: DB-08 — single-bidder auction expiry → `unsold`/`expired`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: single-bidder auction expiry → `unsold`/`expired`.

## TC-083: DB-08 — `expire_due_offers()` idempotent

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `expire_due_offers()` idempotent.

## TC-084: DB-08 — late processing: window opens at processing time

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-11–FR-16; INV-10; INV-11; INV-13
- TRD test ID / section: DB-08, §15.2, `008_settlement.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: late processing: window opens at processing time.

## TC-085: DB-09 — (reset limits to defaults in-transaction) human: hits 1–3 in one second → 0, 4th → retry in (0, 1000]

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: (reset limits to defaults in-transaction) human: hits 1–3 in one second → 0, 4th → retry in (0, 1000].

## TC-086: DB-09 — next second → 0

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: next second → 0.

## TC-087: DB-09 — 61st in a minute → > 0

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: 61st in a minute → > 0.

## TC-088: DB-09 — bot: 2nd within 2 s → > 0, after 2 s → 0

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: bot: 2nd within 2 s → > 0, after 2 s → 0.

## TC-089: DB-09 — IP: 201st → > 0

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: IP: 201st → > 0.

## TC-090: DB-09 — `retry_after_ms` = ms to window end (with fixed `now`)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `retry_after_ms` = ms to window end (with fixed `now`).

## TC-091: DB-09 — unknown limit → `BLK20`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: unknown limit → `BLK20`.

## TC-092: DB-09 — `create_bidder` 21st within an hour → `RATE_LIMITED`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `create_bidder` 21st within an hour → `RATE_LIMITED`.

## TC-093: DB-09 — counters keyed by subject (other bidder unaffected)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-37; D-10; D-11
- TRD test ID / section: DB-09, §15.2, `009_rate_limits.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: counters keyed by subject (other bidder unaffected).

## TC-094: DB-10 — `ensure_public_auction()` creates one live public auction when none

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-30; FR-31
- TRD test ID / section: DB-10, §15.2, `010_public_room.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `ensure_public_auction()` creates one live public auction when none.

## TC-095: DB-10 — second call returns the same id

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-30; FR-31
- TRD test ID / section: DB-10, §15.2, `010_public_room.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: second call returns the same id.

## TC-096: DB-10 — inserting a second open public auction throws 23505

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-30; FR-31
- TRD test ID / section: DB-10, §15.2, `010_public_room.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: inserting a second open public auction throws 23505.

## TC-097: DB-10 — after the public lot closes, the next has `starts_at = closed_at + 15 s` (`scheduled`) and becomes `live` lazily

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-30; FR-31
- TRD test ID / section: DB-10, §15.2, `010_public_room.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: after the public lot closes, the next has `starts_at = closed_at + 15 s` (`scheduled`) and becomes `live` lazily.

## TC-098: DB-10 — `auction_state` of the finished lot returns `next_public_auction_id`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-30; FR-31
- TRD test ID / section: DB-10, §15.2, `010_public_room.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `auction_state` of the finished lot returns `next_public_auction_id`.

## TC-099: DB-10 — public lot defaults (start 1000, 5 minutes, no sandbox)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-30; FR-31
- TRD test ID / section: DB-10, §15.2, `010_public_room.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: public lot defaults (start 1000, 5 minutes, no sandbox).

## TC-100: DB-11 — `auction_state` key set equals the documented list

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-20; FR-25; FR-70
- TRD test ID / section: DB-11, §15.2, `011_reads.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `auction_state` key set equals the documented list.

## TC-101: DB-11 — `null` for stranger on sandbox

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-20; FR-25; FR-70
- TRD test ID / section: DB-11, §15.2, `011_reads.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `null` for stranger on sandbox.

## TC-102: DB-11 — `list_bids` newest page, `cursor`, `after`, `next_cursor` null at the end

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-20; FR-25; FR-70
- TRD test ID / section: DB-11, §15.2, `011_reads.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `list_bids` newest page, `cursor`, `after`, `next_cursor` null at the end.

## TC-103: DB-11 — `get_me` returns active sandbox and only non-expired open offers

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-20; FR-25; FR-70
- TRD test ID / section: DB-11, §15.2, `011_reads.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `get_me` returns active sandbox and only non-expired open offers.

## TC-104: DB-11 — `get_me` of a bot → null

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-20; FR-25; FR-70
- TRD test ID / section: DB-11, §15.2, `011_reads.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `get_me` of a bot → null.

## TC-105: DB-11 — `stats()` counts

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-08; FR-20; FR-25; FR-70
- TRD test ID / section: DB-11, §15.2, `011_reads.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `stats()` counts.

## TC-106: DB-12 — create → accepted, live auction of 2 min at 2000, 3 bots with personas

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: create → accepted, live auction of 2 min at 2000, 3 bots with personas.

## TC-107: DB-12 — second create → `SANDBOX_EXISTS` with same ids

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: second create → `SANDBOX_EXISTS` with same ids.

## TC-108: DB-12 — after the sandbox auction becomes `settled`, a new create succeeds

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: after the sandbox auction becomes `settled`, a new create succeeds.

## TC-109: DB-12 — `max_active_sandboxes = 2` → third owner gets `SANDBOX_CAPACITY`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `max_active_sandboxes = 2` → third owner gets `SANDBOX_CAPACITY`.

## TC-110: DB-12 — IP limit (reset to 5) → 6th → `RATE_LIMITED`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: IP limit (reset to 5) → 6th → `RATE_LIMITED`.

## TC-111: DB-12 — `sandbox_bots` null for non-owner and after expiry

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `sandbox_bots` null for non-owner and after expiry.

## TC-112: DB-12 — `cleanup_expired()` deletes sandboxes that expired before UTC midnight (with all rows), keeps today's, deletes public auctions older than 7 days, deletes idle bidders older than 30 days only when unreferenced

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-40–FR-49
- TRD test ID / section: DB-12, §15.2, `012_sandboxes.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `cleanup_expired()` deletes sandboxes that expired before UTC midnight (with all rows), keeps today's, deletes public auctions older than 7 days, deletes idle bidders older than 30 days only when unreferenced.

## TC-113: DB-13 — create stub `realtime.send` (schema `realtime`, logs calls into a temp table)

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-20; D-19
- TRD test ID / section: DB-13, §15.2, `013_realtime.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: create stub `realtime.send` (schema `realtime`, logs calls into a temp table).

## TC-114: DB-13 — `realtime_mode='broadcast'`: one call per accepted bid with topic `auction:<id>`, event `auction_changed`, payload `version` and `bid.bid_no`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-20; D-19
- TRD test ID / section: DB-13, §15.2, `013_realtime.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `realtime_mode='broadcast'`: one call per accepted bid with topic `auction:<id>`, event `auction_changed`, payload `version` and `bid.bid_no`.

## TC-115: DB-13 — one call per lifecycle transition

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-20; D-19
- TRD test ID / section: DB-13, §15.2, `013_realtime.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: one call per lifecycle transition.

## TC-116: DB-13 — no call on a rejected bid without transition

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-20; D-19
- TRD test ID / section: DB-13, §15.2, `013_realtime.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: no call on a rejected bid without transition.

## TC-117: DB-13 — stub that raises → bid still accepted

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-20; D-19
- TRD test ID / section: DB-13, §15.2, `013_realtime.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: stub that raises → bid still accepted.

## TC-118: DB-13 — `realtime_mode='none'` → no calls

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-20; D-19
- TRD test ID / section: DB-13, §15.2, `013_realtime.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `realtime_mode='none'` → no calls.

## TC-119: DB-14 — event sequence for a full lifecycle (created, started, bid_accepted ×n, auction_extended, auction_closed, offer_opened, offer_expired, strike_recorded, offer_opened, offer_paid) in order with correct bidder ids

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: INV-13
- TRD test ID / section: DB-14, §15.2, `014_audit.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: event sequence for a full lifecycle (created, started, bid_accepted ×n, auction_extended, auction_closed, offer_opened, offer_expired, strike_recorded, offer_opened, offer_paid) in order with correct bidder ids.

## TC-120: DB-15 — `create_test_auction` and `set_test_clock` work when env=test

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-52
- TRD test ID / section: DB-15, §15.2, `015_test_support.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: `create_test_auction` and `set_test_clock` work when env=test.

## TC-121: DB-15 — with env=prod both throw `BLK30`

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-52
- TRD test ID / section: DB-15, §15.2, `015_test_support.test.sql`
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset with migrations for the owning task; test environment; own records.
- Steps: Arrange the inputs and clock described in the title; execute the specified database operation and inspect its result and persisted rows.
- Expected result: with env=prod both throw `BLK30`.

## TC-122: INT-01 — 500 parallel bids from 200 bidders preserve all eight assertions in TRD §15.3, including at least 20 accepted bids

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-91; INV-01–INV-13
- TRD test ID / section: INT-01, §15.3–15.4
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset; own data and connections.
- Steps: Execute the specified scenario and compare every outcome, count, event and invariant to TRD §15.3–15.4.
- Expected result: 500 parallel bids from 200 bidders preserve all eight assertions in TRD §15.3, including at least 20 accepted bids.

## TC-123: INT-02 — Each of the eight locking, idempotency, payment, public-room and sandbox races in TRD §15.3 returns its specified result

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-91; FR-04; FR-08; FR-11
- TRD test ID / section: INT-02, §15.3–15.4
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset; own data and connections.
- Steps: Execute the specified scenario and compare every outcome, count, event and invariant to TRD §15.3–15.4.
- Expected result: Each of the eight locking, idempotency, payment, public-room and sandbox races in TRD §15.3 returns its specified result.

## TC-124: INT-03 — SQL increment bands deep-equal INCREMENT_BANDS

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-03
- TRD test ID / section: INT-03, §15.3–15.4
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset; own data and connections.
- Steps: Execute the specified scenario and compare every outcome, count, event and invariant to TRD §15.3–15.4.
- Expected result: SQL increment bands deep-equal INCREMENT_BANDS.

## TC-125: UT-02 — Band boundaries, minimum next bid and clamped deduplicated quick amounts match TRD §15.4

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: FR-03
- TRD test ID / section: UT-02, §15.3–15.4
- Priority: Critical
- Automatable: yes
- Preconditions: Local test database reset; own data and connections.
- Steps: Execute the specified scenario and compare every outcome, count, event and invariant to TRD §15.3–15.4.
- Expected result: Band boundaries, minimum next bid and clamped deduplicated quick amounts match TRD §15.4.

## TC-126: Environment overrides before and after rate-limit migration

- Milestone: M1 — Schema, functions, pgTAP
- PRD / acceptance reference: D-46; T-05 acceptance
- TRD test ID / section: TRD §8.4, owner-approved staged environment setup
- Priority: High
- Automatable: yes
- Preconditions: Disposable local scratch database with foundation only.
- Steps: Apply test and load environments without a rate-limit table; create a fixture rate-limit table and apply each environment again.
- Expected result: Setup succeeds without the table; test mode and app login are configured; with the table present, test overrides become 10000 and load overrides become 1000000 for the specified limits only.

# M2 — API, identity and rate limits

All cases use local test data; HTTP integration calls precede the Playwright harness scheduled for T-33.

| TC     | Task | Requirement    | Behavior                                                               | Priority | Automatable |
| ------ | ---- | -------------- | ---------------------------------------------------------------------- | -------- | ----------- |
| TC-127 | T-18 | NFR-41; NFR-42 | Database function wrappers parse all app-callable results              | High     | yes         |
| TC-128 | T-18 | NFR-41; FR-51  | SQL integer and response boundaries reject unsafe or unexpected values | High     | yes         |
| TC-129 | T-19 | FR-36; FR-51   | Demo gates precede Origin and parsing                                  | High     | yes         |
| TC-130 | T-19 | FR-85          | Mutating Origin validation                                             | High     | yes         |
| TC-131 | T-19 | FR-51          | JSON media type and body limit                                         | High     | yes         |
| TC-132 | T-19 | FR-51          | Params and query boundaries                                            | High     | yes         |
| TC-133 | T-19 | FR-81          | Request ids and structured request log                                 | High     | yes         |
| TC-134 | T-19 | FR-51          | Errors map to documented envelope                                      | High     | yes         |
| TC-135 | T-20 | FR-20          | Signed session round trip                                              | High     | yes         |
| TC-136 | T-20 | FR-20          | Session rejects tampering and malformed fields                         | High     | yes         |
| TC-137 | T-20 | FR-20; D-35    | Session time bounds                                                    | High     | yes         |
| TC-138 | T-20 | FR-20          | Session rotation and sliding renewal                                   | High     | yes         |
| TC-139 | T-20 | FR-22          | Name normalization                                                     | High     | yes         |
| TC-140 | T-20 | FR-22          | Name length and character validation                                   | High     | yes         |
| TC-141 | T-20 | FR-22          | Human names cannot impersonate bots                                    | High     | yes         |
| TC-142 | T-20 | FR-22          | Profanity normalization                                                | High     | yes         |
| TC-143 | T-20 | FR-20; FR-21   | Guest creation and cookie attributes                                   | High     | yes         |
| TC-144 | T-20 | FR-24          | Deleted guest recovery                                                 | High     | yes         |
| TC-145 | T-20 | FR-22; FR-50   | Rename authenticated guest                                             | High     | yes         |
| TC-146 | T-20 | FR-25          | Guest creation limit maps to HTTP                                      | High     | yes         |
| TC-147 | T-21 | FR-37          | Proxy trust and XFF selection                                          | High     | yes         |
| TC-148 | T-21 | FR-37          | IPv6 privacy prefix                                                    | High     | yes         |
| TC-149 | T-21 | FR-37; NFR-30  | Salted IP hash shape                                                   | High     | yes         |
| TC-150 | T-22 | FR-46; FR-50   | State response and conditional ETag                                    | High     | yes         |
| TC-151 | T-22 | FR-50          | State not-found and sandbox visibility                                 | High     | yes         |
| TC-152 | T-22 | FR-50          | Bid pagination                                                         | High     | yes         |
| TC-153 | T-22 | FR-50          | Lobby response                                                         | High     | yes         |
| TC-154 | T-23 | FR-04; FR-50   | Accepted bid and replay HTTP mapping                                   | High     | yes         |
| TC-155 | T-23 | FR-50; FR-51   | Bid rejection details                                                  | High     | yes         |
| TC-156 | T-23 | FR-04          | Idempotency mismatch HTTP mapping                                      | High     | yes         |
| TC-157 | T-23 | FR-37          | Bid rate-limit HTTP mapping                                            | High     | yes         |
| TC-158 | T-23 | FR-11          | Payment success and rejection                                          | High     | yes         |
| TC-159 | T-23 | FR-20; FR-50   | Mutation authentication                                                | High     | yes         |
| TC-160 | T-24 | FR-52; D-40    | Disabled test routes are indistinguishable from unknown paths          | High     | yes         |
| TC-161 | T-24 | FR-52          | Authorized test support                                                | High     | yes         |
| TC-162 | T-24 | FR-82          | Health success and failure                                             | High     | yes         |
| TC-163 | T-24 | FR-52          | Static test-route guard                                                | High     | yes         |
| TC-164 | T-25 | FR-86; FR-87   | Nonce CSP construction                                                 | High     | yes         |
| TC-165 | T-25 | FR-86          | CSP forwarded on request and response                                  | High     | yes         |
| TC-166 | T-25 | FR-36          | Off mode page rewrite                                                  | High     | yes         |
| TC-167 | T-25 | FR-86; FR-87   | Production build nonce application                                     | High     | yes         |

## TC-127: Database function wrappers parse all app-callable results

- Milestone: M2 — API, identity and rate limits
- Task: T-18
- PRD / acceptance reference: NFR-41; NFR-42
- TRD test ID / section: Repo integration §6.2/§10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call identity, reads, bid, pay, rate, sandbox, stats and test-support functions using own fixtures.
- Expected result: Each result satisfies its strict schema; SQL Dates become ISO strings and nullable results stay null.

## TC-128: SQL integer and response boundaries reject unsafe or unexpected values

- Milestone: M2 — API, identity and rate limits
- Task: T-18
- PRD / acceptance reference: NFR-41; FR-51
- TRD test ID / section: Repo integration §6.2/§10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Parse safe and unsafe int8 values and malformed nested response fixtures.
- Expected result: Safe integers survive; unsafe money, extra keys and malformed timestamps fail validation.

## TC-129: Demo gates precede Origin and parsing

- Milestone: M2 — API, identity and rate limits
- Task: T-19
- PRD / acceptance reference: FR-36; FR-51
- TRD test ID / section: UT-13
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call mutating route with off/readonly modes and invalid Origin/body.
- Expected result: 503 DEMO_OFF or DEMO_READONLY wins; health is exempt from off.

## TC-130: Mutating Origin validation

- Milestone: M2 — API, identity and rate limits
- Task: T-19
- PRD / acceptance reference: FR-85
- TRD test ID / section: UT-13
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call with allowed, missing, null and foreign Origin.
- Expected result: Allowed normalized origin proceeds; all other cases return 403.

## TC-131: JSON media type and body limit

- Milestone: M2 — API, identity and rate limits
- Task: T-19
- PRD / acceptance reference: FR-51
- TRD test ID / section: UT-13
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Send wrong media type, declared or actual body over 4096 bytes, malformed JSON and extra fields.
- Expected result: 415, 413, 413, 400 and 400 respectively; valid strict JSON proceeds.

## TC-132: Params and query boundaries

- Milestone: M2 — API, identity and rate limits
- Task: T-19
- PRD / acceptance reference: FR-51
- TRD test ID / section: UT-13
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Send invalid UUID and unknown query fields to schema-configured routes.
- Expected result: 400 VALIDATION with issue paths; handler never runs.

## TC-133: Request ids and structured request log

- Milestone: M2 — API, identity and rate limits
- Task: T-19
- PRD / acceptance reference: FR-81
- TRD test ID / section: UT-13
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call success and error paths with valid/invalid x-request-id.
- Expected result: Valid UUID reused; otherwise generated; standard API headers and one request log contain specified fields.

## TC-134: Errors map to documented envelope

- Milestone: M2 — API, identity and rate limits
- Task: T-19
- PRD / acceptance reference: FR-51
- TRD test ID / section: UT-13; UT-09
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Throw AppError and unexpected SQL error from wrapped handlers.
- Expected result: Specified status or 500 INTERNAL; no stack or secret in response; SQLSTATE logged server-side.

## TC-135: Signed session round trip

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-20
- TRD test ID / section: UT-05
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Sign and verify a bidder UUID at fixed time.
- Expected result: Verified identity and issue time match; cookie attributes match §13.1.

## TC-136: Session rejects tampering and malformed fields

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-20
- TRD test ID / section: UT-05
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Alter UUID, timestamp, signature, prefix and part count.
- Expected result: Every altered or malformed cookie yields no session.

## TC-137: Session time bounds

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-20; D-35
- TRD test ID / section: UT-05
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Verify future timestamps beyond 300 seconds and ages beyond 400 days, plus boundaries.
- Expected result: Outside bounds rejected; boundaries accepted.

## TC-138: Session rotation and sliding renewal

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-20
- TRD test ID / section: UT-05
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Verify previous-secret cookie and cookie older than 30 days.
- Expected result: Valid identities retained and marked for reissue; fresh current-secret cookie not renewed.

## TC-139: Name normalization

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-22
- TRD test ID / section: UT-08
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Normalize decomposed Unicode and surrounding/repeated whitespace.
- Expected result: NFC, trimmed, single spaces.

## TC-140: Name length and character validation

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-22
- TRD test ID / section: UT-08
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Test code-point lengths 1,2,24,25 and allowed Unicode versus forbidden characters.
- Expected result: 2–24 allowed code points accepted; correct first failing reason returned.

## TC-141: Human names cannot impersonate bots

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-22
- TRD test ID / section: UT-08
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Validate Robot and Botanist after normalization.
- Expected result: Robot rejected as bot_suffix; Botanist accepted.

## TC-142: Profanity normalization

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-22
- TRD test ID / section: UT-08
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Validate profane word, leet sh1t and separator-obfuscated forms.
- Expected result: Rejected as profanity after documented lowercasing, de-leeting and separator removal.

## TC-143: Guest creation and cookie attributes

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-20; FR-21
- TRD test ID / section: T-20 acceptance; §10.2
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: GET /api/me with no cookie; repeat with returned cookie.
- Expected result: 200 Me, default Bidder NNNN and specified Set-Cookie; second call reuses identity.

## TC-144: Deleted guest recovery

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-24
- TRD test ID / section: §10.2; T-20 acceptance
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Create then delete own unreferenced bidder and call GET /api/me with its valid cookie.
- Expected result: New bidder and replacement cookie, 200 Me.

## TC-145: Rename authenticated guest

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-22; FR-50
- TRD test ID / section: §10.3; UT-08
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: PATCH normalized valid name, then invalid name and unknown body field.
- Expected result: 200 updated Me; 422 NAME_INVALID with reason; 400 for shape error.

## TC-146: Guest creation limit maps to HTTP

- Milestone: M2 — API, identity and rate limits
- Task: T-20
- PRD / acceptance reference: FR-25
- TRD test ID / section: §10.2; DB-09
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Exhaust own test IP guest counter then request new identity.
- Expected result: 429 RATE_LIMITED and Retry-After; no new identity.

## TC-147: Proxy trust and XFF selection

- Milestone: M2 — API, identity and rate limits
- Task: T-21
- PRD / acceptance reference: FR-37
- TRD test ID / section: UT-10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Use none/vercel modes with comma-separated XFF and spaces.
- Expected result: None returns local; vercel takes first trimmed address.

## TC-148: IPv6 privacy prefix

- Milestone: M2 — API, identity and rate limits
- Task: T-21
- PRD / acceptance reference: FR-37
- TRD test ID / section: UT-10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Hash addresses sharing /64 and different prefixes, plus IPv4.
- Expected result: Same /64 has same hash; different prefixes differ; IPv4 kept whole before hashing.

## TC-149: Salted IP hash shape

- Milestone: M2 — API, identity and rate limits
- Task: T-21
- PRD / acceptance reference: FR-37; NFR-30
- TRD test ID / section: UT-10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Hash same synthetic input repeatedly with configured salt.
- Expected result: Stable 32 lowercase hex characters; raw address is not persisted or logged.

## TC-150: State response and conditional ETag

- Milestone: M2 — API, identity and rate limits
- Task: T-22
- PRD / acceptance reference: FR-46; FR-50
- TRD test ID / section: API read integration; §10.4
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Read own test auction then repeat with returned ETag.
- Expected result: 200 strict AuctionState followed by bodyless 304; ETag includes version and next-public prefix.

## TC-151: State not-found and sandbox visibility

- Milestone: M2 — API, identity and rate limits
- Task: T-22
- PRD / acceptance reference: FR-50
- TRD test ID / section: API read integration; §10.4
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Read missing auction and another owner sandbox.
- Expected result: 404 NOT_FOUND for both; owner can read sandbox.

## TC-152: Bid pagination

- Milestone: M2 — API, identity and rate limits
- Task: T-22
- PRD / acceptance reference: FR-50
- TRD test ID / section: API read integration; §10.5
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Seed own bids and read newest, cursor and after pages; submit both cursor and after.
- Expected result: Strict ordered BidsPage with correct next_cursor; exclusive query violation returns 400.

## TC-153: Lobby response

- Milestone: M2 — API, identity and rate limits
- Task: T-22
- PRD / acceptance reference: FR-50
- TRD test ID / section: API read integration; §10.10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: GET auctions anonymously and as sandbox owner.
- Expected result: Public state always present; only owner receives active sandbox; response parses strictly.

## TC-154: Accepted bid and replay HTTP mapping

- Milestone: M2 — API, identity and rate limits
- Task: T-23
- PRD / acceptance reference: FR-04; FR-50
- TRD test ID / section: API write integration; §10.6
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Submit valid bid twice with same key and amount.
- Expected result: 201 then 200; second has Idempotent-Replayed true; same bid and replayed result.

## TC-155: Bid rejection details

- Milestone: M2 — API, identity and rate limits
- Task: T-23
- PRD / acceptance reference: FR-50; FR-51
- TRD test ID / section: API write integration; §10.6
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Submit stale low amount then amount above SQL max.
- Expected result: 409 BID_TOO_LOW with min_next_bid; 422 BID_TOO_HIGH; strict documented details.

## TC-156: Idempotency mismatch HTTP mapping

- Milestone: M2 — API, identity and rate limits
- Task: T-23
- PRD / acceptance reference: FR-04
- TRD test ID / section: API write integration; §10.6
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Reuse accepted key with changed amount.
- Expected result: 422 IDEMPOTENCY_MISMATCH; no extra bid.

## TC-157: Bid rate-limit HTTP mapping

- Milestone: M2 — API, identity and rate limits
- Task: T-23
- PRD / acceptance reference: FR-37
- TRD test ID / section: API write integration; §10.6
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Exhaust own bidder rate counter and submit next bid.
- Expected result: 429 RATE_LIMITED with retry_after_ms and rounded-up Retry-After seconds.

## TC-158: Payment success and rejection

- Milestone: M2 — API, identity and rate limits
- Task: T-23
- PRD / acceptance reference: FR-11
- TRD test ID / section: API write integration; §10.7
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Close own auction, pay as winner and repeat; attempt non-payable payment.
- Expected result: 200 settled response including replay flag; non-payable returns 409.

## TC-159: Mutation authentication

- Milestone: M2 — API, identity and rate limits
- Task: T-23
- PRD / acceptance reference: FR-20; FR-50
- TRD test ID / section: §10.1; T-23
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Submit without session and with bot token before T-34 implementation.
- Expected result: 401 NO_SESSION or BOT_TOKEN_INVALID; no bid created.

## TC-160: Disabled test routes are indistinguishable from unknown paths

- Milestone: M2 — API, identity and rate limits
- Task: T-24
- PRD / acceptance reference: FR-52; D-40
- TRD test ID / section: API test routes integration
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call test clock and catch-all in development or wrong secret under on/readonly/off.
- Expected result: Same 404 envelope ignoring request_id and same content-type; gate runs before demo mode.

## TC-161: Authorized test support

- Milestone: M2 — API, identity and rate limits
- Task: T-24
- PRD / acceptance reference: FR-52
- TRD test ID / section: API test routes integration; §10.13
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Use correct secret in test env to create auction, set clock and reset clock in finally.
- Expected result: 201 auction id; strict server_now responses; no Origin required; ranges validated.

## TC-162: Health success and failure

- Milestone: M2 — API, identity and rate limits
- Task: T-24
- PRD / acceptance reference: FR-82
- TRD test ID / section: API test routes integration; §10.11
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call health with reachable DB and injected DB failure, including off mode.
- Expected result: 200 ok or 503 degraded with no-store; health bypasses demo gates.

## TC-163: Static test-route guard

- Milestone: M2 — API, identity and rate limits
- Task: T-24
- PRD / acceptance reference: FR-52
- TRD test ID / section: T-24 acceptance; §13.8
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Run guards and exercise detection of an unguarded test handler fixture.
- Expected result: Every exported test handler requires testOnly true; unguarded fixture is rejected.

## TC-164: Nonce CSP construction

- Milestone: M2 — API, identity and rate limits
- Task: T-25
- PRD / acceptance reference: FR-86; FR-87
- TRD test ID / section: UT-14
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Generate headers in production/development with and without Supabase URL.
- Expected result: Nonce and required directives; unsafe-eval only development; optional HTTPS/WSS host; security headers match §13.4.

## TC-165: CSP forwarded on request and response

- Milestone: M2 — API, identity and rate limits
- Task: T-25
- PRD / acceptance reference: FR-86
- TRD test ID / section: UT-14
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Call proxy and inspect forwarded and response CSP headers.
- Expected result: Same nonce-bearing CSP forwarded to Next and returned; x-nonce available for rendering.

## TC-166: Off mode page rewrite

- Milestone: M2 — API, identity and rate limits
- Task: T-25
- PRD / acceptance reference: FR-36
- TRD test ID / section: UT-14
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Request page in off mode.
- Expected result: Rewrites to /offline; API paths excluded from proxy matcher.

## TC-167: Production build nonce application

- Milestone: M2 — API, identity and rate limits
- Task: T-25
- PRD / acceptance reference: FR-86; FR-87
- TRD test ID / section: T-25 acceptance; A-10
- Priority: High
- Automatable: yes
- Preconditions: Local test database; unique owned fixtures; controlled environment restored after test.
- Steps: Build, start locally and request HTML and headers.
- Expected result: CSP contains nonce and frame-ancestors none; at least one Next script contains matching nonce.
