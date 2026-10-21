# Bidlock: Implementation Plan

Ordered tasks for building Bidlock end to end. Each task is sized for one focused agent session (roughly 1–4 hours of work) and ends in a state where every listed acceptance command passes. Do tasks in order unless the dependency column allows otherwise.

References: [PRD.md](./PRD.md) (FR, NFR, INV, copy), [TRD.md](./TRD.md) (section numbers below as "TRD §x"), [../AGENTS.md](../AGENTS.md) (rules).

Conventions for every task:

- Work on a branch `t-NN-short-name`; open a PR titled `T-NN: <goal>`; CI must be green before merge.
- "Acceptance" commands must pass locally and in CI. A task is not done until the matching tests exist and pass (AGENTS.md "Definition of done").
- When a task touches SQL, it adds or updates pgTAP tests in the same PR.
- If an assumption from TRD §21 fails, apply its fallback in that task and add a row to PRD §14.

## Overview

| Milestone | Tasks | Exit criteria |
|---|---|---|
| M0 Setup | T-01..T-04 | Tooling, Docker Postgres, migration runner, CI static job |
| M1 Schema + functions + pgTAP | T-05..T-17 | All SQL from TRD §6–§8 with DB-01..DB-15 and INT-01..INT-03 green |
| M2 API + identity + rate limits | T-18..T-25 | All routes with Zod contracts, cookies, Origin check, CSP, health |
| M3 UI + realtime | T-26..T-33 | Lobby, room, feeds, two-context e2e |
| M4 Sandbox + bots | T-34..T-36 | Sandboxes, bot tokens, client bots, seeded e2e |
| M5 Settlement | T-37..T-38 | Payment, runner-up, unsold UI, clock-based e2e |
| M6 Load test + CI + bench page | T-39..T-44 | Compose, k6, verification, load workflow, `/how-it-works` |
| M7 Polish + deploy | T-45..T-48 | Production live, README, release checklist |

---

## M0 Setup

### T-01 Repository, tooling and CI skeleton

- Goal: an empty but complete Next.js project with strict tooling and a green CI `static` job.
- Files: `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore`, `.env.example`, `LICENSE`, `README.md` (stub), `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `prettier.config.mjs`, `postcss.config.mjs`, `components.json`, `vitest.config.ts` (with the `server-only` alias, D-36), `tests/stubs/server-only.ts`, `public/robots.txt`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder "Bidlock"), `src/app/globals.css`, `tests/unit/smoke.test.ts`, `.github/workflows/ci.yml` (only the `static` job for now), `scripts/check-guards.ts` (skeleton that passes).
- Steps:
  1. `pnpm create next-app@latest` equivalent setup by hand: App Router, TypeScript, Tailwind 4, ESLint, `src/` dir, alias `@/*`. Do not run `git init` if the repo already exists.
  2. Resolve current versions per TRD §3 and pin them exactly; set `packageManager` and `engines.node >=22`; `.nvmrc` = `24`.
  3. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
  4. ESLint flat config with typescript-eslint strict-type-checked, `@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-non-null-assertion: error` for `src/server/**`, `react/no-danger: error`, import boundaries from TRD §4.2 via `no-restricted-imports`.
  5. Add all scripts from TRD §4.1 (scripts that depend on later tasks may print "not implemented" and exit 1, except `lint`, `typecheck`, `test:unit`, `check:guards`, `build`).
  6. `next.config.ts`: `output: "standalone"`, `poweredByHeader: false`, `reactStrictMode: true`.
  7. Initialise shadcn (`components.json`), add `button`, `input`, `dialog`, `badge`, `skeleton`, `sonner`. Add dev dependencies `@testing-library/react`, `@testing-library/user-event`, `jsdom` (component tests, TRD §15.4).
  8. Verify A-10: note the Next major and whether the middleware file is `proxy.ts` or `middleware.ts`; record in README "Stack".
  9. CI `static` job exactly as TRD §16.1.
- Acceptance: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm check:guards && pnpm build` exit 0; `tests/unit/smoke.test.ts` imports a module that starts with `import "server-only";` and passes (proves the alias); CI `static` job green on the PR.
- Depends on: none. Covers: NFR-40, NFR-43, FR-96 (partial).

### T-02 Env module, logger, server-only boundaries

- Goal: validated configuration and structured logging available to all server code.
- Files: `src/server/env.ts`, `src/server/log.ts`, `src/server/demoMode.ts`, `src/domain/errors.ts` (ErrorCode union + status map from TRD §10.12), `tests/unit/env.test.ts`, `tests/unit/log.test.ts`, `tests/unit/errors.test.ts` (UT-09), `.env.example`.
- Steps:
  1. Implement `env()` (lazy, cached) with the Zod schema and rules of TRD §5, including the production refusal of test variables.
  2. Implement `log` with redaction (TRD §14).
  3. `errors.ts`: `ErrorCode` enum, `ERROR_STATUS`, `AppError` class.
  4. Add `import "server-only"` to every `src/server` file; add the `server-only` package.
- Acceptance: `pnpm test:unit` (UT-09 plus env tests: missing secret throws, production with `TEST_API_SECRET` throws, `APP_ORIGIN` list parsing); `pnpm typecheck`.
- Depends on: T-01. Covers: FR-36 (config), FR-80, FR-88.

### T-03 Postgres image and compose database

- Goal: `pnpm db:up` starts Postgres 17 with pgTAP and three databases.
- Files: `docker/postgres/Dockerfile`, `docker/postgres/init/01-databases.sql`, `docker/compose.yml` (only `db` service for now), `package.json` scripts `db:up`, `db:down`, `db:psql`.
- Steps: implement TRD §17.2 `db` service and the postgres Dockerfile; verify A-07 (`apt-cache policy postgresql-17-pgtap`).
- Acceptance: `pnpm db:up && docker compose -f docker/compose.yml exec -T db psql -U postgres -tAc "select count(*) from pg_database where datname in ('bidlock','bidlock_test','bidlock_load')"` prints `3`; `docker compose -f docker/compose.yml exec -T db which pg_prove` prints a path; `docker compose -f docker/compose.yml exec -T db psql -U postgres -tAc "select count(*) from pg_available_extensions where name = 'pgtap'"` prints `1`.
- Depends on: T-01. Covers: FR-90 (infrastructure).

### T-04 Migration runner, reset and env SQL

- Goal: repeatable schema management.
- Files: `scripts/db/migrate.ts`, `scripts/db/reset.ts`, `scripts/db/apply-env.ts`, `scripts/db/ticker.ts`, `db/migrations/.gitkeep`, `db/env/test.sql`, `db/env/load.sql`, `db/env/supabase.sql`, `db/env/supabase-cron.sql`, `tests/integration/migrate.int.test.ts`, `vitest.integration.config.ts`.
- Steps: implement TRD §6.1 exactly (advisory lock, checksum table, per-file transaction, `--dry-run`, `--status`, host safety checks, `--no-pgtap`, `--db`, `--env`). Env SQL files as TRD §8.4 (they reference objects from later migrations; `apply-env` is only run after migrations exist, so until T-05 the reset script skips env application when `bidlock.settings` does not exist and prints a warning).
- Acceptance: integration test (`pnpm test:concurrency`) proves: applying twice is a no-op; editing an applied file causes exit 1 "checksum mismatch"; reset refuses `DATABASE_URL_ADMIN=postgres://x@example.com/db`; `--db bidlock` targets the dev database while the default targets `bidlock_test` (D-34); `apply-env --no-pgtap` strips the `create extension … pgtap` line; `apply-env supabase` refuses a local host. The test uses a throwaway migrations directory (runner option `--dir`, default `db/migrations`) and a scratch database `bidlock_migrate_test` it creates and drops, so it never touches `bidlock_test`.
- Depends on: T-03. Covers: D-05.

---

## M1 Schema, functions, pgTAP

### T-05 Foundation migration and pgTAP harness

- Goal: schema, roles, settings, `bidlock_now()`, and a working `pnpm test:db` locally and in CI.
- Files: `db/migrations/0001_foundation.sql`, `db/tests/helpers/00_helpers.sql`, `db/tests/001_now.test.sql` (DB-01), `scripts/db/test-db.sh`, CI `db` job in `ci.yml`.
- Steps: copy TRD §6.4 0001 verbatim; write helpers from TRD §15.2 (only `set_now` now; others, including `clean()`, added with their tables); write DB-01; add the CI `db` job from TRD §16.1; verify A-07 in that job (the `test -f …/pgtap.control` step).
- Acceptance: `pnpm db:reset && pnpm test:db` passes DB-01; CI `db` job green.
- Depends on: T-04. Covers: FR-06, D-06, D-07, R-09.

### T-06 Core tables, constraints, indexes

- Goal: all tables of TRD §6.4 0002.
- Files: `db/migrations/0002_tables.sql`, `db/tests/002_schema.test.sql` (DB-02), helpers `bidder()`, `auction()`.
- Steps: copy DDL; write DB-02 including the privilege checks (privilege assertions that need later functions are added in T-09/T-12 by extending DB-02). From this task on, every migration that defines functions contains `revoke execute on all functions in schema bidlock from public;` (TRD §6.3, D-27); DB-02's `bidlock_probe` assertion enforces it for all later migrations.
- Acceptance: `pnpm db:reset && pnpm test:db` (DB-01, DB-02).
- Depends on: T-05. Covers: INV-09, INV-13 (schema level), FR-01.

### T-07 Increment ladder

- Goal: SQL ladder functions plus the TypeScript display mirror with a parity test.
- Files: `db/migrations/0003_increments.sql`, `db/tests/003_increments.test.sql` (DB-03), `src/domain/increments.ts`, `tests/unit/increments.test.ts` (UT-02), `tests/integration/increments-parity.int.test.ts` (INT-03), `tests/fixtures/db.ts` (initial `adminSql`, `appSql`).
- Acceptance: `pnpm test:db` (DB-03), `pnpm test:unit` (UT-02), `pnpm test:concurrency` (INT-03).
- Depends on: T-06. Covers: FR-02 (cap), FR-03, D-12.

### T-08 Lifecycle internals

- Goal: `_bid_result`, `_can_view`, `_is_due`, `_close_locked`, `_expire_offer_locked`, `advance_auction_locked`, result types.
- Files: `db/migrations/0004_lifecycle.sql`.
- Steps: copy TRD §6.5 types and §7.1 functions. Tests for these functions are written through their callers in T-10..T-13; in this task add a minimal smoke section to `db/tests/007_closing.test.sql` that creates a live auction past `ends_at`, calls `advance_auction_locked` directly as owner, and asserts `unsold`.
- Acceptance: `pnpm db:reset && pnpm test:db`.
- Depends on: T-07. Covers: FR-08, FR-09, FR-10, FR-13, FR-14, FR-15, FR-16 (partial).

### T-09 place_bid

- Goal: the core bid function exactly as TRD §7.2.
- Files: `db/migrations/0005_place_bid.sql` (`_idempotency_conflict` and `place_bid`), helper `bid()` in `00_helpers.sql`, extend DB-02 with "app role can execute place_bid".
- Acceptance: `pnpm db:reset && pnpm test:db` (existing tests stay green; a smoke assertion that one bid is accepted is added to DB-04 file skeleton).
- Depends on: T-08. Covers: FR-02, FR-04, FR-05, FR-06, FR-07, FR-17, D-08, D-09.

### T-10 pgTAP: bid rules and idempotency

- Goal: DB-04 and DB-05 complete per TRD §15.2.
- Files: `db/tests/004_place_bid_rules.test.sql`, `db/tests/005_idempotency.test.sql`.
- Acceptance: `pnpm test:db` with every case listed in TRD §15.2 for DB-04/DB-05 present (reviewer checks the case list).
- Depends on: T-09. Covers: FR-02, FR-04, INV-01..INV-05, INV-07.

### T-11 pgTAP: soft close

- Goal: DB-06 complete.
- Files: `db/tests/006_soft_close.test.sql`.
- Acceptance: `pnpm test:db`.
- Depends on: T-09. Covers: FR-07, INV-08.

### T-12 Scheduler path and closing tests

- D-49: TC-066 (DB-07 lazy state-read close) and TC-098 (DB-10 next-public-ID response) run in T-15, where `auction_state` is introduced.

- Goal: `close_due_auctions`, `expire_due_offers`, `_advance_one`, `generate_lot_title`, `ensure_public_auction`, `tick`; DB-07 and DB-10 with the cases listed in TRD §15.2, including the D-28 case (one failing auction does not stop the batch).
- Files: `db/migrations/0007_scheduler.sql`, `db/tests/007_closing.test.sql`, `db/tests/010_public_room.test.sql`, extend DB-02 (app role cannot execute `tick`, `close_due_auctions`, `advance_auction_locked`).
- Acceptance: `pnpm test:db` (DB-07, DB-10).
- Depends on: T-09. Covers: FR-08, FR-10, FR-30, FR-31, INV-06, INV-09.

### T-13 Settlement

- Goal: `pay_offer`; DB-08 and DB-14.
- Files: `db/migrations/0006_settlement.sql`, `db/tests/008_settlement.test.sql`, `db/tests/014_audit.test.sql`.
- Note: migration number 0006 is lower than 0007 from T-12. If T-12 merged first, the runner applies 0006 after 0007 on existing databases; this is fine because 0006 does not depend on 0007. On a fresh database order is lexical. Do not renumber.
- Acceptance: `pnpm db:reset && pnpm test:db` (DB-08, DB-14).
- Depends on: T-12. Covers: FR-11..FR-16, INV-10, INV-11, INV-13, D-13, D-14.

### T-14 Rate limiter

- Goal: `rate_limits`, `rate_counters`, `rate_hit`, `check_bid_rate`; DB-09 (bid limits part).
- Files: `db/migrations/0008_rate_limits.sql`, `db/tests/009_rate_limits.test.sql`.
- Acceptance: `pnpm test:db` (DB-09 bid cases).
- Depends on: T-09. Covers: FR-37, D-10, D-11.

### T-15 Read and identity functions

- D-49: complete deferred TC-066 in DB-07 and TC-098 in DB-10; both are required for M1 completion.

- Goal: `create_bidder`, `rename_bidder`, `auction_state`, `list_bids`, `list_auctions`, `get_me`, `stats`; DB-11 and the `create_bidder` cases of DB-09.
- Files: `db/migrations/0009_reads.sql`, `db/tests/011_reads.test.sql`, extend `009_rate_limits.test.sql`.
- Acceptance: `pnpm test:db` (DB-09, DB-11); `auction_state` keys exactly match the list in TRD §7.6 (asserted with `results_eq` on `jsonb_object_keys`).
- Depends on: T-12, T-13, T-14. Covers: FR-08 (lazy read close), FR-20 (DB side), FR-25, FR-70 (DB side).

### T-16 Sandboxes, cleanup, test support, realtime trigger

- Goal: `create_sandbox`, `sandbox_bots`, `cleanup_expired`, `create_test_auction`, `set_test_clock`, `_publish_auction` trigger; DB-12, DB-13, DB-15.
- Files: `db/migrations/0010_sandboxes.sql`, `db/migrations/0011_realtime.sql`, `db/migrations/0012_test_support.sql`, `db/tests/012_sandboxes.test.sql`, `db/tests/013_realtime.test.sql`, `db/tests/015_test_support.test.sql`, helper `sandbox()`.
- Acceptance: `pnpm db:reset && pnpm test:db` (all DB-01..DB-15 green).
- Depends on: T-15. Covers: FR-32, FR-35, FR-45 (DB side), FR-52 (DB side), D-19.

### T-17 Concurrency integration tests

- Goal: INT-01 and INT-02 green locally and in CI; verification SQL shared with the load test.
- Files: `tests/integration/concurrency.int.test.ts`, `tests/integration/races.int.test.ts`, `tests/fixtures/db.ts` (`createSql`, `makeBidders`, `makeAuction`, `withNow`), `db/verify/invariants.sql` (TRD §15.6.3), CI `integration` job.
- Acceptance: `pnpm db:reset && pnpm test:concurrency` runs INT-01..INT-03 in under 60 s; CI `integration` job green. Temporarily removing both auction-row `for update` locks from `place_bid` and `advance_auction_locked` in the local test database (D-50) makes INT-01 fail (verify once, do not commit; without both locks the `bid_no_unique` constraint can raise `23505` before the version guard (`BLK10`); INT-01 must fail assertion 1 "no thrown errors").
- Depends on: T-16. Covers: FR-91, NFR-01 (INV-01..INV-12), G-1.

---

## M2 API, identity, rate limits

### T-18 DB client and repo layer

- Goal: typed access to every SQL function.
- Files: `src/server/db.ts` (TRD §6.2), `src/server/repo/{bids,auctions,me,sandboxes,rate,stats,testSupport}.ts`, `src/domain/schemas.ts` (DB row schemas and API schemas from TRD §10), `tests/integration/repo.int.test.ts`.
- Steps: one exported function per SQL function; each parses its result with Zod and converts `Date` to ISO strings; no business logic.
- Acceptance: `pnpm test:concurrency` (repo test calls each function once against `bidlock_test` and parses the result); `pnpm typecheck`.
- Depends on: T-17. Covers: NFR-41, NFR-42.

### T-19 HTTP wrapper, Origin check, demo mode gate

- Goal: `route()` from TRD §10.1.
- Files: `src/server/http.ts`, `tests/unit/http.test.ts` (UT-13).
- Acceptance: `pnpm test:unit` (UT-13: processing order, 403/413/415/503 cases, request id reuse, log line fields).
- Depends on: T-02, T-18. Covers: FR-36, FR-51, FR-81, FR-85.

### T-20 Session cookie, names, /api/me

- Goal: guest identity end to end.
- Files: `src/server/session.ts`, `src/domain/names.ts`, `src/domain/profanity.ts`, `src/app/api/me/route.ts`, `tests/unit/session.test.ts` (UT-05), `tests/unit/names.test.ts` (UT-08).
- Steps: TRD §13.1, §13.9, §10.2, §10.3; sliding renewal; deleted-bidder recovery (FR-24).
- Acceptance: `pnpm test:unit` (UT-05, UT-08); manual: `pnpm dev`, `curl -i localhost:3000/api/me` shows `Set-Cookie: bl_sid=s1.` with `HttpOnly; SameSite=Lax`.
- Depends on: T-19. Covers: FR-20..FR-25, D-21.

### T-21 IP hashing and rate-limit integration

- Goal: `getClientIp`, `ipHash`, and the 429 path with `Retry-After`.
- Files: `src/server/ip.ts`, `tests/unit/ip.test.ts` (UT-10).
- Acceptance: `pnpm test:unit` (UT-10).
- Depends on: T-19. Covers: FR-37, NFR-30 (no Redis).

### T-22 Read endpoints

- Goal: `GET /api/auctions`, `GET /api/auctions/:id/state` (ETag/304), `GET /api/auctions/:id/bids`.
- Files: `src/app/api/auctions/route.ts`, `src/app/api/auctions/[id]/state/route.ts`, `src/app/api/auctions/[id]/bids/route.ts` (GET part).
- Acceptance: E2E-01 cases for state/304 and bids pagination are added in T-33; in this task, `tests/integration/api-read.int.test.ts` calls the route handlers directly (import the `GET` function, pass a `Request`) against `bidlock_test` and validates responses with the Zod response schemas.
- Depends on: T-20. Covers: FR-46, FR-50.

### T-23 Mutating endpoints: bids and pay

- Goal: `POST /api/auctions/:id/bids` and `POST /api/auctions/:id/pay` with full error mapping.
- Files: `src/app/api/auctions/[id]/bids/route.ts` (POST), `src/app/api/auctions/[id]/pay/route.ts`, `tests/integration/api-write.int.test.ts`.
- Steps: rate check then `place_bid`; 201 vs 200 + `Idempotent-Replayed`; rejection `details` (TRD §10.6); bot auth path stubbed to 401 until T-34.
- Acceptance: `pnpm test:concurrency` (api-write: accepted 201, replay 200 with header, BID_TOO_LOW 409 with `details.min_next_bid`, BID_TOO_HIGH 422, mismatch 422, rate limited 429 with `Retry-After`, pay flow 200/409).
- Depends on: T-21, T-22. Covers: FR-04, FR-11, FR-50, FR-51.

### T-24 Test-only endpoints and health

- Goal: `/api/test/clock`, `/api/test/auctions`, `/api/health`.
- Files: `src/app/api/test/clock/route.ts`, `src/app/api/test/auctions/route.ts`, `src/server/testGuard.ts` (`assertTestEnv`), `src/app/api/[...path]/route.ts` (catch-all 404, D-40), `notFoundResponse` and the `testOnly` option in `src/server/http.ts`, `src/app/api/health/route.ts`, extend `scripts/check-guards.ts` (rule 1), `tests/integration/api-test-routes.int.test.ts`.
- Acceptance: `pnpm check:guards`; `pnpm test:concurrency` (api-test-routes): with `APP_ENV=development`, and with `APP_ENV=test` but a wrong secret, `POST /api/test/clock` returns status, body (ignoring `request_id`) and content-type identical to `POST /api/does-not-exist`, also with `DEMO_MODE=readonly` and `off`; with `APP_ENV=test` and the secret they work; health returns `db: "ok"`.
- Depends on: T-23. Covers: FR-52, FR-82, D-25.

### T-25 Security headers and CSP

- Goal: `src/proxy.ts` (or `middleware.ts` per A-10) with nonce CSP and headers from TRD §13.4; `DEMO_MODE=off` rewrite of pages to `/offline`.
- Files: `src/proxy.ts`, `src/app/offline/page.tsx`, `tests/unit/csp.test.ts` (UT-14).
- Steps: forward the CSP on the request headers as well as the response (TRD §13.4); verify A-10's CSP item.
- Acceptance: `pnpm test:unit` (UT-14); `pnpm build && pnpm start` then `curl -sI localhost:3000/ | grep -i content-security-policy` contains `nonce-` and `frame-ancestors 'none'`; `curl -s localhost:3000/ | grep -c 'nonce="'` is at least 1 (Next applied the nonce to its scripts; without it hydration is blocked).
- Depends on: T-24. Covers: FR-86, FR-87, FR-36 (off mode).

---

## M3 UI and real-time

### T-26 Design tokens, shell and name dialog

- Goal: global look and the header with name chip, theme toggle, read-only banner, footer, 404 and error pages.
- Files: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/components/shell/*`, `src/domain/copy.ts` (all strings from PRD §9), `src/client/api.ts`, `src/client/hooks/useMe.ts`.
- Steps: tokens TRD §11.2; fonts; theme script with nonce; NameDialog with all error copies; copy only from `copy.ts`.
- Acceptance: `pnpm build`; visual check at 360 px and 1280 px in light and dark (screenshots attached to the PR); `pnpm lint` (no hard-coded hex colours outside `globals.css`: add an ESLint `no-restricted-syntax` rule for `/#[0-9a-f]{6}/i` in `src/components/**`).
- Depends on: T-25. Covers: FR-68, FR-72, FR-73, NFR-20, NFR-22.

### T-27 Client domain utilities

- Goal: money, countdown, clock sync, reconciler, live announcer.
- Files: `src/domain/money.ts`, `src/domain/clock.ts`, `src/domain/reconcile.ts`, `src/client/hooks/useLiveAnnouncer.ts`, `tests/unit/money.test.ts` (UT-01), `tests/unit/clock.test.ts` (UT-03), `tests/unit/reconcile.test.ts` (UT-04), `tests/unit/liveAnnouncer.dom.test.ts` (UT-11).
- Acceptance: `pnpm test:unit --coverage` with `src/domain/**` ≥ 90% lines.
- Depends on: T-01. (Can run in parallel with M2.) Covers: FR-40, FR-41, FR-47, NFR-21, NFR-41.

### T-28 AuctionFeed interface and PollingFeed

- Goal: polling-based real-time for local, CI and fallback.
- Files: `src/client/feed/AuctionFeed.ts`, `src/client/feed/PollingFeed.ts`, `src/client/feed/createFeed.ts`, `src/client/hooks/useServerClock.ts`, `src/client/hooks/useAuctionRoom.ts`, `tests/unit/pollingFeed.test.ts` (fake timers + mocked fetch: ETag reuse, 304 handling, backoff, hidden-tab pause, bids gap fill).
- Acceptance: `pnpm test:unit`.
- Depends on: T-27, T-22. Covers: FR-46, FR-47, FR-48 (polling side).

### T-29 Auction room: read-only parts

- Goal: `/a/[id]` with lot card, price block, countdown, leader line, extension banner, connection banner, not-found and load-error states.
- Files: `src/app/a/[id]/page.tsx`, `src/components/room/{LotCard,PriceBlock,Countdown,ExtensionBanner,ConnectionBanner}.tsx`.
- Acceptance: `pnpm build`; `pnpm test:unit` including `tests/unit/room.dom.test.tsx` (renders `PriceBlock`, `Countdown`, `ExtensionBanner`, `ConnectionBanner` and the not-found/load-error states from fixture `AuctionState` objects and asserts every string against `copy.ts`); the end-to-end "page updates within 1 s" check is E2E-02 in T-33. Optional manual check: create a test auction via `/api/test/auctions` (APP_ENV=test dev server), open it, bid with curl.
- Depends on: T-26, T-28. Covers: FR-61, FR-62, FR-64, FR-65, FR-67 (reconnecting).

### T-30 Bid panel and bid history

- Goal: quick bids, custom amount, keyboard shortcuts, pending/accepted/error states, retry with the same key, history with pagination.
- Files: `src/components/room/BidPanel.tsx`, `src/components/room/BidHistory.tsx`, `src/client/idempotency.ts`.
- Acceptance: `pnpm build`; `pnpm test:unit` including `tests/unit/bidPanel.dom.test.tsx`: with a mocked `api.ts`, each error code of PRD §9.3 renders its exact copy; keys `1`/`2`/`3` trigger the three quick bids only when focus is not in a text field; `Enter` in the custom field submits; "35.555" shows the decimals error; after a network failure "Retry" resends the same idempotency key and amount; `BID_TOO_LOW` updates the quick amounts from `details.min_next_bid`. Real-browser keyboard and rate-limit checks are E2E-07/E2E-08 in T-33.
- Depends on: T-29, T-23. Covers: FR-63, FR-64, FR-67, FR-71, US-05.

### T-31 SupabaseBroadcastFeed

- Goal: production push path with fallback.
- Files: `src/client/feed/SupabaseBroadcastFeed.ts`, update `createFeed.ts`, `tests/unit/broadcastFeed.test.ts` (mock supabase-js channel: SUBSCRIBED → refresh, 3 errors → polling, 10 s timeout → polling, invalid payload → refresh).
- Acceptance: `pnpm test:unit`; `createFeed.ts` loads `SupabaseBroadcastFeed` only through a dynamic `import()` (asserted by a unit test that mocks the module and checks it is not imported for `polling`); in a polling build E2E-07 sees no WebSocket on `/a/<id>` (added in T-33).
- Depends on: T-28, T-16. Covers: FR-45, FR-48, D-19.

### T-32 Lobby

- Goal: `/` with headline, public room card, sandbox card (disabled until T-36), offer notices, benchmark headline (empty state until T-42), teaser.
- Files: `src/app/page.tsx`, `src/components/lobby/*`, `bench/results/latest.json` (committed empty state `{"schema":1,"empty":true}`, D-32), `BenchResult` union schema in `src/domain/schemas.ts`.
- Steps: lobby cards subscribe through `createFeed()` (D-30).
- Acceptance: `pnpm build`; `pnpm test:unit` including `tests/unit/lobby.dom.test.tsx`, which renders every lobby state in PRD §9.2 (public card loading/live/with bids/closing/scheduled/error, sandbox card states, both offer notices, benchmark headline with and without data) from fixture props and asserts the exact copy. No dev-only query parameters.
- Depends on: T-29. Covers: FR-60, US-01, US-03, G-2.

### T-33 Playwright harness, two-bidder e2e, CI e2e job

- Goal: E2E-01, E2E-02, E2E-07 (on `/` and `/a/[id]`; `/how-it-works` is added in T-44), E2E-08, E2E-09 green locally and in CI.
- Files: `playwright.config.ts` (TRD §15.5), `tests/e2e/fixtures.ts`, `tests/e2e/api.spec.ts`, `tests/e2e/two-bidders.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/states.spec.ts`, `tests/e2e/bundle.spec.ts`, `scripts/check-bundle.mjs` (TRD §16.1, D-33), CI `e2e` and `build` jobs.
- Steps: verify A-08 (project-level workers) and A-10 (`next start` with standalone output; presence of `.next/app-build-manifest.json`); add `@axe-core/playwright`.
- Acceptance: `pnpm db:reset && NEXT_PUBLIC_FEED=polling NEXT_PUBLIC_POLL_INTERVAL_MS=1000 pnpm build && pnpm e2e`; CI `e2e` and `build` green (the `build` job runs `check-bundle.mjs`); Playwright config has `expect.timeout: 3000`, `timeout: 90_000`, `parallel` and `isolated` projects.
- Depends on: T-30, T-32. Covers: FR-92, NFR-20..NFR-24, US-02, US-04, US-14.

---

## M4 Sandbox and bots

### T-34 Sandbox and bot-token endpoints

- Goal: `POST /api/sandboxes`, `POST /api/bot-tokens`, bot auth in `route()`.
- Files: `src/app/api/sandboxes/route.ts`, `src/app/api/bot-tokens/route.ts`, `src/server/botTokens.ts`, update `src/server/http.ts` (session-or-bot), `tests/unit/botTokens.test.ts` (UT-06), extend `tests/integration/api-write.int.test.ts` (sandbox create/exists/capacity, bot bid accepted, bot bid on another auction 401, token without owner cookie 401).
- Acceptance: `pnpm test:unit && pnpm test:concurrency`.
- Depends on: T-33. Covers: FR-32, FR-33, FR-35, US-09.

### T-35 Bot scheduler and runner

- Goal: deterministic client bots per TRD §12.
- Files: `src/client/bots/{prng,personas,scheduler}.ts`, `src/client/bots/BotRunner.tsx`, `tests/unit/botScheduler.test.ts` (UT-07).
- Acceptance: `pnpm test:unit` (UT-07 incl. 10,000-draw probability checks).
- Depends on: T-34. Covers: FR-33, FR-34, FR-38, D-16.

### T-36 Sandbox UI and e2e

- Goal: sandbox card states, sandbox header, bot strip, bot notes; E2E-03.
- Files: `src/components/lobby/SandboxCard.tsx`, `src/components/room/BotStrip.tsx`, `tests/e2e/sandbox-bots.spec.ts`.
- Acceptance: `pnpm e2e --project=parallel -g sandbox` green 3 times in a row locally (flake check); CI green.
- Depends on: T-35. Covers: FR-32..FR-35, FR-38, US-09.

---

## M5 Settlement

### T-37 Result panel, payment and runner-up UI

- Goal: every closed-state copy in PRD §9.3, "Pay now (simulated)", lobby offer notices, strike display; E2E-04.
- Files: `src/components/room/ResultPanel.tsx`, `src/components/lobby/OfferNotices.tsx`, `src/components/shell/NameChip.tsx` (strikes), `tests/e2e/settlement.spec.ts` (tag `@isolated`).
- Acceptance: `pnpm e2e --project=isolated -g settlement`; the test resets the clock in `finally`.
- Depends on: T-36. Covers: FR-11..FR-15, FR-66, US-07, US-08.

### T-38 Extension banner and public room e2e

- Goal: E2E-05 and E2E-06.
- Files: `tests/e2e/extension-banner.spec.ts`, `tests/e2e/public-room.spec.ts` (both `@isolated`).
- Acceptance: `pnpm e2e` (both projects) green; CI green.
- Depends on: T-37. Covers: FR-07, FR-30, FR-31, FR-65, US-06.

---

## M6 Load test, CI, bench page

### T-39 App image and full compose

- Goal: production build in Docker with `migrate`, `app`, `k6` services.
- Files: `Dockerfile` (TRD §17.1), `docker/compose.yml` (full), `.dockerignore` (`node_modules`, `.next`, `bench/out`, `playwright-report`, `test-results`, `.git`, `.env*`), `scripts/bench/load-local.sh` (TRD §4.1; the k6 step may fail until T-40).
- Acceptance: `C="docker compose -f docker/compose.yml"; $C build db migrate app && $C up -d db --wait && $C run --rm migrate && $C up -d --no-deps app && for i in $(seq 1 60); do curl -fsS localhost:3000/api/health && break; sleep 2; done` prints a body containing `"db":"ok"`; then `$C down -v`. (No `up --wait` on `app`: the one-shot `migrate` dependency makes `--wait` unreliable.)
- Depends on: T-38. Covers: FR-93 (environment).

### T-40 k6 bid-storm script

- Goal: `load/bid-storm.js` per TRD §15.6.2.
- Files: `load/bid-storm.js`, optionally `load/lib/` (A-11 fallback).
- Acceptance: `VUS=50 DURATION=15s AUCTION_S=8 BENCH_MIN_BIDS=10 pnpm load:local` runs the k6 step to completion and writes `bench/out/k6-summary.json` containing `setup_data.auctionId` (the later verify/report steps of the script are completed in T-41/T-42; until then the script may exit non-zero after k6); `pnpm check:guards` (rule 5).
- Depends on: T-39. Covers: FR-93, NFR-10, NFR-11, NFR-31.

### T-41 Invariant verification

- Goal: `scripts/bench/verify.ts` using `db/verify/invariants.sql` (shared with INT-01).
- Files: `scripts/bench/verify.ts`.
- Acceptance: after T-40's run, `DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:54329/bidlock_load BENCH_MIN_BIDS=10 pnpm bench:verify` exits 0 and writes `bench/out/verify.json`; manually corrupting one row in `bidlock_load` (`update bidlock.auctions set bid_count = bid_count + 1 where id = …`) makes it exit 1 (verify once, then reset).
- Depends on: T-40. Covers: FR-94, NFR-12.

### T-42 Bench report and headline data

- Goal: `scripts/bench/report.ts` (flags `--no-commit`, `--k6-outcome`, `--init`), full `BenchResult` variant, lobby headline reading real results (the empty-state file and union schema exist since T-32).
- Files: `scripts/bench/report.ts`, `src/domain/schemas.ts` (`BenchResult` full variant), `bench/SUMMARY.md` (header only), `src/components/lobby/BenchmarkHeadline.tsx`, `tests/unit/benchReport.test.ts` (UT-12).
- Acceptance: `pnpm test:unit`; `pnpm load:local` at full size (500 VUs, 60 s, defaults) exits 0 and produces `bench/out/result.json` that parses with the full `BenchResult` variant and `bench/out/SUMMARY.md`; `bench/results/` is unchanged (`git status --porcelain bench/results` empty).
- Depends on: T-41. Covers: FR-95, NFR-10..NFR-12.

### T-43 Load workflow

- Goal: `.github/workflows/load.yml` per TRD §16.2.
- Files: `.github/workflows/load.yml`.
- Steps: enable the repository setting from A-09; run via workflow_dispatch.
- Acceptance: one dispatched run succeeds, uploads the artifact and opens a PR that changes only `bench/results/*.json` and `bench/SUMMARY.md`; merge it (first real benchmark).
- Depends on: T-42. Covers: FR-95, FR-96, D-17, G-1.

### T-44 How it works page

- Goal: `/how-it-works` per PRD §9.4.
- Files: `src/app/how-it-works/page.tsx`, `src/components/how/{state-machine.mmd,state-machine.svg,StateMachine.tsx,BenchmarkTable.tsx,StatsStrip.tsx}`, `src/server/repo/stats.ts` (cached).
- Steps: write the Mermaid source from PRD §7.1, run `pnpm diagram`, commit the SVG; render rules from `increments.ts` and constants; the concurrency text exactly as PRD §9.4; benchmark from `latest.json`; stats cached 60 s.
- Acceptance: `pnpm build`; E2E-07 is extended to `/how-it-works` and passes; the page renders the empty-state benchmark copy when `latest.json` is the empty file and the table when it is a full result (unit render test `tests/unit/howItWorks.dom.test.tsx` with both fixtures).
- Depends on: T-43. Covers: FR-69, FR-70, US-11, G-3.

---

## M7 Polish and deploy

### T-45 Supabase production setup

- Goal: production database with migrations, app role, realtime and cron.
- Files: none new in code unless a fallback is needed; update `README.md` "Deployment notes" with verified facts.
- Steps: TRD §18.2 and §18.3; verify A-01, A-02, A-03, A-06; if A-01 fails, walk the D-29 chain: first the private-channel fallback (TRD §8.1: `realtime.send(…, true)`, RLS policy in a new guarded migration `0013_realtime_private.sql`, client `private: true`), and only if that also fails §8.2 in `0013_postgres_changes_fallback.sql`; each with pgTAP coverage (the guard makes the migration a no-op on plain Postgres) and a PRD §14 row.
- Acceptance: from the owner's machine `pnpm db:migrate --status` shows all applied; `select jobname from cron.job` lists 4 jobs; `select realtime.send(...)` test message is received in a browser console subscription; `psql "$DATABASE_URL" -c "select current_user"` prints `bidlock_app` (or the A-02 fallback is recorded).
- Depends on: T-44. Covers: FR-45, FR-08 (cron), D-04, NFR-30.

### T-46 Vercel deploy, DNS, keepalive

- Goal: https://bidlock.firatkil.com live.
- Files: `.github/workflows/keepalive.yml` (TRD §16.3).
- Steps: TRD §18.4; verify A-04, A-05, A-12 and record the numbers in README; preview scope `DEMO_MODE=off`.
- Acceptance: `curl -fsS https://bidlock.firatkil.com/api/health?db=1` shows `"db":"ok"` and `version` = deployed SHA; keepalive dispatched once and green; two browsers on different networks see each other's bids within 1 s (Broadcast).
- Depends on: T-45. Covers: NFR-13, NFR-14, NFR-30, NFR-31, R-01.

### T-47 Polish pass

- Goal: accessibility, responsiveness, motion and performance budgets met.
- Files: any UI file; `tests/e2e/a11y.spec.ts` extended if gaps are found.
- Steps: Lighthouse mobile on production `/` (record scores in PR); fix contrast, focus order, `aria-live` throttling; check 360 px on all pages; verify reduced motion; check NFR-15 bundle budget; remove any dev-only state switches added in T-32.
- Acceptance: `pnpm e2e` green (including E2E-09); Lighthouse Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 (screenshots in PR); `node scripts/check-bundle.mjs --route "/a/[id]" --max-kb 180` passes (or reports that E2E-09 enforces the budget, D-33).
- Depends on: T-46. Covers: NFR-15, NFR-16, NFR-20..NFR-24.

### T-48 README, demo GIF, release

- Goal: public v1.0.
- Files: `README.md`, `docs/media/demo.gif` (≤ 8 MB, 20–30 s: lobby → bid → outbid in second window → late bid extension banner → win → pay), `CHANGELOG.md` (v1.0.0 entry).
- README sections (in order): one-sentence pitch; live demo link; GIF; "The claim" with the benchmark table generated from `bench/results/latest.json` (date, VUs, bid requests, accepted, p95, p99, unexpected errors, invariant violations) and a link to the load workflow; "How it stays correct" (5 bullets linking to `db/migrations/0005_place_bid.sql` line anchors); "Run it yourself" (`pnpm install`, `pnpm db:up`, `pnpm test:all`, `pnpm load:local`); "Architecture" (Mermaid from TRD §2); "Stack" with pinned versions; "Deployment notes" (verified free-tier facts with dates; the paused-database note from TRD §18.7 option b); "Docs" links; license.
- Steps: record GIF with two browser windows against production at a quiet time (no load tools); tag `v1.0.0`; GitHub release with the README benchmark table.
- Acceptance: release checklist below fully ticked.
- Depends on: T-47. Covers: G-2, G-3, G-5, US-12, US-13.

---

## Traceability: FR to tasks and tests

| FR | Tasks | Tests |
|---|---|---|
| FR-01 | T-06, T-08 | DB-02, DB-07, DB-08 |
| FR-02, FR-03 | T-07, T-09, T-10 | DB-03, DB-04, UT-02, INT-01, INT-03 |
| FR-04 | T-09, T-10, T-23 | DB-05, INT-01, INT-02, E2E-01 |
| FR-05, FR-06 | T-05, T-09 | DB-01, DB-04, INT-01, LOAD-01 |
| FR-07 | T-09, T-11, T-38 | DB-06, E2E-05, LOAD-01 |
| FR-08, FR-09, FR-10 | T-08, T-12, T-15 | DB-07, INT-02 |
| FR-11..FR-15 | T-13, T-37 | DB-08, INT-02, E2E-04 |
| FR-16 | T-08, T-13 | DB-14 |
| FR-17 | T-09 | DB-04 |
| FR-20..FR-25 | T-15, T-20 | DB-09, DB-11, UT-05, UT-08, E2E-01 |
| FR-30, FR-31 | T-12, T-32, T-38 | DB-10, INT-02, E2E-06 |
| FR-32..FR-35, FR-38 | T-16, T-34, T-35, T-36 | DB-12, UT-06, UT-07, E2E-03 |
| FR-36 | T-02, T-19, T-25 | UT-13 |
| FR-37 | T-14, T-21 | DB-09, UT-10, E2E-08 |
| FR-40, FR-41 | T-27, T-29 | UT-03 |
| FR-45, FR-48 | T-16, T-31, T-45 | DB-13, broadcastFeed unit test |
| FR-46, FR-47 | T-22, T-28 | UT-04, pollingFeed unit test, E2E-02 |
| FR-50..FR-52 | T-19..T-24 | UT-09, UT-13, api-read/write/test-routes integration, E2E-01 |
| FR-60..FR-73 | T-26, T-29, T-30, T-32, T-36, T-37, T-44 | E2E-02..E2E-09, room/bidPanel/lobby/howItWorks DOM tests |
| FR-80..FR-83 | T-02, T-19, T-24, T-08 | UT-13, DB-14 |
| FR-85..FR-88 | T-19, T-25, T-06 | UT-13, UT-14, DB-02, E2E-01 |
| FR-90..FR-96 | T-05..T-17, T-33, T-39..T-43 | all |

---

## Release checklist (v1.0.0)

Code and tests:
- [ ] `pnpm test:all` passes on a clean clone (fresh Docker volume) on macOS or Linux with Node 22 and with Node 24.
- [ ] CI `ci` workflow green on `main` for the release commit.
- [ ] Latest `load` run green; its bench PR merged; `bench/results/latest.json` ≤ 7 days old with 0 invariant violations and thresholds passed.
- [ ] `pnpm check:guards` passes; `grep -rn "any" --include=*.ts src | grep -v "// allow-any"` reviewed (no `any` types).
- [ ] No `console.log` in `src/` (ESLint `no-console: error` except in `log.ts`).

Production:
- [ ] `/api/health?db=1` → `db: "ok"`, `demo_mode: "on"`, `version` = release SHA.
- [ ] Two browsers on different networks: bid, outbid, extension banner, close, pay, all with Broadcast (Network tab shows a websocket, no 1 s polling).
- [ ] Sandbox: three bots bid; closing the tab stops them; a second sandbox is refused while the first is active.
- [ ] `DEMO_MODE=readonly` redeploy shows the banner and blocks bids; switch back to `on`.
- [ ] `update bidlock.settings set bidding_paused = true` blocks bids within one request; revert.
- [ ] `/api/test/clock` returns 404 in production (with and without a guessed secret).
- [ ] Response headers on `/` include CSP with nonce, HSTS, `X-Content-Type-Options`.
- [ ] Cookie `bl_sid` is `HttpOnly; Secure; SameSite=Lax`.
- [ ] `select jobname, active from cron.job` shows 4 active jobs; `cron.job_run_details` has recent `succeeded` rows for `bidlock-tick`.
- [ ] Database size (Dashboard → Usage) < 50 MB.
- [ ] Keepalive workflow enabled; last run green.
- [ ] Vercel and Supabase billing pages show $0 and no paid add-ons.

Docs and presentation:
- [ ] README benchmark table matches `latest.json`; GIF plays; all links work.
- [ ] `/how-it-works` shows the diagram, concurrency text, benchmark table and stats.
- [ ] Lighthouse scores recorded in the release notes.
- [ ] PRD §14 decisions log updated with every fallback taken during implementation.
- [ ] Tag `v1.0.0` and GitHub release published.
