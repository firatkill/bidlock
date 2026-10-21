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

## TC-168: Session route authentication checks signatures and existing bidder identity

- Milestone: M2 — API, identity and rate limits
- Task: T-19 (D-51 prerequisite)
- PRD / acceptance reference: FR-20; FR-51
- TRD test ID / section: §10.1 step 6; UT-05 integration with wrapper
- Priority: Critical
- Automatable: yes
- Preconditions: Valid signed fixture cookie, mocked existing/deleted bidder lookup.
- Steps: Call required and optional session routes with valid, tampered, missing and deleted identities; call bot path before T-34.
- Expected result: Existing verified identity attaches to context; required missing/invalid/deleted identity returns 401 NO_SESSION; optional invalid identity remains anonymous; bot path returns 401 BOT_TOKEN_INVALID until T-34.

## TC-169: Rate-limited HTTP responses round Retry-After up to seconds

- Milestone: M2 — API, identity and rate limits
- Task: T-21
- PRD / acceptance reference: FR-37; FR-51
- TRD test ID / section: §10.6; T-21 acceptance
- Priority: High
- Automatable: yes
- Preconditions: Wrapped handler raises RATE_LIMITED with known retry_after_ms.
- Steps: Return retry delays of 1, 1000 and 1001 milliseconds.
- Expected result: Status 429, Retry-After 1, 1 and 2 seconds respectively; exact retry_after_ms retained in details.

# M3 — UI and real-time

Cases designed from PRD §9, TRD §11/§15 and T-26–T-33 before implementation.

| Case   | Task | Reference                  | Title                                                | Priority | Automatable |
| ------ | ---- | -------------------------- | ---------------------------------------------------- | -------- | ----------- |
| TC-170 | T-26 | FR-68; FR-72; FR-73        | Shell identity and navigation                        | High     | yes         |
| TC-171 | T-26 | FR-68; FR-22               | Name dialog validation and save                      | High     | yes         |
| TC-172 | T-26 | FR-72; FR-86               | Theme persistence and nonce                          | High     | yes         |
| TC-173 | T-26 | FR-36; FR-73               | Shell read-only and error states                     | High     | yes         |
| TC-174 | T-26 | NFR-20; NFR-22             | Shell visual and keyboard review                     | High     | no          |
| TC-175 | T-27 | NFR-41                     | Integer money formatting                             | High     | yes         |
| TC-176 | T-27 | NFR-41; FR-63              | Dollar input acceptance and rejection                | High     | yes         |
| TC-177 | T-27 | FR-40; FR-41               | Clock samples and countdown                          | High     | yes         |
| TC-178 | T-27 | FR-47                      | Snapshot and change ordering                         | High     | yes         |
| TC-179 | T-27 | FR-47; FR-07               | Bid reconciliation and extensions                    | High     | yes         |
| TC-180 | T-27 | NFR-21                     | Live announcement throttling                         | High     | yes         |
| TC-181 | T-28 | FR-46; FR-47               | Polling snapshots and ETags                          | High     | yes         |
| TC-182 | T-28 | FR-48                      | Polling failure and recovery                         | High     | yes         |
| TC-183 | T-28 | FR-46; FR-48               | Polling visibility and terminal behavior             | High     | yes         |
| TC-184 | T-29 | FR-61; FR-62               | Lot and price states                                 | High     | yes         |
| TC-185 | T-29 | FR-40; FR-64               | Countdown conditions                                 | High     | yes         |
| TC-186 | T-29 | FR-65                      | Extension banner lifecycle                           | High     | yes         |
| TC-187 | T-29 | FR-67                      | Connection and load states                           | High     | yes         |
| TC-188 | T-30 | FR-63; NFR-41              | Quick and custom bidding                             | High     | yes         |
| TC-189 | T-30 | FR-71                      | Bid keyboard shortcuts                               | High     | yes         |
| TC-190 | T-30 | FR-63; US-05               | Bid failure copy and retry identity                  | High     | yes         |
| TC-191 | T-30 | FR-63; FR-37               | Stale minimum and rate countdown                     | High     | yes         |
| TC-192 | T-30 | FR-64; FR-67               | Bid panel state gates                                | High     | yes         |
| TC-193 | T-30 | FR-47                      | Bid history paging and labels                        | High     | yes         |
| TC-194 | T-31 | FR-45; FR-48               | Broadcast subscription and validation                | High     | yes         |
| TC-195 | T-31 | FR-48                      | Broadcast fallback and safety refresh                | High     | yes         |
| TC-196 | T-31 | FR-46; D-19                | Lazy broadcast module loading                        | High     | yes         |
| TC-197 | T-32 | FR-60; US-01               | Public room lobby states                             | High     | yes         |
| TC-198 | T-32 | FR-60; US-03               | Sandbox card states                                  | High     | yes         |
| TC-199 | T-32 | FR-60; FR-11               | Offer notices and benchmark content                  | High     | yes         |
| TC-200 | T-32 | FR-60; D-30                | Lobby feed handoff                                   | High     | yes         |
| TC-201 | T-33 | FR-20; FR-51; FR-52; FR-85 | HTTP browser-context contract                        | High     | yes         |
| TC-202 | T-33 | US-02; US-04; FR-63        | Two bidders stay synchronized                        | High     | yes         |
| TC-203 | T-33 | NFR-20; NFR-22             | Automated accessibility and keyboard                 | High     | yes         |
| TC-204 | T-33 | NFR-23; FR-46              | Mobile overflow reduced motion and polling transport | High     | yes         |
| TC-205 | T-33 | FR-37; FR-67               | Rate-limited and scheduled browser states            | High     | yes         |
| TC-206 | T-33 | NFR-15                     | Production initial script budget                     | High     | yes         |
| TC-207 | T-33 | FR-92                      | E2E project isolation and CI                         | High     | yes         |
| TC-208 | T-33 | FR-40; FR-45; NFR-20       | Live two-browser countdown and mobile review         | High     | no          |

## TC-170: Shell identity and navigation

- Milestone: M3 — UI and real-time
- Task: T-26
- PRD / acceptance reference: FR-68; FR-72; FR-73
- TRD test ID / section: §9.1; §11.2
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render loading profile then named profile with zero, one and two strikes.
- Expected result: Exact nav, footer, loading label and pluralized missed-payment copy; edit opens the labeled dialog.

## TC-171: Name dialog validation and save

- Milestone: M3 — UI and real-time
- Task: T-26
- PRD / acceptance reference: FR-68; FR-22
- TRD test ID / section: §9.1; §13.9
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Submit each invalid-name category; submit a valid name; inject server failure.
- Expected result: Exact length/characters/profanity/bot errors; pending state; success closes and announces for 3 s; server error remains visible.

## TC-172: Theme persistence and nonce

- Milestone: M3 — UI and real-time
- Task: T-26
- PRD / acceptance reference: FR-72; FR-86
- TRD test ID / section: §11.2; UT-14
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Cycle system/light/dark; reload with saved preference; inspect theme script.
- Expected result: Correct aria label, persisted bl_theme, before-paint data-theme, CSP nonce present.

## TC-173: Shell read-only and error states

- Milestone: M3 — UI and real-time
- Task: T-26
- PRD / acceptance reference: FR-36; FR-73
- TRD test ID / section: §9.1
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render readonly, not-found and unhandled-error views.
- Expected result: Exact banners/headings/actions; error view includes logged request id.

## TC-174: Shell visual and keyboard review

- Milestone: M3 — UI and real-time
- Task: T-26
- PRD / acceptance reference: NFR-20; NFR-22
- TRD test ID / section: T-26 acceptance; §11.2
- Priority: High
- Automatable: no
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Inspect 360 px and 1280 px screenshots in light/dark; keyboard open/save/cancel dialog.
- Expected result: Specified fonts/tokens, no horizontal overflow, visible focus, accessible labels and focus return.

## TC-175: Integer money formatting

- Milestone: M3 — UI and real-time
- Task: T-27
- PRD / acceptance reference: NFR-41
- TRD test ID / section: UT-01; §11.8
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Format the four UT-01 amounts.
- Expected result: Exact en-US dollar output with two decimals.

## TC-176: Dollar input acceptance and rejection

- Milestone: M3 — UI and real-time
- Task: T-27
- PRD / acceptance reference: NFR-41; FR-63
- TRD test ID / section: UT-01; §11.8
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Parse integers, one/two decimals, grouping and dollar prefix; try negatives, exponent, empty, excess decimals and over-limit values.
- Expected result: Accepted inputs produce integer cents; invalid syntax and decimals produce their specified errors.

## TC-177: Clock samples and countdown

- Milestone: M3 — UI and real-time
- Task: T-27
- PRD / acceptance reference: FR-40; FR-41
- TRD test ID / section: UT-03; §11.6
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Apply symmetric RTT samples, outliers and nine samples; format boundary durations.
- Expected result: Lowest RTT of last eight wins; invalid RTT ignored; ceil formatting never negative.

## TC-178: Snapshot and change ordering

- Milestone: M3 — UI and real-time
- Task: T-27
- PRD / acceptance reference: FR-47
- TRD test ID / section: UT-04; §11.7
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Apply old/equal/new snapshots and stale/consecutive/gapped changes.
- Expected result: Specified version policy, derived values, gap and lifecycle refetch flags.

## TC-179: Bid reconciliation and extensions

- Milestone: M3 — UI and real-time
- Task: T-27
- PRD / acceptance reference: FR-47; FR-07
- TRD test ID / section: UT-04; §11.7
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Apply duplicate and gapped bid events and more than 100 bids; increase extension count.
- Expected result: Unique newest-first rows capped at 100; correct lastBidNo and pending gaps; 30000 ms extension duration.

## TC-180: Live announcement throttling

- Milestone: M3 — UI and real-time
- Task: T-27
- PRD / acceptance reference: NFR-21
- TRD test ID / section: UT-11; §11.8
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Send price updates within 3 s and duplicate assertive event ids.
- Expected result: Latest polite value at most once per 3 s; assertive event announced once.

## TC-181: Polling snapshots and ETags

- Milestone: M3 — UI and real-time
- Task: T-28
- PRD / acceptance reference: FR-46; FR-47
- TRD test ID / section: §11.4
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Return 200 with ETag, then 304; return bid_count gap with full bid pages.
- Expected result: ETag reused; 304 emits nothing; missing bids fetched until page smaller than 50.

## TC-182: Polling failure and recovery

- Milestone: M3 — UI and real-time
- Task: T-28
- PRD / acceptance reference: FR-48
- TRD test ID / section: §11.4
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Fail twice then succeed using fake timers.
- Expected result: Reconnecting after two failures, exponential backoff capped at 10 s, live after success.

## TC-183: Polling visibility and terminal behavior

- Milestone: M3 — UI and real-time
- Task: T-28
- PRD / acceptance reference: FR-46; FR-48
- TRD test ID / section: §11.4
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Hide/show document; emit terminal private/public states; unsubscribe.
- Expected result: Hidden polling stops, visible fetch immediate; terminal grace 10 s; public polls 5 s until next id; unsubscribe cleans up.

## TC-184: Lot and price states

- Milestone: M3 — UI and real-time
- Task: T-29
- PRD / acceptance reference: FR-61; FR-62
- TRD test ID / section: §9.3; T-29 acceptance
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render no bids, other leader, bot leader and viewer leader.
- Expected result: Exact lot, price, meta and leader strings with accessible decorative placeholder.

## TC-185: Countdown conditions

- Milestone: M3 — UI and real-time
- Task: T-29
- PRD / acceptance reference: FR-40; FR-64
- TRD test ID / section: §9.3; §11.6
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render scheduled, live, warning, soft-close, capped and zero-time states.
- Expected result: Correct copy and warning styling; zero displays Closing and waits for server.

## TC-186: Extension banner lifecycle

- Milestone: M3 — UI and real-time
- Task: T-29
- PRD / acceptance reference: FR-65
- TRD test ID / section: §9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Emit an extension then another before five seconds.
- Expected result: Newest banner replaces old, exact duration and extension count, hides after five seconds.

## TC-187: Connection and load states

- Milestone: M3 — UI and real-time
- Task: T-29
- PRD / acceptance reference: FR-67
- TRD test ID / section: §9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render initial loading, reconnecting/recovered, not-found and load-error.
- Expected result: Exact copy; Back online lasts two seconds; load error retry three seconds.

## TC-188: Quick and custom bidding

- Milestone: M3 — UI and real-time
- Task: T-30
- PRD / acceptance reference: FR-63; NFR-41
- TRD test ID / section: §11.8; §9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Click quick amounts and submit valid/invalid dollar input.
- Expected result: Correct integer amounts, specified quick labels, validation copy, pending controls disabled.

## TC-189: Bid keyboard shortcuts

- Milestone: M3 — UI and real-time
- Task: T-30
- PRD / acceptance reference: FR-71
- TRD test ID / section: §11.8
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Press 1/2/3, modified keys, keys within inputs/contenteditable and while dialog open; Enter custom field.
- Expected result: Only permitted shortcuts submit; Enter submits custom bid.

## TC-190: Bid failure copy and retry identity

- Milestone: M3 — UI and real-time
- Task: T-30
- PRD / acceptance reference: FR-63; US-05
- TRD test ID / section: §9.3; §11.8
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Return each documented bid error, network failure and 5xx; click Retry.
- Expected result: Exact error copy; retry keeps key and amount; definitive responses clear pending bid; mismatch next action gets new key.

## TC-191: Stale minimum and rate countdown

- Milestone: M3 — UI and real-time
- Task: T-30
- PRD / acceptance reference: FR-63; FR-37
- TRD test ID / section: §9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Return BID_TOO_LOW details and RATE_LIMITED retry time.
- Expected result: Quick amounts update to minimum; controls disabled through retry window with countdown copy.

## TC-192: Bid panel state gates

- Milestone: M3 — UI and real-time
- Task: T-30
- PRD / acceptance reference: FR-64; FR-67
- TRD test ID / section: §9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render leading, scheduled, readonly and terminal states; transition viewer to outbid.
- Expected result: Specified disabling and notes; outbid assertive message; terminal bid controls absent.

## TC-193: Bid history paging and labels

- Milestone: M3 — UI and real-time
- Task: T-30
- PRD / acceptance reference: FR-47
- TRD test ID / section: §9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render empty and bid rows with You/BOT/extension; load earlier page to exhaustion.
- Expected result: Exact row labels, local time, extension tooltip, 20-row page request, button removed when exhausted or 100 rows are visible (approved D-55), max100 rows.

## TC-194: Broadcast subscription and validation

- Milestone: M3 — UI and real-time
- Task: T-31
- PRD / acceptance reference: FR-45; FR-48
- TRD test ID / section: §11.5
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Mock subscribe, payload and reconnect callbacks.
- Expected result: Public auction channel; strict payload validation; subscribed/reconnect refresh; invalid payload refresh.

## TC-195: Broadcast fallback and safety refresh

- Milestone: M3 — UI and real-time
- Task: T-31
- PRD / acceptance reference: FR-48
- TRD test ID / section: §11.5
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Send three errors or wait10s without subscription/recovery; advance15s while live and show hidden tab.
- Expected result: Permanent polling fallback at2000ms; safety and visibility refresh; cleanup unsubscribes.

## TC-196: Lazy broadcast module loading

- Milestone: M3 — UI and real-time
- Task: T-31
- PRD / acceptance reference: FR-46; D-19
- TRD test ID / section: T-31 acceptance
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Create polling feed with module import mocked; create broadcast feed with configured env.
- Expected result: Polling does not import Supabase module; configured broadcast loads dynamically.

## TC-197: Public room lobby states

- Milestone: M3 — UI and real-time
- Task: T-32
- PRD / acceptance reference: FR-60; US-01
- TRD test ID / section: §9.2
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render loading/live/no-bids/with-bids/closing/scheduled/error fixtures.
- Expected result: Exact headline, labels, leader copy, countdown and entry link; error retry3s.

## TC-198: Sandbox card states

- Milestone: M3 — UI and real-time
- Task: T-32
- PRD / acceptance reference: FR-60; US-03
- TRD test ID / section: §9.2; T-32 acceptance
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render default/creating/active/capacity/rate/readonly/error fixtures.
- Expected result: Exact state copy; start disabled until T-36; active return link works.

## TC-199: Offer notices and benchmark content

- Milestone: M3 — UI and real-time
- Task: T-32
- PRD / acceptance reference: FR-60; FR-11
- TRD test ID / section: §9.2
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Render winner/runner-up notices and empty/nonempty benchmark fixtures.
- Expected result: Exact notice, countdown/link and benchmark strings; empty data is honest.

## TC-200: Lobby feed handoff

- Milestone: M3 — UI and real-time
- Task: T-32
- PRD / acceptance reference: FR-60; D-30
- TRD test ID / section: §11.3
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Emit terminal public state or next_public_auction_id.
- Expected result: Refetch list and resubscribe new id; sandbox card uses its own feed.

## TC-201: HTTP browser-context contract

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: FR-20; FR-51; FR-52; FR-85
- TRD test ID / section: E2E-01
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Create unique bidder/auction; inspect cookie; Origin/body errors; replay/mismatch; invalid bot token; disabled test route; state ETag.
- Expected result: Specified statuses, cookie flags, error schemas, replay header and304.

## TC-202: Two bidders stay synchronized

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: US-02; US-04; FR-63
- TRD test ID / section: E2E-02
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Two contexts place quick and keyboard bids then stale custom bid.
- Expected result: Within3s both see price/leader; outbid alert; updated minimum; stale rejection; correct You history rows.

## TC-203: Automated accessibility and keyboard

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: NFR-20; NFR-22
- TRD test ID / section: E2E-07
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Run axe light/dark on lobby and owned test room; Tab to bid and Enter.
- Expected result: Zero serious/critical axe findings; keyboard bid succeeds.

## TC-204: Mobile overflow reduced motion and polling transport

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: NFR-23; FR-46
- TRD test ID / section: E2E-07
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Use360x740 viewport and reducedMotion reduce; visit lobby/room and observe sockets/animations.
- Expected result: No horizontal overflow; no active price animation; no WebSocket in polling build.

## TC-205: Rate-limited and scheduled browser states

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: FR-37; FR-67
- TRD test ID / section: E2E-08
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Exhaust own bidder minute quota with65 rejected bids; click bid; visit missing/scheduled auctions.
- Expected result: Rate countdown disables controls; exact not-found and scheduled copies.

## TC-206: Production initial script budget

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: NFR-15
- TRD test ID / section: E2E-09; D-33
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Load own auction in fresh context and sum encoded script resource sizes.
- Expected result: Initial Next scripts total at most180KiB gzip.

## TC-207: E2E project isolation and CI

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: FR-92
- TRD test ID / section: §15.5; A-08
- Priority: High
- Automatable: yes
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Run parallel then isolated projects with specified timeouts; inspect CI build/e2e.
- Expected result: Four-worker parallel and one-worker isolated supported;90s test/3s expect; CI green.

## TC-208: Live two-browser countdown and mobile review

- Milestone: M3 — UI and real-time
- Task: T-33
- PRD / acceptance reference: FR-40; FR-45; NFR-20
- TRD test ID / section: AGENTS QA workflow
- Priority: High
- Automatable: no
- Preconditions: Local test environment; own unique auction/bidder data; deterministic fixtures or mocked timers where specified. Restore clock and environment after use.
- Steps: Observe own local auction in two browser contexts, countdown through close and360px layout.
- Expected result: Prices update, countdown follows server and awaits result; layout readable with no overlap. Real Supabase delivery remains production verification.

## TC-209: Browser error reporting contains only a confirmed ID

- Milestone: M3 — UI and real-time
- Task: T-26 (D-53)
- PRD / acceptance reference: FR-73; FR-80; FR-85; D-53
- TRD test ID / section: §10.14; §9.1 error copy
- Priority: High
- Automatable: yes
- Preconditions: Local test env; mocked transport for component tests; captured structured logs for route tests.
- Steps: Report a UUID with same-origin JSON; submit unknown fields and missing Origin; mount error view with successful and failed report responses.
- Expected result: Strict ID-only response and log; invalid body rejected; Origin enforced; logged-ID sentence appears only after confirmation; Reload works even when reporting fails.

## TC-210: Client transport validates responses and renews missing sessions once

- Milestone: M3 — UI and real-time
- Task: T-26
- PRD / acceptance reference: FR-24; FR-51
- TRD test ID / section: §10.12 NO_SESSION; §11 client boundary
- Priority: High
- Automatable: yes
- Preconditions: Mock fetch with strict Me/error responses and unique request IDs.
- Steps: Send a request with Headers input; return NO_SESSION then a refreshed Me and success; return a second NO_SESSION; return an unknown response field.
- Expected result: JSON and supplied headers preserved; GET /api/me then exactly one retry; repeated failure surfaces; strict response schemas reject unknown fields.

## TC-211: Bot token signing and lifetime

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-33
- TRD test ID / section: UT-06; §13.2
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Sign claims, verify round trip and test expiry at boundary.
- Expected result: Strict signed claims round trip; expiry is exclusive; mint lifetime is capped by sandbox expiry.

## TC-212: Bot token scope and integrity

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-33; FR-23
- TRD test ID / section: UT-06; §13.2
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Verify with another auction, another owner, altered payload/signature and malformed claims.
- Expected result: All invalid tokens fail closed without throwing.

## TC-213: Sandbox creation and existing room

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-32; US-09
- TRD test ID / section: §10.8; T-34 integration
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Create with an authenticated owner then repeat; send unknown body fields and no session.
- Expected result: 201 strict sandbox details with test seed; repeat 409 with same details; validation 400 and missing session 401.

## TC-214: Sandbox capacity and IP limit

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-35
- TRD test ID / section: §10.8; T-34 integration
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Reach configured active capacity and IP bucket limit using isolated fixtures.
- Expected result: 503 SANDBOX_CAPACITY or 429 RATE_LIMITED with Retry-After; no extra sandbox created.

## TC-215: Bot token issuer ownership

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-33
- TRD test ID / section: §10.9; T-34 integration
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Request tokens as owner and as unrelated bidder; use missing/expired sandbox.
- Expected result: Owner receives exactly three scoped tokens and seed; inaccessible sandbox returns 404.

## TC-216: Bot bidding and owner-cookie binding

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-23; FR-33
- TRD test ID / section: §13.2; T-34 integration
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Bid with issued token and owner cookie; change auction, omit cookie, change owner, tamper token.
- Expected result: Valid bot bid accepted as bot; each invalid request returns 401 BOT_TOKEN_INVALID without bids.

## TC-217: Bot payment authorization

- Milestone: M4 — Sandbox and bots
- Task: T-34
- PRD / acceptance reference: FR-33; D-16
- TRD test ID / section: §13.2; §10.7
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Close sandbox won by bot; pay using issued token and owner cookie.
- Expected result: Payment settles bot winner through same API; invalid owner binding rejected.

## TC-218: Deterministic random sequence and budgets

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: FR-34
- TRD test ID / section: UT-07; §12.1–12.2
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Replay seed and room sequence; inspect persona budgets.
- Expected result: Equal seeds produce equal decisions; budgets follow specified multiplier ranges and integer increment rounding.

## TC-219: Bot pacing and leader protection

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: FR-34
- TRD test ID / section: UT-07; §12
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Exercise first-bid delay, leading state and last-bid timestamps.
- Expected result: No bid while leading; at least 2000ms between bids; waits bounded 1000–6000ms.

## TC-220: Persona phases and budget dropout

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: FR-34
- TRD test ID / section: UT-07; §12.1
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Exercise normal and last-15s phases, sniper opening eligibility, extensions and minimum above budget.
- Expected result: Persona probabilities/amounts obey table; sniper silent except approved opening; over-budget bot drops without bidding.

## TC-221: Bot payment choices and delay

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: D-16
- TRD test ID / section: UT-07; §12
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Run 10000 payment draws per persona and repeat ticks for one offer.
- Expected result: 100/90/60 percent within 2%; draw once per offer; pay after 3–8s only for own open offer.

## TC-222: Runner token startup and shared API

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: FR-33
- TRD test ID / section: §12.2
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Mount owner runner with mocked token API and timers; observe bid requests.
- Expected result: One token fetch; three seeded loops; bot Authorization and new idempotency key per bid; token error copy on failure.

## TC-223: Runner pause and terminal cleanup

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: FR-38; FR-33
- TRD test ID / section: §12.2
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Hide tab, show it, expire token, settle room and unmount.
- Expected result: Loops pause hidden, refresh before resuming and stop on expiry/terminal/unmount.

## TC-224: Runner rejection scheduling

- Milestone: M4 — Sandbox and bots
- Task: T-35
- PRD / acceptance reference: FR-34
- TRD test ID / section: §12.1
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Return BID_TOO_LOW, RATE_LIMITED and AUCTION_CLOSED.
- Expected result: No immediate low-bid retry; rate retry_after_ms honored; closed switches to payment phase.

## TC-225: Sandbox entry and status copy

- Milestone: M4 — Sandbox and bots
- Task: T-36
- PRD / acceptance reference: FR-32; US-09
- TRD test ID / section: E2E-03; PRD §9.2–9.3
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Start sandbox from lobby; test existing, capacity and rate errors.
- Expected result: Navigate to own room or existing room; exact header, three bot chips, notes and error copy; capacity disables Start for 30 seconds.

## TC-226: Seeded sandbox bidding flow

- Milestone: M4 — Sandbox and bots
- Task: T-36
- PRD / acceptance reference: FR-33; FR-34; US-09
- TRD test ID / section: E2E-03
- Priority: High
- Automatable: yes
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Start sandbox, wait at most 15s for BOT row, bid as visitor and inspect timestamps.
- Expected result: Bot bid appears, human leader updates, each bot has at least 2s between accepted bids; pass three repeated local runs.

## TC-227: Sandbox visual and background states

- Milestone: M4 — Sandbox and bots
- Task: T-36
- PRD / acceptance reference: FR-38; NFR-20
- TRD test ID / section: AGENTS QA workflow; PRD §9.3
- Priority: High
- Automatable: no
- Preconditions: Local test database or isolated mocks; unique owners/auctions; restore global settings and clock in finally.
- Steps: Inspect own sandbox at desktop/mobile widths and hide/restore tab.
- Expected result: Readable header and chips; paused note matches tab state; controls do not overlap.
