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
