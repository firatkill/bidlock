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
