# Bidlock: Technical Requirements Document

| Field | Value |
|---|---|
| Status | Approved for implementation |
| Version | 1.0 (2026-10-20) |
| Reads with | [PRD.md](./PRD.md) (what and why), [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) (task order), [../AGENTS.md](../AGENTS.md) |

This document is normative. Where it shows SQL, TypeScript, YAML or config, implement it as written unless a step in §21 (assumptions to verify) proves an external fact wrong; then change the smallest thing and record the change in PRD §14.

---

## 1. Reading order for implementers

1. PRD §6 (FR list), §7 (state machine), §8.1 (invariants), §9 (copy).
2. This document §6–§8 (database), §10 (API), §11–§12 (client and bots).
3. IMPLEMENTATION_PLAN.md, task by task.

## 2. Architecture

```mermaid
flowchart LR
    subgraph Browser
        UI[Next.js client components]
        Bots[Bot scheduler<br/>sandbox owner tab only]
        Feed[AuctionFeed<br/>Broadcast or Polling]
    end
    subgraph Vercel["Vercel Hobby (Node runtime)"]
        Pages[App Router pages<br/>RSC]
        API[Route handlers /api/*]
        Proxy[proxy.ts<br/>CSP nonce, request id]
    end
    subgraph Supabase["Supabase Free"]
        Pooler[Supavisor<br/>transaction mode :6543]
        PG[(PostgreSQL 17<br/>schema bidlock)]
        Cron[pg_cron<br/>tick every minute]
        RT[Realtime<br/>Broadcast]
    end
    UI -- fetch JSON --> API
    Bots -- same bid API, Bot token --> API
    Pages -- server-only SQL --> Pooler
    API -- postgres.js prepare:false --> Pooler --> PG
    Cron -- bidlock.tick() --> PG
    PG -- trigger realtime.send --> RT
    RT -- topic auction:id --> Feed
    Feed -- reconcile: GET /state --> API
```

Local, CI and load-test topology replaces Supabase with `postgres:17` (plus pgTAP), has no pg_cron (lazy transitions and an optional `pnpm db:ticker` loop cover it) and uses `PollingFeed`.

```mermaid
flowchart LR
    k6[k6 container<br/>500 VUs] --> App[app container<br/>next start standalone] --> DB[(postgres:17)]
    Verify[scripts/bench/verify.ts] --> DB
```

Key properties:

- The browser never talks to Postgres. The only Supabase client in the browser is the Realtime subscription.
- All writes go through `SECURITY DEFINER` functions in schema `bidlock`. The runtime role cannot write tables.
- Each HTTP request uses at most three short single-statement database transactions (`POST /bids`: rate check, then `place_bid`; first `GET /api/me`: `get_me`, `create_bidder`, `get_me`). No transaction spans network calls.

## 3. Stack

Pin exact versions at implementation time: run `pnpm view <package> version` for each package below, write the exact version (no `^` or `~`) in `package.json`, commit `pnpm-lock.yaml`, set `"packageManager": "pnpm@<exact>"`, and pin Docker images by tag in compose files (`postgres:17.x`, `grafana/k6:1.x.y`, `node:24.x-bookworm-slim`). Record the chosen versions in the README "Stack" table.

| Concern | Choice | Major version at writing | Notes |
|---|---|---|---|
| Runtime | Node.js | 24 LTS (minimum 22) | `.nvmrc` = `24`; `engines.node` = `>=22` |
| Package manager | pnpm | 10.x | via Corepack |
| Framework | Next.js App Router | 16.x | `output: "standalone"`; Node runtime for every route handler (`export const runtime = "nodejs"`) |
| UI | React | 19.x | |
| Language | TypeScript | 5.9+ | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Styling | Tailwind CSS | 4.x | CSS-first config in `src/app/globals.css` |
| Components | shadcn/ui (CLI) | 3.x | Copy-in components: button, input, dialog, badge, toast (sonner), skeleton |
| Validation | Zod | 4.x | Every boundary |
| DB driver | postgres (postgres.js) | 3.4.x | `prepare: false` |
| Realtime client | @supabase/supabase-js | 2.x | Realtime only |
| DB | PostgreSQL | 17 | Supabase in prod, `postgres:17` elsewhere |
| DB tests | pgTAP + pg_prove | 1.3.x | `postgresql-17-pgtap` apt package |
| Scheduler | pg_cron | 1.6.x | Supabase only |
| Unit and integration tests | Vitest | 3.x or 4.x | |
| E2E | Playwright + @axe-core/playwright | 1.5x / 4.x | Chromium only in CI |
| Load | k6 | 1.x | `grafana/k6` image |
| Lint/format | ESLint 9 flat config + typescript-eslint 8, Prettier 3 | | |
| TS script runner | tsx | 4.x | for `scripts/**/*.ts` |
| Diagram build | @mermaid-js/mermaid-cli | 11.x | dev dependency, used by `pnpm diagram` only |

## 4. Repository layout

```
bidlock/
├── AGENTS.md                         Rules for AI coding agents
├── README.md                         Pitch, demo GIF, benchmark table, run instructions
├── LICENSE                           MIT, "Copyright (c) 2026 Fırat Kıl"
├── package.json                      Scripts (§4.1), exact dependency versions
├── pnpm-lock.yaml
├── .nvmrc                            24
├── .env.example                      Every env var from §5 with safe local values
├── .gitignore                        .env*, !.env.example, .next, node_modules, bench/out, playwright-report, test-results
├── next.config.ts                    output standalone, poweredByHeader false, typedRoutes
├── tsconfig.json                     strict settings, path alias @/* -> src/*
├── eslint.config.mjs                 flat config, no-explicit-any error, import boundaries (§4.2)
├── prettier.config.mjs
├── postcss.config.mjs                @tailwindcss/postcss
├── components.json                   shadcn config (style new-york, css variables, no rsc prefix changes)
├── vitest.config.ts                  unit tests (environment node; jsdom for *.dom.test.ts and *.dom.test.tsx);
│                                     resolve.alias "server-only" -> tests/stubs/server-only.ts (the real package throws outside the react-server condition)
├── vitest.integration.config.ts      integration tests against Postgres (single fork, 60 s timeout, same "server-only" alias)
├── .dockerignore                     node_modules, .next, bench/out, playwright-report, test-results, .git, .env* (host node_modules must never reach the Linux image)
├── public/robots.txt                 must exist: the Dockerfile copies public/
├── playwright.config.ts              §15.5
├── Dockerfile                        §17.1 multi-stage: deps, tools, build, runner
├── docker/
│   ├── compose.yml                   §17.2 db, migrate, app, k6 (profile load)
│   └── postgres/
│       ├── Dockerfile                FROM postgres:17 + pgTAP + pg_prove
│       └── init/01-databases.sql     creates bidlock_test and bidlock_load next to bidlock (dev)
├── db/
│   ├── migrations/                   Plain SQL, applied in filename order (§6.1)
│   │   ├── 0001_foundation.sql
│   │   ├── 0002_tables.sql
│   │   ├── 0003_increments.sql
│   │   ├── 0004_lifecycle.sql
│   │   ├── 0005_place_bid.sql
│   │   ├── 0006_settlement.sql
│   │   ├── 0007_scheduler.sql
│   │   ├── 0008_rate_limits.sql
│   │   ├── 0009_reads.sql
│   │   ├── 0010_sandboxes.sql
│   │   ├── 0011_realtime.sql
│   │   └── 0012_test_support.sql
│   ├── env/                          Per-environment SQL, applied by scripts/db/apply-env.ts
│   │   ├── test.sql                  env=test, pgtap, app role login, raised limits for e2e
│   │   ├── load.sql                  env=test, raised IP and guest limits for k6
│   │   ├── supabase.sql              env=prod, realtime_mode=broadcast, app role login
│   │   └── supabase-cron.sql         pg_cron schedules (§8.3)
│   ├── tests/                        pgTAP files *.test.sql (§15.2)
│   │   └── helpers/00_helpers.sql    test-only helper functions in schema bidlock_test
│   └── verify/invariants.sql         Post-run invariant query (§15.6.3)
├── scripts/
│   ├── db/migrate.ts                 Migration runner (§6.1)
│   ├── db/reset.ts                   drop schema, migrate, apply env (local/CI only; refuses non-local hosts)
│   ├── db/apply-env.ts               applies db/env/<name>.sql with psql-style variables
│   ├── db/test-db.sh                 runs pg_prove on host or inside the db container
│   ├── db/ticker.ts                  local loop: select bidlock.tick() every 5 s
│   ├── bench/verify.ts               waits for close, runs invariants.sql, writes bench/out/verify.json
│   ├── bench/report.ts               builds bench/results/<date>.json, latest.json, SUMMARY.md
│   ├── bench/load-local.sh           `pnpm load:local` (§4.1)
│   ├── check-guards.ts               static checks (§13.8)
│   └── check-bundle.mjs              first-load JS budget check (NFR-15)
├── load/
│   └── bid-storm.js                  k6 script (§15.6)
├── bench/
│   ├── results/                      <YYYY-MM-DD>.json and latest.json (committed)
│   ├── SUMMARY.md                    Markdown table of all runs (generated)
│   └── out/                          raw run output (git-ignored)
├── src/
│   ├── proxy.ts                      Next 16 "proxy" (named middleware.ts on Next 15): CSP nonce, x-request-id, DEMO_MODE=off page rewrite
│   ├── app/
│   │   ├── layout.tsx                fonts, theme script (nonce), shell, toaster
│   │   ├── globals.css               Tailwind 4 + tokens (§11.2)
│   │   ├── page.tsx                  Lobby (RSC shell + client islands)
│   │   ├── a/[id]/page.tsx           Auction room
│   │   ├── how-it-works/page.tsx     Rules, diagram, concurrency, benchmark, stats
│   │   ├── offline/page.tsx          DEMO_MODE=off target
│   │   ├── not-found.tsx, error.tsx, global-error.tsx
│   │   └── api/
│   │       ├── auctions/route.ts                     GET
│   │       ├── auctions/[id]/state/route.ts          GET
│   │       ├── auctions/[id]/bids/route.ts           GET, POST
│   │       ├── auctions/[id]/pay/route.ts            POST
│   │       ├── sandboxes/route.ts                    POST
│   │       ├── bot-tokens/route.ts                   POST
│   │       ├── me/route.ts                           GET, PATCH
│   │       ├── health/route.ts                       GET
│   │       ├── [...path]/route.ts                    all methods: 404 NOT_FOUND envelope (unknown API route;
│   │       │                                         the test guard returns the identical response)
│   │       └── test/
│   │           ├── clock/route.ts                    POST, DELETE (APP_ENV=test only)
│   │           └── auctions/route.ts                 POST (APP_ENV=test only)
│   ├── domain/                       Pure TypeScript shared by client and server, no I/O
│   │   ├── money.ts                  formatCents, parseDollarInput
│   │   ├── increments.ts             mirror of increment ladder (display only; parity test INT-03)
│   │   ├── clock.ts                  ClockSync, formatCountdown
│   │   ├── reconcile.ts              room state reducer
│   │   ├── schemas.ts                Zod schemas for every API body and response
│   │   ├── errors.ts                 ErrorCode union, HTTP status map, copy keys
│   │   ├── names.ts, profanity.ts    display name rules
│   │   └── copy.ts                   every UI string from PRD §9
│   ├── server/                       import "server-only" in every file
│   │   ├── env.ts                    Zod-validated env, lazy (first access), cached
│   │   ├── db.ts                     postgres.js client (§6.2)
│   │   ├── log.ts                    JSON logger
│   │   ├── http.ts                   route() wrapper (§10.1)
│   │   ├── session.ts                cookie sign/verify (§13.1)
│   │   ├── botTokens.ts              bot token sign/verify (§13.2)
│   │   ├── ip.ts                     client IP extraction + hashing (§13.6)
│   │   ├── demoMode.ts
│   │   ├── testGuard.ts              assertTestEnv(req): returns the unknown-route 404 Response or null (§13.7)
│   │   └── repo/                     one module per SQL function group; parses DB output with Zod
│   │       ├── bids.ts, auctions.ts, me.ts, sandboxes.ts, rate.ts, stats.ts, testSupport.ts
│   ├── client/
│   │   ├── api.ts                    typed fetch client (parses with domain/schemas.ts)
│   │   ├── feed/AuctionFeed.ts       interface (§11.3)
│   │   ├── feed/PollingFeed.ts
│   │   ├── feed/SupabaseBroadcastFeed.ts
│   │   ├── feed/createFeed.ts        selection + fallback
│   │   ├── bots/prng.ts              mulberry32
│   │   ├── bots/personas.ts          persona parameters
│   │   ├── bots/scheduler.ts         pure decision function
│   │   ├── bots/BotRunner.tsx        drives three bots with timers
│   │   ├── hooks/useMe.ts, useAuctionRoom.ts, useServerClock.ts, useLiveAnnouncer.ts
│   │   └── idempotency.ts            pending-bid store (key reuse on retry)
│   └── components/
│       ├── ui/                       shadcn copies
│       ├── shell/Header.tsx, NameChip.tsx, NameDialog.tsx, ThemeToggle.tsx, Banner.tsx, Footer.tsx
│       ├── lobby/PublicRoomCard.tsx, SandboxCard.tsx, BenchmarkHeadline.tsx, Teaser.tsx, OfferNotices.tsx
│       ├── room/LotCard.tsx, PriceBlock.tsx, Countdown.tsx, ExtensionBanner.tsx, BidPanel.tsx,
│       │        ResultPanel.tsx, BidHistory.tsx, ConnectionBanner.tsx, BotStrip.tsx
│       └── how/StateMachine.tsx (renders state-machine.svg), state-machine.svg, state-machine.mmd,
│                BenchmarkTable.tsx, StatsStrip.tsx
├── tests/
│   ├── unit/                         UT-xx (*.test.ts)
│   ├── integration/                  INT-xx (*.int.test.ts)
│   ├── e2e/                          E2E-xx (*.spec.ts) + fixtures.ts
│   ├── stubs/server-only.ts          `export {};` (aliased for Vitest only)
│   └── fixtures/                     shared factories (bidders, auctions) for integration tests
├── .github/workflows/
│   ├── ci.yml                        §16.1
│   ├── load.yml                      §16.2
│   └── keepalive.yml                 §16.3
└── docs/PRD.md, TRD.md, IMPLEMENTATION_PLAN.md
```

### 4.1 package.json scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev --port 3000` | Local app (needs `db:up`, `db:reset`) |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve the build |
| `lint` | `eslint . --max-warnings 0 && prettier --check .` | |
| `typecheck` | `tsc --noEmit` | |
| `db:up` | `docker compose -f docker/compose.yml up -d db --wait` | Start Postgres on port 54329 |
| `db:down` | `docker compose -f docker/compose.yml down` | |
| `db:migrate` | `tsx scripts/db/migrate.ts` | Apply pending migrations to `DATABASE_URL_ADMIN` |
| `db:reset` | `tsx scripts/db/reset.ts --env test` | Local/CI only: recreate schema, migrate, apply `db/env/test.sql`. Extra flags: `--db <name>`, `--no-pgtap`, `--env load` (§6.1) |
| `db:env` | `tsx scripts/db/apply-env.ts` | `pnpm db:env supabase` etc. |
| `db:cron` | `tsx scripts/db/apply-env.ts supabase-cron` | Production cron schedules |
| `db:tick` | `tsx scripts/db/ticker.ts --once` | One tick |
| `db:ticker` | `tsx scripts/db/ticker.ts` | Tick every 5 s (local only) |
| `db:psql` | `docker compose -f docker/compose.yml exec db psql -U postgres bidlock` | |
| `test:unit` | `vitest run` | UT-xx |
| `test:db` | `bash scripts/db/test-db.sh` | pgTAP DB-xx |
| `test:concurrency` | `vitest run --config vitest.integration.config.ts` | INT-xx |
| `e2e` | `playwright test` | E2E-xx (needs a build) |
| `test:all` | `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm db:reset && pnpm test:db && pnpm test:concurrency && pnpm build && pnpm exec playwright install chromium && pnpm e2e` | Everything except load (the browser install is a no-op when cached) |
| `load:local` | `bash scripts/bench/load-local.sh` | k6 locally (script below) |
| `bench:verify` | `tsx scripts/bench/verify.ts` | |
| `bench:report` | `tsx scripts/bench/report.ts` | |
| `check:guards` | `tsx scripts/check-guards.ts` | §13.8 |
| `diagram` | `mmdc -i src/components/how/state-machine.mmd -o src/components/how/state-machine.svg -b transparent` | Regenerate diagram |

`scripts/bench/load-local.sh` (also listed in §4 under `scripts/bench/`):

```bash
#!/usr/bin/env bash
set -euo pipefail
C="docker compose -f docker/compose.yml"
mkdir -p bench/out && chmod 777 bench/out          # the grafana/k6 image runs as a non-root user
$C build db migrate app
$C up -d db --wait                                  # db only: --wait is unreliable with one-shot services
$C run --rm migrate                                 # reset bidlock_load: drop schema, migrate, db/env/load.sql
$C up -d --no-deps app
for i in $(seq 1 60); do curl -fsS http://localhost:3000/api/health >/dev/null && break; sleep 2; done
curl -fsS http://localhost:3000/api/health >/dev/null
$C --profile load run --rm --no-deps k6             # service command runs load/bid-storm.js; VUS, DURATION, AUCTION_S pass through
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:54329/bidlock_load pnpm bench:verify
pnpm bench:report --no-commit
```

`app` declares `depends_on: migrate (service_completed_successfully)` for plain `docker compose up`; the script uses `--no-deps` so `migrate` (a full reset of `bidlock_load`) runs exactly once per run.

### 4.2 Module boundaries (ESLint `no-restricted-imports`)

| Directory | May import | Must not import |
|---|---|---|
| `src/domain/**` | zod | anything from `src/server`, `src/client`, `react`, `next`, `postgres` |
| `src/server/**` | domain, postgres, node:crypto, next/server | `src/client`, `src/components` |
| `src/client/**`, `src/components/**` | domain, react, @supabase/supabase-js | `src/server`, `postgres`, `node:*` |
| `src/app/api/**` | server, domain | client, components |

Every file in `src/server/` starts with `import "server-only";`.

## 5. Configuration

All server env vars are parsed once by `src/server/env.ts` with Zod on first access (not at build time), so `next build` works without secrets. Public vars (`NEXT_PUBLIC_*`) are inlined at build time.

| Variable | Required in | Example (local) | Production value | Notes |
|---|---|---|---|---|
| `APP_ENV` | all | `development` | `production` | `development` \| `test` \| `production`. `test` enables `/api/test/*` |
| `DATABASE_URL` | runtime | `postgres://bidlock_app:bidlock_app@localhost:54329/bidlock` | `postgres://bidlock_app.<ref>:<pw>@aws-<n>-<region>.pooler.supabase.com:6543/postgres` (copy the host from Dashboard → Connect; it may be `aws-0-…` or `aws-1-…`) | Runtime role; prod uses the transaction pooler. Integration tests default to `postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test` when unset |
| `DATABASE_URL_ADMIN` | migrations, tests, scripts | `postgres://postgres:postgres@localhost:54329/bidlock_test` | direct `db.<ref>.supabase.co:5432` or session pooler `:5432` (§18.3) | Never set on Vercel. Scripts and tests read `process.env` only (they never load `.env*` files); when unset they default to the local value shown here |
| `DB_POOL_MAX` | runtime | `10` | `3` | Connections per server instance |
| `SESSION_SECRET` | runtime | 32+ random bytes, base64url | `openssl rand -base64 48` | HMAC key for `bl_sid` |
| `SESSION_SECRET_PREVIOUS` | optional | empty | previous secret during rotation | Accepted for verification only |
| `BOT_TOKEN_SECRET` | runtime | 32+ bytes | separate random value | HMAC key for bot tokens |
| `IP_HASH_SALT` | runtime | 16+ characters | random | HMAC key for IP hashing |
| `DEMO_MODE` | runtime | `on` | `on` | `on` \| `readonly` \| `off` |
| `APP_ORIGIN` | runtime | `http://localhost:3000` | `https://bidlock.firatkil.com` | Exact Origin for CSRF check; comma-separated list allowed (preview deployments) |
| `TRUST_PROXY` | runtime | `none` | `vercel` | `vercel`: use `x-forwarded-for`; `none`: IP = `"local"` |
| `LOG_LEVEL` | optional | `debug` | `info` | |
| `TEST_API_SECRET` | test only | `test-secret-change-me` | unset | Required header for `/api/test/*` |
| `BOT_SEED_OVERRIDE` | test only | `42` | unset | Fixed bot seed; ignored unless `APP_ENV=test` |
| `NEXT_PUBLIC_FEED` | build | `polling` | `broadcast` | `broadcast` \| `polling` |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | build | `1000` | `2000` | Polling interval (also fallback interval) |
| `NEXT_PUBLIC_SUPABASE_URL` | build, prod | empty | `https://<ref>.supabase.co` | Realtime only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build, prod | empty | Supabase publishable (anon) key | Public by design; grants nothing on schema `bidlock` |
| `NEXT_PUBLIC_REPO_URL` | build | `https://github.com/firatkill/bidlock` | same | |
| `VERCEL_GIT_COMMIT_SHA` | provided by Vercel | | | Reported by `/api/health` as `version`; fallback `GIT_SHA`, then `"dev"` |

Env validation rules (Zod): `SESSION_SECRET`, `SESSION_SECRET_PREVIOUS` (when non-empty) and `BOT_TOKEN_SECRET` `min(32)` characters; `IP_HASH_SALT` `min(16)`; `TEST_API_SECRET` `min(8)` (the e2e and compose test values in §15.5 and §17.2 satisfy these); `env()` caches its result, and `src/server/env.ts` also exports `resetEnvCacheForTests()` (throws unless `process.env.VITEST` is set) so integration tests can switch `APP_ENV`/`DEMO_MODE`; `APP_ORIGIN` each entry a URL with no path; `DATABASE_URL` must start with `postgres://` or `postgresql://`; if `APP_ENV=production` then `TEST_API_SECRET` and `BOT_SEED_OVERRIDE` must be unset (startup error otherwise).

---

## 6. Database

### 6.1 Migrations and runner

- Files: `db/migrations/NNNN_name.sql`, 4-digit prefix, applied in lexical order. Never edit an applied migration; add a new one.
- Runner `scripts/db/migrate.ts` (decision D-05):
  1. Connect with `DATABASE_URL_ADMIN` (postgres.js, `max: 1`, `prepare: false`).
  2. `select pg_advisory_lock(7272701)`.
  3. `create table if not exists public.bidlock_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())`.
  4. For each file: compute SHA-256 of the file bytes. If the version is recorded and the checksum differs, abort with exit 1 and message `checksum mismatch for <file>`. If not recorded, run the file inside `begin; … commit;` with `sql.unsafe(fileText)` and insert the row in the same transaction.
  5. `--dry-run` lists pending files; `--status` prints a table; `--dir <path>` (default `db/migrations`) is used only by the runner's own integration test.
  6. Release the lock, exit 0.
- `scripts/db/reset.ts --env <test|load> [--db <name>] [--no-pgtap]` refuses to run unless the host in the target URL is `localhost`, `127.0.0.1` or `db` (compose). Target URL: `DATABASE_URL_ADMIN` (default `postgres://postgres:postgres@localhost:54329/bidlock_test`) with its database name replaced by `--db <name>` when given. So `pnpm db:reset` resets `bidlock_test` locally, the database named in `DATABASE_URL_ADMIN` in CI and compose, and `pnpm db:reset --db bidlock` resets the dev database. It runs `drop schema if exists bidlock cascade; drop schema if exists bidlock_test cascade; drop table if exists public.bidlock_migrations;`, then the runner, then `apply-env <env>` (passing `--no-pgtap` through).
- `scripts/db/apply-env.ts <name> [--no-pgtap]` reads `db/env/<name>.sql`, substitutes `:'var'` placeholders (exact pattern `:'[a-z_]+'`) from env vars of the form `BIDLOCK_SQL_<VAR>` (e.g. `:'app_password'` ← `BIDLOCK_SQL_APP_PASSWORD`; a missing variable is an error), and runs it in one transaction with `sql.unsafe`. With `--no-pgtap` it removes every line that starts with `create extension if not exists pgtap` before running (used where the server image has no pgTAP: CI `integration`/`e2e` service containers). It refuses `test` and `load` on non-local hosts and refuses `supabase*` on local hosts.

### 6.2 Connection (server)

```ts
// src/server/db.ts
import "server-only";
import postgres from "postgres";
import { env } from "./env";

function toSafeInt(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(`int8 out of safe range: ${value}`);
  return n;
}

declare global { var __bidlockSql: postgres.Sql | undefined }

export const sql: postgres.Sql =
  globalThis.__bidlockSql ??
  (globalThis.__bidlockSql = postgres(env().DATABASE_URL, {
    prepare: false,          // required by Supavisor transaction mode, see below
    max: env().DB_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    connection: { application_name: "bidlock-app" },
    types: {
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: toSafeInt },
    },
    transform: { undefined: null },
  }));
```

Why `prepare: false`: Supabase's pooler (Supavisor) in transaction mode assigns a server connection per transaction, not per client session. postgres.js by default creates named prepared statements on the server connection and reuses them in later queries; in transaction mode the next query may land on a different server connection where that statement does not exist (or a different statement has the same name), producing `prepared statement "…" does not exist` errors. `prepare: false` makes postgres.js use the unnamed statement for every query, which is valid on any connection. Locally there is no pooler, but the same setting is used everywhere so behaviour matches production. Session-level state (`SET`, advisory locks held across statements, `LISTEN`) is also unavailable through the transaction pooler; the code uses none of it.

postgres.js returns `timestamptz` columns as JS `Date` objects and `jsonb` as parsed JSON (timestamps inside jsonb stay ISO strings). Repo modules convert `Date` values to ISO strings (`toISOString()`) before Zod parsing, so API responses always carry ISO strings.

Every business call is one statement (`select * from bidlock.place_bid($1,$2,$3,$4)`), which postgres.js runs in its own implicit transaction. Do not wrap calls in `sql.begin` unless a task says so.

### 6.3 Roles, schema and privileges

| Role | Login | Used by | Privileges |
|---|---|---|---|
| owner (`postgres` locally and on Supabase) | yes | migrations, pg_cron, tests, scripts | owns schema `bidlock` and every object |
| `bidlock_app` | yes (password set by env SQL) | Next.js runtime | `USAGE` on schema `bidlock`; `EXECUTE` on the API functions listed in §6.6; `SELECT` only on `bidlock.increment_bands`; no other table privileges |
| `anon`, `authenticated` (Supabase) | n/a | PostgREST | nothing on schema `bidlock` (schema not exposed, privileges revoked) |

All functions are `SECURITY DEFINER` with `set search_path = bidlock, pg_temp`, so they run with owner rights while the caller has only `EXECUTE`.

PostgreSQL grants `EXECUTE` on every new function to `PUBLIC`, and a per-schema `alter default privileges in schema bidlock revoke … from public` cannot remove that global default (per-schema default privileges only add to the global ones). Therefore every migration that creates or replaces a function ends with:

```sql
revoke execute on all functions in schema bidlock from public;
```

followed by its explicit `grant execute … to bidlock_app` lines. `revoke` from `PUBLIC` does not remove grants made to `bidlock_app`, so the statement is safe to repeat in every file. This keeps internal helpers (names starting with `_`, plus `advance_auction_locked`, `rate_hit`, `tick`, `close_due_auctions`, `expire_due_offers`, `ensure_public_auction`, `generate_lot_title`, `cleanup_expired`) uncallable by the app role (DB-02 asserts this; decision D-27). `bidlock_app` has `USAGE` on the schema, so without this revoke it could call every function.

### 6.4 DDL

#### 0001_foundation.sql

```sql
create schema if not exists bidlock;
revoke all on schema bidlock from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bidlock_app') then
    create role bidlock_app nologin;
  end if;
end $$;
grant usage on schema bidlock to bidlock_app;
-- No "alter default privileges in schema bidlock revoke … from public": it cannot remove the global
-- PUBLIC EXECUTE default (§6.3). Every migration that defines functions ends with
-- "revoke execute on all functions in schema bidlock from public;" instead. Tables get no PUBLIC
-- privileges by default, so nothing is needed for them.

-- Singleton settings row. Only the owner can change it.
create table bidlock.settings (
  id                    boolean primary key default true check (id),
  env                   text    not null default 'prod' check (env in ('prod', 'test')),
  realtime_mode         text    not null default 'none' check (realtime_mode in ('none', 'broadcast')),
  bidding_paused        boolean not null default false,
  max_active_sandboxes  integer not null default 50 check (max_active_sandboxes between 0 and 1000),
  test_clock_offset_ms  bigint  not null default 0,
  constraint test_clock_only_in_test check (env = 'test' or test_clock_offset_ms = 0)
);
insert into bidlock.settings default values;

-- Time source for every rule. See PRD D-06, D-07.
create or replace function bidlock.bidlock_now()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = bidlock, pg_temp
as $$
declare
  v_override text := nullif(current_setting('bidlock.now_override', true), '');
  v_env      text;
  v_offset   bigint;
begin
  select s.env, s.test_clock_offset_ms into v_env, v_offset from bidlock.settings s;
  if v_override is not null then
    if v_env <> 'test' then
      raise exception using
        errcode = 'BLK01',
        message = 'bidlock.now_override is set but settings.env is not test';
    end if;
    return v_override::timestamptz;
  end if;
  if v_offset <> 0 then
    return clock_timestamp() + make_interval(secs => v_offset / 1000.0);
  end if;
  return clock_timestamp();
end $$;
revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.bidlock_now() to bidlock_app;
```

Semantics equal the brief's `coalesce(nullif(current_setting('bidlock.now_override', true), '')::timestamptz, clock_timestamp())`, plus two guards: an override in a non-test database raises `BLK01` instead of silently applying; and the test clock offset (used by e2e across pooled requests) is forced to zero outside test by a CHECK constraint. pgTAP sets the override with `select set_config('bidlock.now_override', '2026-01-01 12:00:00+00', true)` (transaction-local). `clock_timestamp()` (not `now()`) is used so time advances inside long transactions and after lock waits.

#### 0002_tables.sql

```sql
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
```

Delete semantics: deleting a sandbox cascades to its auction, bots, bids, requests, offers, extensions, strikes and events. `auctions.leader_bidder_id` uses the default `NO ACTION`, checked at end of statement, so a cascade that removes both the auction and its leader bot in one statement succeeds.

#### 0003_increments.sql

```sql
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
```

The TypeScript mirror `src/domain/increments.ts` exports the same array `[[0,50],[1000,100],…]`. INT-03 asserts the database table equals the constant. The TypeScript copy is used only for display (quick bid amounts, the rules table); the server decides.

### 6.5 Shared result types

```sql
create type bidlock.bid_result as (
  outcome          text,         -- 'accepted' | 'rejected'
  error_code       text,         -- null when accepted; see §10.12
  replayed         boolean,
  auction_id       uuid,
  bid_id           uuid,
  bid_no           integer,
  amount           bigint,
  placed_at        timestamptz,
  status           text,
  current_price    bigint,
  leader_bidder_id uuid,
  min_next_bid     bigint,
  max_bid          bigint,
  ends_at          timestamptz,
  extended         boolean,
  extension_count  integer,
  version          bigint,
  server_now       timestamptz
);

create type bidlock.pay_result as (
  outcome        text,
  error_code     text,        -- NOT_FOUND | NOT_PAYABLE | OFFER_EXPIRED | BIDDING_PAUSED
  replayed       boolean,
  auction_id     uuid,
  status         text,
  payment_state  text,
  offer_rank     smallint,
  amount         bigint,
  version        bigint,
  server_now     timestamptz
);

create type bidlock.sandbox_result as (
  outcome         text,
  error_code      text,       -- NOT_FOUND | SANDBOX_EXISTS | SANDBOX_CAPACITY | RATE_LIMITED
  sandbox_id      uuid,
  auction_id      uuid,
  expires_at      timestamptz,
  bot_seed        integer,
  retry_after_ms  integer
);
```

These types are created in `0004_lifecycle.sql` (bid_result, pay_result) and `0010_sandboxes.sql` (sandbox_result).

Code blocks in §7 show function bodies and the `grant` lines; as stated in §6.3, each migration file that defines functions additionally contains `revoke execute on all functions in schema bidlock from public;` after its last function definition (before or after its `grant` lines; order does not matter because the revoke never touches grants to `bidlock_app`). 0004, 0007 and 0011 have no grants; the revoke still applies.

### 6.6 Function inventory

| Function | Migration | Callable by app | Purpose |
|---|---|---|---|
| `bidlock_now()` | 0001 | yes | time source |
| `increment_for`, `min_next_bid`, `max_bid` | 0003 | yes | ladder |
| `_event` | 0002 | no | audit insert |
| `_bid_result` | 0004 | no | result builder |
| `_can_view(auction, bidder)` | 0004 | no | sandbox visibility |
| `_is_due(auction, now)` | 0004 | no | any time-based transition due |
| `advance_auction_locked(auction, now)` | 0004 | no | applies T1, T3, T4, T6, T7, T9 |
| `_close_locked`, `_expire_offer_locked` | 0004 | no | T3/T4, T6/T7/T9 |
| `_idempotency_conflict(...)` | 0005 | no | re-select after a lost `ON CONFLICT` race |
| `place_bid(auction, bidder, amount, key)` | 0005 | yes | T2 |
| `pay_offer(auction, bidder)` | 0006 | yes | T5, T8 |
| `close_due_auctions(limit)`, `expire_due_offers(limit)` | 0007 | no | scheduled path |
| `_advance_one(auction)` | 0007 | no | one auction per subtransaction inside the scheduled path |
| `ensure_public_auction()` | 0007 | no (called inside read functions) | INV-09 |
| `generate_lot_title(seed)` | 0007 | no | titles |
| `tick()` | 0007 | no | cron entry point |
| `rate_hit(limit, subject, now)` | 0008 | no | fixed-window counter |
| `check_bid_rate(bidder, ip_hash)` | 0008 | yes | bid limits |
| `create_bidder(ip_hash)`, `rename_bidder(bidder, name)` | 0009 | yes | identity |
| `auction_state(auction, viewer)` | 0009 | yes | state read with lazy transitions |
| `list_bids(auction, viewer, before, after, limit)` | 0009 | yes | history |
| `list_auctions(viewer)` | 0009 | yes | lobby |
| `get_me(bidder)` | 0009 | yes | profile, active sandbox, open offers |
| `stats()` | 0009 | yes | /how-it-works stats |
| `create_sandbox(owner, ip_hash, seed)` | 0010 | yes | sandbox + 3 bots |
| `sandbox_bots(owner, sandbox)` | 0010 | yes | data for bot tokens |
| `cleanup_expired()` | 0010 | no | nightly cleanup |
| `_publish_auction()` (trigger) | 0011 | no | realtime |
| `create_test_auction(...)`, `set_test_clock(ms)` | 0012 | yes, but raise unless `env = 'test'` | test support |

---

## 7. SQL functions

### 7.1 Lifecycle internals (0004_lifecycle.sql)

```sql
create or replace function bidlock._bid_result(
  a bidlock.auctions, p_outcome text, p_code text, p_now timestamptz
) returns bidlock.bid_result
language plpgsql stable security definer set search_path = bidlock, pg_temp as $$
declare r bidlock.bid_result;
begin
  r.outcome    := p_outcome;
  r.error_code := p_code;
  r.replayed   := false;
  r.server_now := p_now;
  if a.id is not null then
    r.auction_id       := a.id;
    r.status           := a.status;
    r.current_price    := a.current_price;
    r.leader_bidder_id := a.leader_bidder_id;
    r.min_next_bid     := bidlock.min_next_bid(a.starting_price, a.current_price);
    r.max_bid          := bidlock.max_bid(a.starting_price, a.current_price);
    r.ends_at          := a.ends_at;
    r.extended         := false;
    r.extension_count  := a.extension_count;
    r.version          := a.version;
  end if;
  return r;
end $$;

create or replace function bidlock._can_view(a bidlock.auctions, p_bidder_id uuid)
returns boolean language sql stable security definer set search_path = bidlock, pg_temp as $$
  select case
    when a.kind <> 'sandbox' then true
    when p_bidder_id is null then false
    else exists (select 1 from bidlock.sandboxes s where s.id = a.sandbox_id and s.owner_id = p_bidder_id)
      or exists (select 1 from bidlock.bidders d where d.id = p_bidder_id and d.sandbox_id = a.sandbox_id)
  end;
$$;

create or replace function bidlock._is_due(a bidlock.auctions, p_now timestamptz)
returns boolean language sql stable security definer set search_path = bidlock, pg_temp as $$
  select (a.status = 'scheduled' and p_now >= a.starts_at)
      or (a.status = 'live' and p_now >= a.ends_at)
      or (a.status = 'closed' and exists (
            select 1 from bidlock.offers o
            where o.auction_id = a.id and o.status = 'open' and p_now >= o.deadline));
$$;

-- T3 / T4. Caller holds the row lock.
create or replace function bidlock._close_locked(a bidlock.auctions, p_now timestamptz)
returns bidlock.auctions
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare r bidlock.auctions;
begin
  if a.bid_count = 0 then
    update bidlock.auctions
       set status = 'unsold', payment_state = null, closed_at = a.ends_at, version = version + 1
     where id = a.id
     returning * into r;
    perform bidlock._event(a.id, 'auction_unsold', null, jsonb_build_object('reason', 'no_bids'), p_now);
  else
    update bidlock.auctions
       set status = 'closed', payment_state = 'awaiting_payment', closed_at = a.ends_at, version = version + 1
     where id = a.id
     returning * into r;
    insert into bidlock.offers (auction_id, rank, bidder_id, amount, status, opened_at, deadline)
    values (a.id, 1, a.leader_bidder_id, a.current_price, 'open', p_now,
            p_now + make_interval(secs => a.payment_window_s));
    perform bidlock._event(a.id, 'auction_closed', a.leader_bidder_id,
                           jsonb_build_object('price', a.current_price, 'bid_count', a.bid_count), p_now);
    perform bidlock._event(a.id, 'offer_opened', a.leader_bidder_id,
                           jsonb_build_object('rank', 1, 'amount', a.current_price), p_now);
  end if;
  return r;
end $$;

-- T6 / T7 / T9. Caller holds the row lock; o is the open offer whose deadline passed.
create or replace function bidlock._expire_offer_locked(a bidlock.auctions, o bidlock.offers, p_now timestamptz)
returns bidlock.auctions
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  r        bidlock.auctions;
  v_runner record;
begin
  update bidlock.offers set status = 'expired', resolved_at = p_now where id = o.id;
  perform bidlock._event(a.id, 'offer_expired', o.bidder_id, jsonb_build_object('rank', o.rank), p_now);

  if o.rank = 1 then
    insert into bidlock.payment_strikes (bidder_id, auction_id, offer_id, created_at)
    values (o.bidder_id, a.id, o.id, p_now);
    update bidlock.bidders set payment_strikes = payment_strikes + 1 where id = o.bidder_id;
    perform bidlock._event(a.id, 'strike_recorded', o.bidder_id, '{}'::jsonb, p_now);

    -- Runner-up: the bidder other than the winner with the highest own bid.
    select b.bidder_id, max(b.amount) as amount
      into v_runner
      from bidlock.bids b
     where b.auction_id = a.id and b.bidder_id <> o.bidder_id
     group by b.bidder_id
     order by max(b.amount) desc
     limit 1;

    if found then
      insert into bidlock.offers (auction_id, rank, bidder_id, amount, status, opened_at, deadline)
      values (a.id, 2, v_runner.bidder_id, v_runner.amount, 'open', p_now,
              p_now + make_interval(secs => a.payment_window_s));
      update bidlock.auctions
         set payment_state = 'offered_to_runner_up', version = version + 1
       where id = a.id
       returning * into r;
      perform bidlock._event(a.id, 'offer_opened', v_runner.bidder_id,
                             jsonb_build_object('rank', 2, 'amount', v_runner.amount), p_now);
      return r;
    end if;
  end if;

  update bidlock.auctions
     set status = 'unsold', payment_state = 'expired', version = version + 1
   where id = a.id
   returning * into r;
  perform bidlock._event(a.id, 'auction_unsold', null,
                         jsonb_build_object('reason', case when o.rank = 1 then 'winner_expired_no_runner_up'
                                                           else 'runner_up_expired' end), p_now);
  return r;
end $$;

-- Applies every due time-based transition to one auction. Takes (or re-takes) the row lock;
-- re-locking a row this transaction already holds is a no-op.
create or replace function bidlock.advance_auction_locked(p_auction bidlock.auctions, p_now timestamptz)
returns bidlock.auctions
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a       bidlock.auctions;
  o       bidlock.offers;
  v_steps integer := 0;
begin
  select * into a from bidlock.auctions where id = p_auction.id for update;
  loop
    v_steps := v_steps + 1;
    if v_steps > 8 then
      raise exception using errcode = 'BLK03', message = format('advance_auction_locked: no fixpoint for %s', a.id);
    end if;

    if a.status = 'scheduled' and p_now >= a.starts_at then
      update bidlock.auctions set status = 'live', version = version + 1 where id = a.id returning * into a;
      perform bidlock._event(a.id, 'auction_started', null, '{}'::jsonb, p_now);
    elsif a.status = 'live' and p_now >= a.ends_at then
      a := bidlock._close_locked(a, p_now);
    elsif a.status = 'closed' then
      select * into o from bidlock.offers where auction_id = a.id and status = 'open';
      exit when not found or p_now < o.deadline;
      a := bidlock._expire_offer_locked(a, o, p_now);
    else
      exit;
    end if;
  end loop;
  return a;
end $$;
```

An auction created `scheduled` whose `ends_at` has already passed when first touched goes T1 then T3 in one call. A winner who never pays and a runner-up who never pays, with nobody touching the auction for 10 minutes, is processed as T6 at the first touch (runner-up window opens then, D-14), not as T6+T9 at once, because the runner-up's deadline is computed from `p_now`.

### 7.2 place_bid (0005_place_bid.sql)

```sql
create or replace function bidlock.place_bid(
  p_auction_id      uuid,
  p_bidder_id       uuid,
  p_amount          bigint,
  p_idempotency_key uuid
) returns bidlock.bid_result
language plpgsql
volatile
security definer
set search_path = bidlock, pg_temp
as $$
declare
  v_auction   bidlock.auctions;
  v_bidder    bidlock.bidders;
  v_prev      bidlock.bid_requests;
  v_result    bidlock.bid_result;
  v_now       timestamptz;
  v_code      text;
  v_min       bigint;
  v_max       bigint;
  v_new_ends  timestamptz;
  v_extended  boolean := false;
  v_bid_id    uuid := gen_random_uuid();
  v_req_id    uuid := gen_random_uuid();
  v_bid_no    integer;
  v_rows      integer;
begin
  -- 0. Argument checks. The API validates first; these protect direct SQL callers.
  if p_auction_id is null or p_bidder_id is null or p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'place_bid: null argument';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then
    return bidlock._bid_result(null, 'rejected', 'VALIDATION', bidlock.bidlock_now());
  end if;

  select * into v_bidder from bidlock.bidders where id = p_bidder_id;
  if not found then
    return bidlock._bid_result(null, 'rejected', 'NOT_FOUND', bidlock.bidlock_now());
  end if;

  if (select s.bidding_paused from bidlock.settings s) then
    return bidlock._bid_result(null, 'rejected', 'BIDDING_PAUSED', bidlock.bidlock_now());
  end if;

  -- 1. Serialize all bids on this auction. A concurrent place_bid waits here until we commit.
  --    Under Read Committed, once the lock is granted the row returned is the latest committed version.
  select * into v_auction from bidlock.auctions where id = p_auction_id for update;
  if not found or not bidlock._can_view(v_auction, p_bidder_id)
     or (v_bidder.is_bot and v_auction.sandbox_id is distinct from v_bidder.sandbox_id) then
    return bidlock._bid_result(null, 'rejected', 'NOT_FOUND', bidlock.bidlock_now());
  end if;

  -- 2. Read the clock AFTER the lock: a bid that waited in the queue past ends_at must be rejected.
  v_now := bidlock.bidlock_now();

  -- 3. Idempotency. This is a new statement, so it sees requests committed while we waited for the lock.
  select * into v_prev
    from bidlock.bid_requests r
   where r.bidder_id = p_bidder_id and r.idempotency_key = p_idempotency_key;
  if found then
    if v_prev.auction_id <> p_auction_id or v_prev.amount <> p_amount then
      return bidlock._bid_result(v_auction, 'rejected', 'IDEMPOTENCY_MISMATCH', v_now);
    end if;
    v_result := jsonb_populate_record(null::bidlock.bid_result, v_prev.result);
    v_result.replayed := true;
    return v_result;
  end if;

  -- 4. Lazy transitions: start a due scheduled auction, close a due live one (committed with this call).
  v_auction := bidlock.advance_auction_locked(v_auction, v_now);

  -- 5. Rules, in this order (first failure wins).
  v_min := bidlock.min_next_bid(v_auction.starting_price, v_auction.current_price);
  v_max := bidlock.max_bid(v_auction.starting_price, v_auction.current_price);
  if v_auction.status = 'scheduled' then
    v_code := 'AUCTION_NOT_LIVE';
  elsif v_auction.status <> 'live' or v_now >= v_auction.ends_at then
    v_code := 'AUCTION_CLOSED';
  elsif v_auction.leader_bidder_id = p_bidder_id then
    v_code := 'ALREADY_LEADING';
  elsif p_amount < v_min then
    v_code := 'BID_TOO_LOW';
  elsif p_amount > v_max then
    v_code := 'BID_TOO_HIGH';
  end if;

  if v_code is not null then
    v_result := bidlock._bid_result(v_auction, 'rejected', v_code, v_now);
    insert into bidlock.bid_requests
      (id, bidder_id, idempotency_key, auction_id, amount, outcome, error_code, result, created_at)
    values
      (v_req_id, p_bidder_id, p_idempotency_key, p_auction_id, p_amount, 'rejected', v_code, to_jsonb(v_result), v_now)
    on conflict on constraint idempotency_unique do nothing;
    if not found then
      -- The same (bidder, key) was inserted concurrently by a request holding a DIFFERENT auction lock.
      -- ON CONFLICT DO NOTHING waited for that transaction to commit; re-select in a new statement
      -- (fresh Read Committed snapshot) and answer from the committed row.
      return bidlock._idempotency_conflict(p_bidder_id, p_idempotency_key, p_auction_id, p_amount, v_auction, v_now);
    end if;
    return v_result;
  end if;

  -- 6. Soft close.
  v_new_ends := v_auction.ends_at;
  if v_auction.snipe_window_s > 0
     and v_now >= v_auction.ends_at - make_interval(secs => v_auction.snipe_window_s)
     and v_auction.extension_count < v_auction.max_extensions then
    v_new_ends := greatest(v_auction.ends_at, v_now + make_interval(secs => v_auction.extend_by_s));
    v_extended := v_new_ends > v_auction.ends_at;
  end if;
  v_bid_no := v_auction.bid_count + 1;

  -- 7. Build the result for the post-bid state (stored for replays).
  v_result := bidlock._bid_result(v_auction, 'accepted', null, v_now);
  v_result.bid_id           := v_bid_id;
  v_result.bid_no           := v_bid_no;
  v_result.amount           := p_amount;
  v_result.placed_at        := v_now;
  v_result.status           := 'live';
  v_result.current_price    := p_amount;
  v_result.leader_bidder_id := p_bidder_id;
  v_result.min_next_bid     := bidlock.min_next_bid(v_auction.starting_price, p_amount);
  v_result.max_bid          := bidlock.max_bid(v_auction.starting_price, p_amount);
  v_result.ends_at          := v_new_ends;
  v_result.extended         := v_extended;
  v_result.extension_count  := v_auction.extension_count + case when v_extended then 1 else 0 end;
  v_result.version          := v_auction.version + 1;

  -- 8. Writes: request, bid, auction (version-guarded), extension, audit.
  insert into bidlock.bid_requests
    (id, bidder_id, idempotency_key, auction_id, amount, outcome, error_code, result, created_at)
  values
    (v_req_id, p_bidder_id, p_idempotency_key, p_auction_id, p_amount, 'accepted', null, to_jsonb(v_result), v_now)
  on conflict on constraint idempotency_unique do nothing;
  if not found then
    -- Nothing has been written by this call yet except lazy transitions, which may commit.
    return bidlock._idempotency_conflict(p_bidder_id, p_idempotency_key, p_auction_id, p_amount, v_auction, v_now);
  end if;

  insert into bidlock.bids
    (id, auction_id, bid_no, bidder_id, amount, prev_amount, min_required, placed_at, ends_at_before, ends_at_after, request_id)
  values
    (v_bid_id, p_auction_id, v_bid_no, p_bidder_id, p_amount, v_auction.current_price, v_min, v_now,
     v_auction.ends_at, v_new_ends, v_req_id);

  update bidlock.auctions
     set current_price    = p_amount,
         leader_bidder_id = p_bidder_id,
         last_bid_id      = v_bid_id,
         bid_count        = v_bid_no,
         ends_at          = v_new_ends,
         extension_count  = v_result.extension_count,
         version          = version + 1
   where id = p_auction_id
     and version = v_auction.version;          -- second guard (D-08)
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode = 'BLK10',
      message = format('place_bid: version guard failed for auction %s at version %s', p_auction_id, v_auction.version);
  end if;

  if v_extended then
    insert into bidlock.auction_extensions (auction_id, n, bid_id, old_ends_at, new_ends_at, at)
    values (p_auction_id, v_result.extension_count, v_bid_id, v_auction.ends_at, v_new_ends, v_now);
  end if;

  perform bidlock._event(p_auction_id, 'bid_accepted', p_bidder_id,
    jsonb_build_object('bid_id', v_bid_id, 'bid_no', v_bid_no, 'amount', p_amount), v_now);
  if v_extended then
    perform bidlock._event(p_auction_id, 'auction_extended', p_bidder_id,
      jsonb_build_object('n', v_result.extension_count, 'old_ends_at', v_auction.ends_at, 'new_ends_at', v_new_ends), v_now);
  end if;

  return v_result;
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.place_bid(uuid, uuid, bigint, uuid) to bidlock_app;
```

The conflict helper is defined in the same migration, before `place_bid`:

```sql
-- Re-select after ON CONFLICT DO NOTHING lost the race. Same auction + amount => replay of the
-- committed result (cannot normally happen because the auction lock serializes same-auction
-- duplicates, but answering from the row keeps the function correct if that ever changes);
-- otherwise IDEMPOTENCY_MISMATCH. Nothing is stored.
create or replace function bidlock._idempotency_conflict(
  p_bidder_id uuid, p_key uuid, p_auction_id uuid, p_amount bigint, a bidlock.auctions, p_now timestamptz
) returns bidlock.bid_result
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_prev   bidlock.bid_requests;
  v_result bidlock.bid_result;
begin
  select * into v_prev from bidlock.bid_requests r
   where r.bidder_id = p_bidder_id and r.idempotency_key = p_key;
  if found and v_prev.auction_id = p_auction_id and v_prev.amount = p_amount then
    v_result := jsonb_populate_record(null::bidlock.bid_result, v_prev.result);
    v_result.replayed := true;
    return v_result;
  end if;
  return bidlock._bid_result(a, 'rejected', 'IDEMPOTENCY_MISMATCH', p_now);
end $$;
```

Call from TypeScript: `select * from bidlock.place_bid(${auctionId}, ${bidderId}, ${amount}, ${key})` and parse the single row with `BidResultRow` (Zod).

#### 7.2.1 Why Read Committed plus a row lock is sufficient

- The race to prevent is check-then-write: two transactions read price $10, both validate $11, both write. `SELECT … FOR UPDATE` on the auction row makes the read and the later write part of one critical section per auction. The second transaction blocks at the lock.
- In Read Committed, when the blocked `SELECT … FOR UPDATE` resumes, PostgreSQL re-reads the updated row version (EvalPlanQual) and returns the newest committed values. Every later statement in the function takes a fresh snapshot, so the idempotency lookup and the runner-up query also see everything committed before the lock was granted.
- The clock is read after the lock, so queueing time counts against the bidder (no bid is accepted after `ends_at` because it waited).
- Every write that depends on the auction's state (bid row, auction update, extension, offers) happens while holding the lock, so commit order equals lock order and `bid_no` order (INV-03).
- `SERIALIZABLE` would also be correct but would turn every contended bid into a serialization failure that must be retried by the client, adding latency and code. A lock queue gives the same guarantee with no retries.
- Deadlocks cannot involve two `place_bid` calls: each locks exactly one auction row, then inserts rows keyed by new UUIDs plus exactly one `(bidder, key)` entry in `idempotency_unique`. The only other wait is that unique-index wait: a call on auction B whose key is being inserted by an uncommitted call on auction A waits for A to finish; A never waits on B (it needs no second auction and no second key), so no cycle forms. FK checks on `bids.bidder_id` take `FOR KEY SHARE` on the bidder row, which does not conflict with the `FOR NO KEY UPDATE` taken by strike updates and `create_sandbox`. The rate limiter runs in a separate earlier transaction (D-10), so its counter rows are never held while waiting for the auction lock.
- Concurrent duplicates: two identical requests (same bidder, key, auction, amount) queue on the auction lock; the second one's idempotency lookup is a new statement, sees the first one's committed row and returns `replayed = true`. Same key on two different auctions: both pass the lookup, the second `INSERT … ON CONFLICT DO NOTHING` waits for the first commit, inserts nothing, and `_idempotency_conflict` re-selects and returns `IDEMPOTENCY_MISMATCH` (INT-02).

#### 7.2.2 The version column

`version` is not the concurrency control (an optimistic-only design would make most concurrent bids fail with a conflict and retry). It is used for:

1. Second guard: the auction `UPDATE … WHERE version = <read version>` must affect exactly one row; otherwise `BLK10` aborts the transaction. With the lock this can never fire; it is a secondary concurrency guard. With both auction row locks removed (in `place_bid` and `advance_auction_locked`), the `bid_no_unique` constraint can reject the insert with `23505` before this UPDATE executes; INT-01 detects the thrown SQL errors (mutation verification, D-50).
2. Ordering key for the client: a feed event with `version <= local version` is stale and ignored (§11.7).
3. HTTP `ETag` for the state endpoint.

#### 7.2.3 Edge cases and their results

| Case | Result |
|---|---|
| Amount 0, negative, > 100,000,000 | `VALIDATION` (not stored) |
| Unknown auction, sandbox not yours, bot outside its sandbox | `NOT_FOUND` (not stored) |
| `settings.bidding_paused` | `BIDDING_PAUSED` (not stored) |
| Same key, same auction, same amount | stored result, `replayed = true` (even if that bidder has since been outbid or the auction closed) |
| Same key, different amount or auction | `IDEMPOTENCY_MISMATCH` (not stored; original untouched) |
| Auction scheduled | `AUCTION_NOT_LIVE` (stored) |
| `now >= ends_at` | `AUCTION_CLOSED` (stored), close committed in the same transaction |
| Bidder is leader | `ALREADY_LEADING` (stored) |
| Below minimum / above cap | `BID_TOO_LOW` / `BID_TOO_HIGH` (stored) |
| Bid at exactly `ends_at - snipe_window_s` | accepted, extends |
| Bid at `ends_at - 1 µs` | accepted, extends |
| Bid at exactly `ends_at` | `AUCTION_CLOSED` |
| 21st late bid (cap 20) | accepted, no extension |
| `snipe_window_s = 0` | never extends |

### 7.3 Settlement (0006_settlement.sql)

```sql
create or replace function bidlock.pay_offer(p_auction_id uuid, p_bidder_id uuid)
returns bidlock.pay_result
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  a     bidlock.auctions;
  o     bidlock.offers;
  r     bidlock.pay_result;
  v_now timestamptz;
begin
  r.replayed := false;
  if (select s.bidding_paused from bidlock.settings s) then
    r.outcome := 'rejected'; r.error_code := 'BIDDING_PAUSED'; r.server_now := bidlock.bidlock_now();
    return r;
  end if;

  select * into a from bidlock.auctions where id = p_auction_id for update;
  if not found or not bidlock._can_view(a, p_bidder_id) then
    r.outcome := 'rejected'; r.error_code := 'NOT_FOUND'; r.server_now := bidlock.bidlock_now();
    return r;
  end if;

  v_now := bidlock.bidlock_now();
  a := bidlock.advance_auction_locked(a, v_now);   -- expires a due offer before we look at it

  r.auction_id := a.id; r.server_now := v_now;

  select * into o from bidlock.offers
   where auction_id = a.id and bidder_id = p_bidder_id and status = 'paid';
  if found then                                     -- idempotent: paying twice returns the first payment
    r.outcome := 'accepted'; r.replayed := true;
    r.status := a.status; r.payment_state := a.payment_state;
    r.offer_rank := o.rank; r.amount := o.amount; r.version := a.version;
    return r;
  end if;

  select * into o from bidlock.offers
   where auction_id = a.id and bidder_id = p_bidder_id and status = 'open';
  if not found then
    r.outcome := 'rejected';
    r.error_code := case when exists (
        select 1 from bidlock.offers x
         where x.auction_id = a.id and x.bidder_id = p_bidder_id and x.status = 'expired')
      then 'OFFER_EXPIRED' else 'NOT_PAYABLE' end;
    r.status := a.status; r.payment_state := a.payment_state; r.version := a.version;
    return r;
  end if;

  -- advance_auction_locked guarantees v_now < o.deadline here.
  update bidlock.offers set status = 'paid', resolved_at = v_now where id = o.id;
  update bidlock.auctions
     set status = 'settled', payment_state = 'paid', settled_at = v_now, version = version + 1
   where id = a.id
   returning * into a;
  perform bidlock._event(a.id, 'offer_paid', p_bidder_id,
                         jsonb_build_object('rank', o.rank, 'amount', o.amount), v_now);

  r.outcome := 'accepted'; r.status := a.status; r.payment_state := a.payment_state;
  r.offer_rank := o.rank; r.amount := o.amount; r.version := a.version;
  return r;
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.pay_offer(uuid, uuid) to bidlock_app;
```

The pay endpoint carries no idempotency key: paying is naturally idempotent per (auction, bidder) because at most one offer per bidder can be paid (`offers_one_paid_idx`) and a second call returns `replayed = true`.

### 7.4 Scheduler path (0007_scheduler.sql)

```sql
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
returns text language sql immutable set search_path = bidlock, pg_temp as $$
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
```

Locking notes for the scheduler path:
- A PL/pgSQL `FOR … IN SELECT … FOR UPDATE SKIP LOCKED LIMIT n` loop locks each row as the cursor fetches it and keeps every lock until `tick()` commits; rows already locked by a bid are skipped, never waited for. A batch therefore delays bids on the auctions it holds by at most the batch's run time (milliseconds for ≤ 200 rows).
- pg_cron never starts a second run of the same job while one is still running, so two `tick()` calls overlap only if someone runs `pnpm db:ticker` or `select bidlock.tick()` by hand against the same database. Two overlapping batches can deadlock on bidder rows (strike updates in different orders); PostgreSQL detects it, `_advance_one` turns it into a warning for one auction, and the next tick retries it.

#### 7.4.1 Which path applies which transition

| Situation | Path that applies it | Latency after the due time |
|---|---|---|
| A bid arrives after `ends_at` | `place_bid` (lazy), same transaction; bid rejected `AUCTION_CLOSED` | 0 |
| Someone reads state (`GET /state`, `GET /api/auctions`) after `ends_at` / deadline / `starts_at` (`get_me` does not advance; it hides expired offers) | `auction_state` / `ensure_public_auction` (lazy) if the row is not locked; otherwise the locking bid applies it | 0 to one poll / broadcast round |
| A pay request after the deadline | `pay_offer` (lazy) applies T6/T7/T9 and returns `OFFER_EXPIRED` | 0 |
| Nobody touches the auction (production) | `tick()` via pg_cron every minute | ≤ 60 s + job runtime |
| Nobody touches the auction (local/CI) | stays due until touched; `pnpm db:ticker` loops `tick()` every 5 s if wanted | until touched |
| Next public lot | `ensure_public_auction()` from `tick()`, `list_auctions()` and `auction_state()` of a finished public lot | 15 s after the logical close, or first lobby visit |

Correctness never depends on the scheduled path. It only bounds how long an untouched auction looks live in the database (clients already show "Closing…" from their own clock).

### 7.5 Rate limiter (0008_rate_limits.sql)

```sql
create table bidlock.rate_limits (
  name      text primary key,
  window_s  integer not null check (window_s between 1 and 86400),
  max_hits  integer not null check (max_hits >= 1)
);
insert into bidlock.rate_limits (name, window_s, max_hits) values
  ('bid_bidder_1s',          1,    3),     -- human burst
  ('bid_bidder_60s',         60,   60),    -- human sustained
  ('bid_bot_2s',             2,    1),     -- bot: 1 bid per 2 s
  ('bid_ip_60s',             60,   200),   -- per IP hash
  ('sandbox_ip_3600s',       3600, 5),     -- sandbox creation
  ('bidder_create_ip_3600s', 3600, 20);    -- guest creation

-- UNLOGGED: counters are disposable; losing them on crash only resets limits.
create unlogged table bidlock.rate_counters (
  bucket        text        not null,     -- '<limit name>:<subject>'
  window_start  timestamptz not null,
  hits          integer     not null,
  primary key (bucket, window_start)
);
create index rate_counters_window_idx on bidlock.rate_counters (window_start);

-- Returns 0 when allowed, else milliseconds until the window resets. Counts every call (also rejected ones).
create or replace function bidlock.rate_hit(p_limit text, p_subject text, p_now timestamptz)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_window integer;
  v_max    integer;
  v_start  timestamptz;
  v_hits   integer;
begin
  select l.window_s, l.max_hits into v_window, v_max from bidlock.rate_limits l where l.name = p_limit;
  if not found then
    raise exception using errcode = 'BLK20', message = format('unknown rate limit %s', p_limit);
  end if;
  v_start := to_timestamp(floor(extract(epoch from p_now) / v_window) * v_window);

  insert into bidlock.rate_counters as c (bucket, window_start, hits)
  values (p_limit || ':' || p_subject, v_start, 1)
  on conflict (bucket, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;

  if v_hits <= v_max then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window) - p_now)) * 1000))::integer;
end $$;

-- Called by POST /bids in its own statement BEFORE place_bid (D-10).
create or replace function bidlock.check_bid_rate(p_bidder_id uuid, p_ip_hash text)
returns integer
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_now    timestamptz := bidlock.bidlock_now();
  v_is_bot boolean;
  v_retry  integer := 0;
begin
  select d.is_bot into v_is_bot from bidlock.bidders d where d.id = p_bidder_id;
  if not found then
    return 0;                               -- place_bid will answer NOT_FOUND
  end if;
  if v_is_bot then
    v_retry := greatest(v_retry, bidlock.rate_hit('bid_bot_2s', p_bidder_id::text, v_now));
  else
    v_retry := greatest(v_retry, bidlock.rate_hit('bid_bidder_1s', p_bidder_id::text, v_now));
    v_retry := greatest(v_retry, bidlock.rate_hit('bid_bidder_60s', p_bidder_id::text, v_now));
  end if;
  v_retry := greatest(v_retry, bidlock.rate_hit('bid_ip_60s', p_ip_hash, v_now));
  return v_retry;
end $$;

revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.check_bid_rate(uuid, text) to bidlock_app;
```

Notes:
- Fixed windows allow up to 2× the limit across a window boundary (e.g. 3 bids at 0.99 s and 3 at 1.01 s). This is accepted for a demo.
- Race safety: `INSERT … ON CONFLICT DO UPDATE … RETURNING` is atomic per counter row. Concurrent first hits on a new bucket serialize on the unique index (one inserts, the others wait and take the update branch), so no hit is lost and no unique violation escapes. The counter row lock is held until the statement's implicit transaction commits; `check_bid_rate` always locks its rows in the same order (bidder buckets, then the IP bucket), so two callers cannot deadlock.
- Not atomic with the bid: the rate check and `place_bid` are separate statements (D-10), so the limit is approximate by at most the requests in flight between the two statements. This is accepted.
- Every limit is evaluated (no short-circuit), so a hammering client keeps incrementing all counters and stays limited.
- Counter rows older than 2 hours are deleted by cron every 10 minutes and by `cleanup_expired()`.
- `p_ip_hash` is computed in TypeScript (§13.6); SQL never sees a raw IP.

### 7.6 Reads and identity (0009_reads.sql)

```sql
create or replace function bidlock.create_bidder(p_ip_hash text)
returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare v_retry integer; v_id uuid; v_name text;
begin
  v_retry := bidlock.rate_hit('bidder_create_ip_3600s', p_ip_hash, bidlock.bidlock_now());
  if v_retry > 0 then
    return jsonb_build_object('outcome', 'rejected', 'error_code', 'RATE_LIMITED', 'retry_after_ms', v_retry);
  end if;
  v_name := 'Bidder ' || (1000 + floor(random() * 9000))::int::text;
  insert into bidlock.bidders (display_name) values (v_name) returning id into v_id;
  return jsonb_build_object('outcome', 'accepted', 'bidder_id', v_id, 'display_name', v_name);
end $$;

create or replace function bidlock.rename_bidder(p_bidder_id uuid, p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
begin
  -- Content rules (characters, profanity, "bot" suffix) are input validation done in TypeScript;
  -- length is re-checked by the column constraint.
  update bidlock.bidders set display_name = p_name where id = p_bidder_id and not is_bot;
  if not found then
    return jsonb_build_object('outcome', 'rejected', 'error_code', 'NOT_FOUND');
  end if;
  return jsonb_build_object('outcome', 'accepted');
end $$;
```

`auction_state(p_auction_id uuid, p_viewer_id uuid) returns jsonb`:

1. `select * into a from auctions where id = p_auction_id` (no lock). Not found or `not _can_view(a, p_viewer_id)` → return `null`.
2. `v_now := bidlock_now()`. If `_is_due(a, v_now)`: `select … for update skip locked`; if acquired, `a := advance_auction_locked(a, v_now)`; if not acquired, re-read without lock (a bid in flight will apply it).
3. If `a.kind = 'public'` and status not in (`scheduled`, `live`): `v_next := ensure_public_auction()`; otherwise `v_next := null`. (The room's "Next lot starts in {m:ss}" line is computed by the client from `GET /api/auctions/<next_public_auction_id>/state`, fetched once when the id first appears; decision D-37.)
4. Return the object below (snake_case keys; `null` for absent values). Shape is mirrored by Zod schema `AuctionState` (§10.4).

```sql
jsonb_build_object(
  'id', a.id, 'lot_no', a.lot_no, 'kind', a.kind, 'title', a.title,
  'status', a.status, 'payment_state', a.payment_state,
  'starting_price', a.starting_price, 'current_price', a.current_price,
  'min_next_bid', bidlock.min_next_bid(a.starting_price, a.current_price),
  'max_bid', bidlock.max_bid(a.starting_price, a.current_price),
  'increment', bidlock.increment_for(coalesce(a.current_price, a.starting_price)),
  'bid_count', a.bid_count,
  'leader', (select jsonb_build_object('id', d.id, 'display_name', d.display_name, 'is_bot', d.is_bot)
               from bidlock.bidders d where d.id = a.leader_bidder_id),
  'starts_at', a.starts_at, 'ends_at', a.ends_at, 'original_ends_at', a.original_ends_at,
  'closed_at', a.closed_at, 'settled_at', a.settled_at,
  'snipe_window_s', a.snipe_window_s, 'extend_by_s', a.extend_by_s,
  'max_extensions', a.max_extensions, 'extension_count', a.extension_count,
  'last_extension', (select jsonb_build_object('n', e.n, 'bid_id', e.bid_id, 'old_ends_at', e.old_ends_at,
                                               'new_ends_at', e.new_ends_at, 'at', e.at)
                       from bidlock.auction_extensions e where e.auction_id = a.id order by e.n desc limit 1),
  'offer', (select jsonb_build_object('rank', o.rank, 'bidder_id', o.bidder_id, 'display_name', d.display_name,
                                      'is_bot', d.is_bot, 'amount', o.amount, 'status', o.status,
                                      'opened_at', o.opened_at, 'deadline', o.deadline)
              from bidlock.offers o join bidlock.bidders d on d.id = o.bidder_id
             where o.auction_id = a.id and o.status in ('open', 'paid')
             order by o.rank desc limit 1),
  'expired_offers', (select coalesce(jsonb_agg(jsonb_build_object('rank', o.rank, 'bidder_id', o.bidder_id) order by o.rank), '[]')
                       from bidlock.offers o where o.auction_id = a.id and o.status = 'expired'),
  'sandbox', (select jsonb_build_object('id', s.id, 'owner_id', s.owner_id, 'expires_at', s.expires_at)
                from bidlock.sandboxes s where s.id = a.sandbox_id),
  'next_public_auction_id', v_next,
  'version', a.version,
  'server_now', bidlock.bidlock_now()
)
```

`list_bids(p_auction_id uuid, p_viewer_id uuid, p_before integer, p_after integer, p_limit integer) returns jsonb`: visibility as above (null when hidden). `p_before` (cursor) returns bids with `bid_no < p_before` newest first; `p_after` returns bids with `bid_no > p_after` oldest first (gap fill); neither returns the newest `p_limit` (1–50) newest first. Each item: `id, bid_no, bidder_id, display_name, is_bot, amount, placed_at, extended (ends_at_after > ends_at_before)`. Returns `{ "bids": [...], "next_cursor": <smallest bid_no returned, or null when bid_no 1 is included> }`.

Volatility: `auction_state` and `list_auctions` are `volatile` (they may apply transitions and insert the next public lot); `list_bids`, `get_me` and `stats` are `stable`. All are `security definer set search_path = bidlock, pg_temp`.

`list_auctions(p_viewer_id uuid) returns jsonb`: calls `ensure_public_auction()`, returns `{ "public": <auction_state(public id, viewer)>, "sandbox": <auction_state of the viewer's latest non-expired sandbox auction or null> }`.

`get_me(p_bidder_id uuid) returns jsonb`: `null` if the bidder does not exist or is a bot. Otherwise `{ id, display_name, payment_strikes, active_sandbox: {sandbox_id, auction_id, expires_at, status, ends_at} | null, open_offers: [{auction_id, lot_no, title, rank, amount, deadline}], server_now }` where `active_sandbox` is the newest sandbox that is active per FR-32 (not expired, auction `scheduled`/`live`/`closed`), open offers have `status = 'open' and deadline > bidlock_now()` (ordered by deadline), and `server_now = bidlock_now()`. `get_me` performs no lazy transitions (it is a pure read; an offer past its deadline is simply omitted).

`stats() returns jsonb`: `{ bids_today: count(bids where placed_at >= date_trunc('day', bidlock_now(), 'UTC')), active_sandboxes: <count per FR-32 definition>, public_lots_today: count(auctions kind=public and created_at >= today) , server_now }`. The API caches it for 60 s.

Grants (after `revoke execute on all functions in schema bidlock from public;`): `grant execute on function bidlock.create_bidder(text), bidlock.rename_bidder(uuid, text), bidlock.auction_state(uuid, uuid), bidlock.list_bids(uuid, uuid, integer, integer, integer), bidlock.list_auctions(uuid), bidlock.get_me(uuid), bidlock.stats() to bidlock_app;`

### 7.7 Sandboxes (0010_sandboxes.sql)

```sql
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
```

### 7.8 Test support (0012_test_support.sql)

```sql
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
```

The functions exist in production but raise `BLK30` there, and the HTTP endpoints that call them return 404 outside `APP_ENV=test` (§13.7).

### 7.9 Auction state machine table (reference)

The normative transition table is PRD §7.2 (T0a–T9). Mapping to code:

| Transition | Function |
|---|---|
| T0a/T0b | `ensure_public_auction`, `create_sandbox`, `create_test_auction` |
| T1 | `advance_auction_locked` |
| T2 | `place_bid` |
| T3, T4 | `_close_locked` via `advance_auction_locked` |
| T5, T8 | `pay_offer` |
| T6, T7, T9 | `_expire_offer_locked` via `advance_auction_locked` |

---

## 8. Realtime, scheduling and environment SQL

### 8.1 Broadcast trigger (0011_realtime.sql)

```sql
create or replace function bidlock._publish_auction()
returns trigger
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_bid     jsonb;
  v_leader  jsonb;
  v_payload jsonb;
begin
  if (select s.realtime_mode from bidlock.settings s) <> 'broadcast' then
    return null;
  end if;

  if new.last_bid_id is not null and new.last_bid_id is distinct from old.last_bid_id then
    select jsonb_build_object('id', b.id, 'bid_no', b.bid_no, 'bidder_id', b.bidder_id,
                              'display_name', d.display_name, 'is_bot', d.is_bot, 'amount', b.amount,
                              'placed_at', b.placed_at, 'extended', b.ends_at_after > b.ends_at_before)
      into v_bid
      from bidlock.bids b join bidlock.bidders d on d.id = b.bidder_id
     where b.id = new.last_bid_id;
  end if;

  select jsonb_build_object('id', d.id, 'display_name', d.display_name, 'is_bot', d.is_bot)
    into v_leader from bidlock.bidders d where d.id = new.leader_bidder_id;

  v_payload := jsonb_build_object(
    'v', 1, 'auction_id', new.id, 'version', new.version,
    'status', new.status, 'payment_state', new.payment_state,
    'current_price', new.current_price, 'leader', v_leader, 'bid_count', new.bid_count,
    'ends_at', new.ends_at, 'extension_count', new.extension_count,
    'bid', v_bid, 'sent_at', bidlock.bidlock_now());

  -- Inner block: only this part runs in a subtransaction (the EXCEPTION clause of a block starts
  -- the subtransaction when the block is entered, so the outer function body must not have one).
  begin
    -- Supabase: realtime.send(payload jsonb, event text, topic text, private boolean). Verify per A-01.
    -- private = false targets public channels (D-19); the A-01 fallback switches this to true.
    perform realtime.send(v_payload, 'auction_changed', 'auction:' || new.id::text, false);
  exception when others then
    -- Never fail a bid because Realtime is unavailable; clients reconcile by polling.
    raise warning 'bidlock realtime publish failed: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

create trigger auctions_publish
  after update on bidlock.auctions
  for each row
  when (old.version is distinct from new.version)
  execute function bidlock._publish_auction();

revoke execute on all functions in schema bidlock from public;
```

- PL/pgSQL resolves `realtime.send` only when executed, so the migration applies on plain Postgres where the `realtime` schema does not exist; `realtime_mode = 'none'` there means the call is never reached.
- `realtime.send` writes into `realtime.messages` inside the bid transaction; the message is delivered only if the transaction commits.
- The inner `exception` block costs one subtransaction per auction update in production only. With `realtime_mode = 'none'` the function returns before entering the inner block, so local, CI and load runs pay nothing.
- A trigger function never needs `EXECUTE` for the caller; the trigger fires with the function owner's rights (`SECURITY DEFINER`, owner `postgres`). Whether `postgres` may execute `realtime.send` on Supabase is part of A-01.
- One message per version change (D-19). Offer details are not in the payload: when `status` or `payment_state` changes the client refetches state.
- Uncertain at writing (verify at build time, A-01): whether database-originated broadcasts with `private = false` reach public channels on the free plan and whether the project's Realtime setting "allow public access" (or its current name) must be on. Fallback chain, each step recorded in PRD §14 if taken: (1) public channel as written; (2) private channel: call `realtime.send(…, true)`, add the policy below, and subscribe with `config: { private: true }` after `supabase.realtime.setAuth()` (anon/publishable key); (3) Postgres Changes (§8.2); (4) polling at 2 s.

```sql
-- Fallback (2) only, in a new migration applied to Supabase (realtime.messages does not exist locally;
-- guard with "if to_regclass('realtime.messages') is not null" inside a DO block).
create policy bidlock_auction_broadcast_read on realtime.messages
  for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() like 'auction:%');
```

### 8.2 Fallback: Postgres Changes

If A-01 fails (no `realtime.send`, or Broadcast from the database is unavailable on the free plan), implement the fallback and record it in PRD §14:

1. Set `realtime_mode = 'none'` (trigger becomes a no-op).
2. Create a public projection table `bidlock_public.auction_ticks (auction_id uuid primary key, version bigint, updated_at timestamptz)` in a new schema, updated by an `after update` trigger on `bidlock.auctions`.
3. `alter publication supabase_realtime add table bidlock_public.auction_ticks;` `grant usage on schema bidlock_public to anon;` `grant select on bidlock_public.auction_ticks to anon;` enable RLS with a `for select to anon using (true)` policy. The projection trigger function lives in schema `bidlock` (`security definer`, owner `postgres`) and upserts `(auction_id, version, updated_at)`. Do not add `bidlock_public` to the API's exposed schemas (Postgres Changes does not need PostgREST).
4. `SupabaseBroadcastFeed` subscribes with `.on('postgres_changes', { event: 'UPDATE', schema: 'bidlock_public', table: 'auction_ticks', filter: 'auction_id=eq.<id>' }, …)` and treats each change as a version hint: if `version > local`, fetch `/state` (and `/bids?after=`).
5. If that also fails, set `NEXT_PUBLIC_FEED=polling` and `NEXT_PUBLIC_POLL_INTERVAL_MS=2000`.

### 8.3 pg_cron (db/env/supabase-cron.sql, production only)

```sql
-- pg_cron must be enabled in the Supabase dashboard first (Database -> Extensions -> pg_cron).
-- cron.schedule(job_name, schedule, command) replaces an existing job with the same name (A-03).
-- Run as postgres in database postgres; jobs then run as postgres there. pg_cron never runs two
-- instances of one job concurrently (a late run is queued), so tick() batches do not overlap.
select cron.schedule('bidlock-tick',          '* * * * *',   $$select bidlock.tick()$$);
select cron.schedule('bidlock-rate-gc',       '*/10 * * * *', $$delete from bidlock.rate_counters where window_start < now() - interval '2 hours'$$);
select cron.schedule('bidlock-cleanup',       '10 0 * * *',  $$select bidlock.cleanup_expired()$$);
select cron.schedule('bidlock-cron-log-gc',   '20 0 * * *',  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$);
```

Times are UTC. Verify with `select jobname, schedule, active from cron.job order by jobname;` and after two minutes `select jobname, status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`.

### 8.4 Environment SQL files

`db/env/test.sql` (local dev database `bidlock`, test database `bidlock_test`, CI):

```sql
update bidlock.settings set env = 'test', realtime_mode = 'none', bidding_paused = false, test_clock_offset_ms = 0;
alter role bidlock_app login password 'bidlock_app';
create extension if not exists pgtap;            -- line removed by apply-env --no-pgtap (§6.1); keep it on its own line
-- e2e runs many sandboxes, guests and bids from one IP ("local" with TRUST_PROXY=none), in parallel
-- workers; per-bidder and per-bot limits stay at production values so E2E-08 and the bots see them:
update bidlock.rate_limits set max_hits = 10000
 where name in ('sandbox_ip_3600s', 'bidder_create_ip_3600s', 'bid_ip_60s');
```

pgTAP tests that check the default limits reset them inside their own transaction (`update … ; … rollback`).

`db/env/load.sql`:

```sql
update bidlock.settings set env = 'test', realtime_mode = 'none', bidding_paused = false, test_clock_offset_ms = 0;
alter role bidlock_app login password 'bidlock_app';
-- All k6 VUs share one IP. Per-bidder limits stay at production values.
update bidlock.rate_limits set max_hits = 1000000 where name in ('bid_ip_60s', 'bidder_create_ip_3600s');
```

`db/env/supabase.sql`:

```sql
update bidlock.settings set env = 'prod', realtime_mode = 'broadcast', test_clock_offset_ms = 0;
alter role bidlock_app login password :'app_password';
-- Supabase-specific hardening: schema bidlock is not in the API's exposed schemas; make sure:
revoke all on schema bidlock from anon, authenticated, service_role;
revoke all on all functions in schema bidlock from anon, authenticated, service_role;
revoke all on all tables in schema bidlock from anon, authenticated, service_role;
```

`db/env/supabase.sql` and `supabase-cron.sql` must be re-applied after any migration that adds functions or tables (the release procedure §18.5 runs `pnpm db:env supabase` after `pnpm db:migrate`; both are idempotent).

---

## 9. Invariants: enforcement and tests

| ID | Enforced by | Tested by |
|---|---|---|
| INV-01 one leader | `place_bid` sets leader under the lock; `price_leader_count` CHECK | DB-04, INT-01, LOAD-01 (`invariants.sql`) |
| INV-02 price = max bid | single writer under lock; `increasing` CHECK on bids | DB-04, INT-01, LOAD-01 |
| INV-03 consecutive bid_no, increments | `bid_no = bid_count + 1` under lock; `bid_no_unique`; `meets_minimum` CHECK | DB-03, DB-04, INT-01, LOAD-01 |
| INV-04 no consecutive same bidder | `ALREADY_LEADING` rule | DB-04, INT-01, LOAD-01 |
| INV-05 placed before close | clock read after lock; `before_close` CHECK | DB-04, DB-06, LOAD-01 |
| INV-06 no bid after close | lazy close in `place_bid`; `closed_at = ends_at` | DB-07, INT-02, LOAD-01 |
| INV-07 idempotency | `idempotency_unique`; `bids.request_id` unique; lookup after lock | DB-05, INT-01, INT-02, LOAD-01 |
| INV-08 extension cap | `extension_cap` CHECK; extension rows PK (auction, n) | DB-06, LOAD-01 |
| INV-09 one open public | `auctions_one_open_public` unique partial index; `ensure_public_auction` | DB-10 |
| INV-10 offers | `offers_one_open_idx`, `offers_one_paid_idx`, `offer_rank_unique` | DB-08, LOAD-01 |
| INV-11 runner-up | `_expire_offer_locked` query | DB-08 |
| INV-12 bid_count | single writer | INT-01, LOAD-01 |
| INV-13 status pair | `status_payment_pair` CHECK | DB-02, DB-08 |

---

## 10. API

### 10.1 Common rules

All route handlers use the wrapper `route()` in `src/server/http.ts`:

```ts
type Auth = "none" | "optional-session" | "session" | "session-or-bot";
interface RouteOptions<P, Q, B> {
  name: string;                     // log field "route", e.g. "bids.create"
  auth: Auth;
  mutating: boolean;                // true => Origin check + DEMO_MODE readonly gate
  testOnly?: true;                  // only /api/test/* (§10.13): assertTestEnv runs as step 1b; no Origin check
  params?: z.ZodType<P>;
  query?: z.ZodType<Q>;
  body?: z.ZodType<B>;
}
export function route<P, Q, B>(opts: RouteOptions<P, Q, B>,
  handler: (ctx: Ctx<P, Q, B>) => Promise<Response>): (req: Request, routeCtx: { params: Promise<unknown> }) => Promise<Response>;
```

Processing order (first failure wins):

1. Request id: reuse `x-request-id` if it is a UUID, else `crypto.randomUUID()`. Set on the response.
1b. `testOnly`: `assertTestEnv(req)`; when it returns a response (wrong env or secret), return exactly what the catch-all `src/app/api/[...path]/route.ts` returns for that method, before any other gate, so a test route is indistinguishable from an unknown route in every `DEMO_MODE`. Both use one helper, `notFoundResponse(requestId)` in `src/server/http.ts` (404, `NOT_FOUND` envelope, the standard API headers); the catch-all calls it directly without `route()`, so unknown routes answer 404 in every `DEMO_MODE`.
2. `DEMO_MODE=off` → 503 `DEMO_OFF` (all routes except `/api/health`).
3. `mutating && DEMO_MODE=readonly` → 503 `DEMO_READONLY`.
4. `mutating` and not `testOnly`: `Origin` header must be present and in `APP_ORIGIN` list → else 403 `FORBIDDEN_ORIGIN`. `Content-Type` must be `application/json` for requests with a body → else 415 `VALIDATION`.
5. Parse params, query, body with Zod (`.strict()` objects). Body max 4 KB (check `content-length` and the read length) → 413 `VALIDATION`. Failure → 400 `VALIDATION` with `details` = Zod issue paths and messages.
6. Auth: `session` requires a valid `bl_sid` whose bidder exists → else 401 `NO_SESSION`. `session-or-bot`: if `Authorization: Bot <token>` is present, verify it (§13.2) → 401 `BOT_TOKEN_INVALID` on failure; else as `session`. `optional-session` attaches the bidder id when valid.
7. Handler.
8. Errors: `AppError(code)` → envelope; anything else → 500 `INTERNAL` (logged with stack, message to client is generic).
9. Log one JSON line (§14).

Response headers on every API response: `content-type: application/json; charset=utf-8`, `cache-control: no-store` (except where stated), `x-request-id`, `x-content-type-options: nosniff` (API routes are outside the `proxy.ts` matcher, §13.4). Every route file exports `export const runtime = "nodejs";` and its handlers (`GET`, `POST`, `PATCH`, `DELETE`) as `route(…)` results; Next 15+/16 passes `params` as a Promise, which `route()` awaits before Zod parsing. `route()` reads cookies from `req.headers.get("cookie")` and writes them with `Set-Cookie` on the returned `Response`; route code does not use `next/headers` (`cookies()`, `headers()`), so handlers can be called directly from integration tests with a plain `Request` (T-22) and behave the same under `next start`.

Error envelope (Zod `ErrorBody`):

```ts
export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,                               // z.enum([...all codes in §10.12])
    message: z.string(),                           // developer-facing English; UI uses its own copy
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  request_id: z.uuid(),
});
```

Common Zod pieces (`src/domain/schemas.ts`):

```ts
export const Id = z.uuid();
export const Cents = z.number().int().min(1).max(100_000_000);
export const Iso = z.iso.datetime({ offset: true });
export const Status = z.enum(["scheduled", "live", "closed", "settled", "unsold"]);
export const PaymentState = z.enum(["awaiting_payment", "offered_to_runner_up", "paid", "expired"]).nullable();
export const IdParams = z.object({ id: Id }).strict();
```

Timestamps are serialized by Postgres `to_jsonb` as ISO 8601 with offset (e.g. `2026-10-20T12:00:00.123456+00:00`); `Iso` accepts them. Microseconds are preserved in JSON and parsed to milliseconds on the client.

### 10.2 GET /api/me

Auth: none (creates). Response 200 `Me`:

```ts
export const Me = z.object({
  id: Id,
  display_name: z.string().min(2).max(24),
  payment_strikes: z.number().int().min(0),
  active_sandbox: z.object({ sandbox_id: Id, auction_id: Id, expires_at: Iso, status: Status, ends_at: Iso }).nullable(),
  open_offers: z.array(z.object({ auction_id: Id, lot_no: z.number().int(), title: z.string(), rank: z.union([z.literal(1), z.literal(2)]), amount: Cents, deadline: Iso })),
  server_now: Iso,
});
```

Behaviour: valid cookie and `get_me` non-null → return it. Otherwise call `create_bidder(ip_hash)`: on `RATE_LIMITED` → 429 with `Retry-After`; on success set cookie (§13.1) and return `get_me` of the new bidder. Response status is 200 in both cases.

Client rule (decision D-38): `useMe` performs `GET /api/me` once per page load as a single-flight promise shared by every component, and every mutating client call awaits it first. This prevents parallel first requests from creating several bidders (each would set a different cookie). Read endpoints may run in parallel with it because they use `optional-session` and never create bidders.

### 10.3 PATCH /api/me

Auth: session. Mutating. Body `z.object({ display_name: z.string() }).strict()`. The server normalizes and validates with `src/domain/names.ts` (§13.9): failure → 422 `NAME_INVALID` with `details.reason` ∈ `length | characters | profanity | bot_suffix`. Success → 200 `Me`.

### 10.4 GET /api/auctions/:id/state

Auth: optional-session. Response 200 `AuctionState`, or 304 when `If-None-Match` matches. 404 `NOT_FOUND` when `auction_state` returns null.

```ts
const PublicBidder = z.object({ id: Id, display_name: z.string(), is_bot: z.boolean() });
export const AuctionState = z.object({
  id: Id, lot_no: z.number().int().positive(), kind: z.enum(["public", "sandbox", "test"]),
  title: z.string(), status: Status, payment_state: PaymentState,
  starting_price: Cents, current_price: Cents.nullable(),
  min_next_bid: Cents, max_bid: Cents, increment: Cents,
  bid_count: z.number().int().min(0), leader: PublicBidder.nullable(),
  starts_at: Iso, ends_at: Iso, original_ends_at: Iso, closed_at: Iso.nullable(), settled_at: Iso.nullable(),
  snipe_window_s: z.number().int(), extend_by_s: z.number().int(),
  max_extensions: z.number().int(), extension_count: z.number().int(),
  last_extension: z.object({ n: z.number().int(), bid_id: Id, old_ends_at: Iso, new_ends_at: Iso, at: Iso }).nullable(),
  offer: z.object({ rank: z.union([z.literal(1), z.literal(2)]), bidder_id: Id, display_name: z.string(), is_bot: z.boolean(),
                    amount: Cents, status: z.enum(["open", "paid"]), opened_at: Iso, deadline: Iso }).nullable(),
  expired_offers: z.array(z.object({ rank: z.union([z.literal(1), z.literal(2)]), bidder_id: Id })),
  sandbox: z.object({ id: Id, owner_id: Id, expires_at: Iso }).nullable(),
  next_public_auction_id: Id.nullable(),
  version: z.number().int().positive(),
  server_now: Iso,
});
```

`ETag: W/"<version>.<next_public_auction_id first 8 chars or 0>"`. The 304 path still runs `auction_state` (lazy transitions must happen); it only saves the body. `cache-control: no-store`.

### 10.5 GET /api/auctions/:id/bids

Auth: optional-session. Query:

```ts
export const BidsQuery = z.object({
  cursor: z.coerce.number().int().min(1).optional(),   // bids with bid_no < cursor, newest first
  after: z.coerce.number().int().min(0).optional(),    // bids with bid_no > after, oldest first
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict().refine((q) => !(q.cursor !== undefined && q.after !== undefined), { message: "cursor and after are exclusive" });
```

Response 200:

```ts
export const BidItem = z.object({ id: Id, bid_no: z.number().int().positive(), bidder_id: Id, display_name: z.string(),
  is_bot: z.boolean(), amount: Cents, placed_at: Iso, extended: z.boolean() });
export const BidsPage = z.object({ bids: z.array(BidItem), next_cursor: z.number().int().positive().nullable() });
```

### 10.6 POST /api/auctions/:id/bids

Auth: session-or-bot. Mutating. Body:

```ts
export const PlaceBidBody = z.object({ amount: Cents, idempotency_key: z.uuid() }).strict();
```

Steps: `retry = check_bid_rate(bidder, ip_hash)`; `retry > 0` → 429 `RATE_LIMITED`, header `Retry-After: ceil(retry/1000)`, `details.retry_after_ms`. Else `place_bid(...)` and map (§10.12).

Success: 201 (first time) or 200 (replay, header `Idempotent-Replayed: true`):

```ts
export const BidAccepted = z.object({
  bid: z.object({ id: Id, bid_no: z.number().int().positive(), amount: Cents, placed_at: Iso }),
  auction: z.object({ id: Id, status: Status, current_price: Cents, leader_bidder_id: Id, min_next_bid: Cents, max_bid: Cents,
                      ends_at: Iso, extended: z.boolean(), extension_count: z.number().int(), version: z.number().int() }),
  replayed: z.boolean(),
  server_now: Iso,
});
```

Rule rejections return the error envelope with `details`:

```ts
export const BidRejectionDetails = z.object({
  min_next_bid: Cents.nullable(), max_bid: Cents.nullable(), current_price: Cents.nullable(),
  leader_bidder_id: Id.nullable(), status: Status.nullable(), ends_at: Iso.nullable(),
  version: z.number().int().nullable(), replayed: z.boolean(), server_now: Iso,
});
```

A replayed rejection returns the same code and status as the original, with `details.replayed = true`.

### 10.7 POST /api/auctions/:id/pay

Auth: session-or-bot. Mutating. Body `z.object({}).strict()` (empty JSON object). Calls `pay_offer`. Success 200:

```ts
export const PayAccepted = z.object({ auction_id: Id, status: z.literal("settled"), payment_state: z.literal("paid"),
  offer_rank: z.union([z.literal(1), z.literal(2)]), amount: Cents, replayed: z.boolean(), version: z.number().int(), server_now: Iso });
```

### 10.8 POST /api/sandboxes

Auth: session. Mutating. Body `{}`. Calls `create_sandbox(bidder, ip_hash, seed)` where `seed = APP_ENV === "test" ? BOT_SEED_OVERRIDE ?? null : null`. Success 201:

```ts
export const SandboxCreated = z.object({ sandbox_id: Id, auction_id: Id, expires_at: Iso, bot_seed: z.number().int() });
```

`SANDBOX_EXISTS` → 409 with `details: SandboxCreated` (the client navigates to the existing auction).

### 10.9 POST /api/bot-tokens

Auth: session. Mutating. Body `z.object({ sandbox_id: Id }).strict()`. Calls `sandbox_bots(bidder, sandbox_id)`; null → 404. Success 200:

```ts
export const BotTokens = z.object({
  auction_id: Id, bot_seed: z.number().int(), expires_at: Iso,
  bots: z.array(z.object({ id: Id, persona: z.enum(["cautious", "steady", "sniper"]), display_name: z.string(), token: z.string() })).length(3),
});
```

Each token expires at `min(now + 15 min, sandbox.expires_at)`.

### 10.10 GET /api/auctions

Auth: optional-session. Calls `list_auctions(viewer)`. Response 200 `z.object({ public: AuctionState, sandbox: AuctionState.nullable() })`.

### 10.11 GET /api/health

Auth: none. Not gated by `DEMO_MODE`. Query `db` optional (`"1"`). Always runs `select bidlock.bidlock_now() as now` (1 s statement timeout via `sql\`set local statement_timeout = 1000\`` inside `sql.begin`). Response 200 `{ status: "ok", db: "ok", demo_mode, version, server_now }`; DB failure → 503 `{ status: "degraded", db: "error", demo_mode, version, server_now: <app clock> }`. `cache-control: no-store`.

### 10.12 Error codes and mapping

| Code | HTTP | Source | Stored for replay | UI copy (PRD §9) |
|---|---|---|---|---|
| `VALIDATION` | 400 (413 body too large, 415 wrong content type) | Zod, or `place_bid` amount range | no | field errors |
| `NO_SESSION` | 401 | missing/invalid cookie on a session route | no | client calls `GET /api/me` then retries once |
| `BOT_TOKEN_INVALID` | 401 | bad signature, expired, scope or owner mismatch | no | "Couldn't start the bots…" |
| `FORBIDDEN_ORIGIN` | 403 | Origin check | no | generic error |
| `NOT_FOUND` | 404 | null read result, `NOT_FOUND` from functions, unknown test route | no | "Auction not found." |
| `AUCTION_NOT_LIVE` | 409 | `place_bid` | yes | "Bidding opens in {m:ss}." |
| `AUCTION_CLOSED` | 409 | `place_bid` | yes | "This auction has closed." |
| `ALREADY_LEADING` | 409 | `place_bid` | yes | "You're already the highest bidder." |
| `BID_TOO_LOW` | 409 | `place_bid` | yes | "Someone bid first. The minimum is now {min}." |
| `BID_TOO_HIGH` | 422 | `place_bid` | yes | "That's more than 100 steps…" |
| `IDEMPOTENCY_MISMATCH` | 422 | `place_bid` | no | "Something went wrong with that bid…" |
| `NAME_INVALID` | 422 | names.ts | no | dialog errors |
| `NOT_PAYABLE` | 409 | `pay_offer` | n/a | "There is nothing for you to pay on this lot." |
| `OFFER_EXPIRED` | 409 | `pay_offer` | n/a | "Your payment window has closed." |
| `SANDBOX_EXISTS` | 409 | `create_sandbox` | n/a | navigates to existing sandbox |
| `SANDBOX_CAPACITY` | 503 | `create_sandbox` | n/a | "All 50 sandboxes are in use…" |
| `RATE_LIMITED` | 429 + `Retry-After` | `check_bid_rate`, `create_sandbox`, `create_bidder` | no | "Slow down…" / sandbox copy |
| `BIDDING_PAUSED` | 503 | `settings.bidding_paused` | no | "Bidding is paused right now." |
| `DEMO_READONLY` | 503 | `DEMO_MODE=readonly` | no | read-only banner |
| `DEMO_OFF` | 503 | `DEMO_MODE=off` | no | offline page |
| `INTERNAL` | 500 | unexpected exception, SQLSTATE `BLK*` | no | "Couldn't reach the server…" |

DB function → HTTP mapping lives in one table in `src/domain/errors.ts` (`ERROR_STATUS: Record<ErrorCode, number>`), unit-tested by UT-09. SQLSTATE `BLK01` (time override in prod), `BLK03`, `BLK10`, `BLK20`, `BLK30` are programming errors: log at `error` with the SQLSTATE and return 500 `INTERNAL`.

### 10.13 Test-only endpoints

Available only when `APP_ENV=test` and header `x-test-secret` equals `TEST_API_SECRET` (constant-time compare). Otherwise the handler returns exactly the response of an unknown route (404 `NOT_FOUND` envelope, §10.1 step 1b). They are mutating routes (`testOnly: true`) but skip the Origin check (called from Playwright `request` and k6). Request bodies are Zod `.strict()` objects with the ranges below; omitted fields use the `create_test_auction` defaults; `snipe_window_s` 0–300, `extend_by_s` 1–600 and ≥ `snipe_window_s`, `max_extensions` 0–100 (the table CHECKs).

| Route | Body | Effect | Response |
|---|---|---|---|
| `POST /api/test/clock` | `{ offset_ms: z.number().int().min(-86_400_000).max(86_400_000) }` | `set_test_clock(offset_ms)` | `{ server_now }` |
| `DELETE /api/test/clock` | none | `set_test_clock(0)` | `{ server_now }` |
| `POST /api/test/auctions` | `{ duration_s?: 5–3600, starting_price?: Cents, snipe_window_s?, extend_by_s?, max_extensions?, payment_window_s?: 10–3600, starts_in_s?: 0–3600, title?: string(3–80) }` | `create_test_auction(...)` | 201 `{ auction_id }` |

---

## 11. Client

### 11.1 Rendering model

- Pages are React Server Components that render the shell and pass initial data: `/a/[id]` calls `auction_state` and `list_bids` server-side (with the viewer from the cookie, if any) and passes them to the client component `AuctionRoom`, so the first paint has real data. Pages use `export const dynamic = "force-dynamic"` (nonce CSP requires dynamic rendering).
- `/how-it-works` reads `bench/results/latest.json` with a static `import` (bundled at build time) and stats through a cached server function (`unstable_cache` or the Next 16 `"use cache"` directive with `cacheLife({ revalidate: 60 })`, whichever the installed major supports).
- Client islands: `NameChip`, `NameDialog`, `ThemeToggle`, `PublicRoomCard`, `SandboxCard`, `OfferNotices`, `AuctionRoom`, `BotRunner`. `BenchmarkTable` and `StatsStrip` are server components.

### 11.2 Design tokens

Defined in `src/app/globals.css` (Tailwind 4 `@theme` maps them to utilities). Values copied from firatkil.com.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#f6f6f3` | `#111111` | page background |
| `--surface` | `#ffffff` | `#181817` | cards |
| `--ink` | `#121212` | `#efeee9` | primary text |
| `--ink-2` | `#4a4a47` | `#b4b3ad` | secondary text |
| `--ink-3` | `#6b6b66` | `#93928c` | muted text (≥ 4.5:1 on ground; verify) |
| `--rule` | `#e4e3de` | `#2a2a28` | borders |
| `--rule-strong` | `#cfcdc6` | `#3a3a37` | input borders |
| `--accent` | `#2443d0` | `#8ea2ff` | links, primary buttons, focus ring, "you" state |
| `--accent-tint` | `color-mix(in oklab, var(--accent) 10%, transparent)` | same formula | new-row highlight |
| `--ok` | `#1f7a4d` | `#5cc28f` | paid |
| `--warn` | `#b5481d` | `#f08a5d` | < 60 s countdown, outbid |

Typography: `--font-sans` Schibsted Grotesk (400, 500, 700), `--font-mono` JetBrains Mono (400, 500) via `next/font/google` with `subsets: ["latin", "latin-ext"]` and `display: "swap"`. Sizes: body 16/24, small 14/20, price 40/44 mono tabular (`font-variant-numeric: tabular-nums`), H1 32/38 (mobile 26/32). Radius 4 px (buttons, inputs) and 6 px (cards). Spacing scale Tailwind default. Primary button: accent background, white text (dark mode: `#111111` text on `#8ea2ff`). No gradients, no shadows; cards use 1 px `--rule` border.

Theme: an inline script (with the CSP nonce) in `<head>` reads `localStorage.bl_theme` and sets `data-theme` on `<html>` before paint; CSS uses `:root[data-theme=dark]` and `@media (prefers-color-scheme: dark) { :root:not([data-theme=light]) { … } }`.

Motion: price change flash (background `--accent-tint` → transparent, 600 ms), extension banner slide-in (translateY 8 px → 0, 200 ms), countdown has no animation. All wrapped in `@media (prefers-reduced-motion: no-preference)`.

### 11.3 AuctionFeed interface

```ts
// src/client/feed/AuctionFeed.ts
import type { AuctionState, BidItem } from "@/domain/schemas";

export type FeedStatus = "connecting" | "live" | "reconnecting";

export type FeedEvent =
  | { kind: "snapshot"; state: AuctionState; receivedAt: number; rttMs: number | null }   // from GET /state
  | { kind: "change"; change: AuctionChange }                                              // from Broadcast
  | { kind: "bids"; bids: BidItem[] };                                                     // from GET /bids?after=

export interface AuctionChange {                 // Broadcast payload v1 (§8.1), parsed with Zod
  auction_id: string; version: number; status: AuctionState["status"]; payment_state: AuctionState["payment_state"];
  current_price: number | null; leader: AuctionState["leader"]; bid_count: number; ends_at: string;
  extension_count: number; bid: BidItem | null; sent_at: string;
}

export interface FeedHandlers {
  onEvent(event: FeedEvent): void;
  onStatus(status: FeedStatus): void;
}

export interface AuctionFeed {
  /** Starts delivering events for one auction. Returns an unsubscribe function. */
  subscribe(auctionId: string, handlers: FeedHandlers): () => void;
  /** Ask for an authoritative snapshot now (after gaps, reconnects, visibility changes). */
  refresh(): void;
}
```

`createFeed(auctionId)` returns `SupabaseBroadcastFeed` when `NEXT_PUBLIC_FEED=broadcast` and the Supabase env vars are set, else `PollingFeed(NEXT_PUBLIC_POLL_INTERVAL_MS)`. Both share `fetchSnapshot()` and `fetchBidsAfter()` from `src/client/api.ts`.

Lobby (decision D-30): `PublicRoomCard` and the active-sandbox `SandboxCard` each subscribe to their auction with `createFeed(id)` (snapshots only; they ignore `bids` events). When the held public state becomes `settled`/`unsold` or carries a `next_public_auction_id`, the lobby refetches `GET /api/auctions` and resubscribes to the new public id. The lobby's "Error" state uses the same 3 s retry as the room's load error.

### 11.4 PollingFeed

- Every `intervalMs` (1000 local/CI, 2000 production fallback): `GET /api/auctions/:id/state` with `If-None-Match: <last ETag>`. Measure `t0`/`t1` around the fetch for clock sync.
- 200 → emit `snapshot`; if `state.bid_count > lastKnownBidNo` → `GET /bids?after=<lastKnownBidNo>&limit=50` → emit `bids` (repeat while 50 were returned).
- 304 → nothing.
- Network error or 5xx twice in a row → `onStatus("reconnecting")`, back off to `min(intervalMs × 2^n, 10 s)`; first success → `onStatus("live")`.
- `document.visibilityState === "hidden"` → stop the timer; on `visible` → immediate fetch then resume.
- Stops polling 10 s after a terminal state (`settled` or `unsold`) is received, except public lots, which keep polling every 5 s until `next_public_auction_id` is known.

### 11.5 SupabaseBroadcastFeed

```ts
const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const channel = supabase.channel(`auction:${auctionId}`, { config: { broadcast: { self: false }, private: false } });
channel
  .on("broadcast", { event: "auction_changed" }, ({ payload }) => {
    const parsed = AuctionChangeSchema.safeParse(payload);
    if (parsed.success) handlers.onEvent({ kind: "change", change: parsed.data });
    else feed.refresh();                                   // unknown payload version: be safe
  })
  .subscribe((status) => {
    if (status === "SUBSCRIBED") { failures = 0; handlers.onStatus("live"); feed.refresh(); }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { failures++; handlers.onStatus("reconnecting"); }
    if (failures >= 3) switchToPolling(2000);
  });
```

- On `SUBSCRIBED` (initial and every reconnect) it fetches a snapshot, because messages sent while disconnected are not replayed.
- Safety poll: while live, one snapshot every 15 s and on `visibilitychange` to visible.
- If not `SUBSCRIBED` within 10 s of `subscribe`, or not back to `SUBSCRIBED` within 10 s after any `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`, switch to polling at 2000 ms (FR-48). Once switched, the feed stays on polling until the page is reloaded.
- The Supabase client is created lazily in a dynamic `import()` so pages using polling never load `@supabase/supabase-js`.

### 11.6 Clock sync

```ts
// src/domain/clock.ts
export interface ClockSample { offsetMs: number; rttMs: number; at: number }

export class ClockSync {
  private samples: ClockSample[] = [];
  /** t0/t1 are local epoch ms (performance.timeOrigin + performance.now()) before/after the request. */
  addSample(t0: number, t1: number, serverNowIso: string): void {
    const rtt = t1 - t0;
    if (rtt < 0 || rtt > 10_000) return;
    const server = Date.parse(serverNowIso);              // ms precision is enough
    this.samples.push({ offsetMs: server - (t0 + t1) / 2, rttMs: rtt, at: t1 });
    if (this.samples.length > 8) this.samples.shift();
  }
  /** Offset of the lowest-RTT sample among the last 8 (least queueing error). 0 before any sample. */
  offsetMs(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((best, s) => (s.rttMs < best.rttMs ? s : best)).offsetMs;
  }
  serverNow(localNow: number): number { return localNow + this.offsetMs(); }
}

export function remainingMs(endsAtIso: string, serverNow: number): number {
  return Math.max(0, Date.parse(endsAtIso) - serverNow);
}

/** 0:07, 3:12, 1:02:03. Ceil to whole seconds so "0:00" only shows when remaining is 0. */
export function formatCountdown(ms: number): string { /* ceil(ms/1000) → h, m, s */ }
```

- Samples come only from request/response pairs (state, bids POST responses, `/api/me`), never from Broadcast messages (one-way latency unknown).
- Local time uses `performance.timeOrigin + performance.now()` (monotonic) instead of `Date.now()`, so system clock jumps during a session do not distort the countdown.
- The countdown component re-renders every 250 ms via `setInterval`, computing `remainingMs(state.ends_at, clock.serverNow(localNow()))`.
- Error bound: the true offset is within ±RTT/2 of the estimate; with a 100 ms RTT the countdown is within 50 ms.

### 11.7 Reconciler

`src/domain/reconcile.ts` exports a pure reducer:

```ts
export interface RoomState {
  auction: AuctionState | null;
  bids: BidItem[];               // newest first, unique by bid_no, max 100
  lastBidNo: number;             // highest bid_no held
  pendingRefetch: boolean;       // UI effect fetches a snapshot when true
  pendingBidsAfter: number | null;
  lastExtension: { n: number; durationMs: number; at: number } | null;   // drives the banner
}
export function reduce(state: RoomState, event: FeedEvent): RoomState;
```

Rules:

1. `snapshot`: replace `auction` if `state.auction === null || snapshot.version >= state.auction.version` (equal versions refresh offer and `server_now` data). If `snapshot.bid_count > lastBidNo` set `pendingBidsAfter = lastBidNo`. Clear `pendingRefetch`.
2. `change` with `version <= auction.version`: ignore.
3. `change` with `version === auction.version + 1`: merge the change fields into `auction`, increment version. If `change.bid` and `change.bid.bid_no === lastBidNo + 1`: prepend it. If `change.bid` with a larger gap: `pendingBidsAfter = lastBidNo`. If `status` or `payment_state` differs from the held value: `pendingRefetch = true` (offers are not in the payload).
4. `change` with `version > auction.version + 1`: merge the fields (they are the newest) and set `pendingRefetch = true` and `pendingBidsAfter = lastBidNo`.
5. `bids`: insert each bid not already present by `bid_no`; sort newest first; trim to 100; update `lastBidNo`.
6. Extension detection: when `extension_count` increases, set `lastExtension = { n, durationMs: new ends_at − bid.placed_at (or last_extension.at), at: now }`.
7. Derived values (`min_next_bid`, `max_bid`, `increment`) are recomputed with `src/domain/increments.ts` after a `change` and replaced by the server's values at the next snapshot.

The UI layer (`useAuctionRoom`) runs effects for `pendingRefetch` and `pendingBidsAfter` through `feed.refresh()` and `fetchBidsAfter()`, and derives "you" flags by comparing ids with `me.id`.

### 11.8 Bidding client

- Each user action (quick button, custom submit, key press) creates `idempotency_key = crypto.randomUUID()` and stores `{ key, amount, auctionId }` as the pending bid.
- On network failure or 5xx the pending bid stays; "Retry" resends the same key and amount. On any 2xx/4xx response the pending bid is cleared.
- After an accepted bid the client applies `auction` from the response immediately (version check as in §11.7) so the bidder's own UI never waits for the feed.
- On `BID_TOO_LOW` the client updates `min_next_bid` from `details` so the quick buttons show valid amounts.
- Keyboard: a `keydown` listener on `document` handles `1`, `2`, `3` when `event.target` is not an input, textarea, select or contenteditable and no modifier key is pressed and the dialog is closed.
- Custom amount parsing (`parseDollarInput`): accepts `35`, `35.5`, `35.50`, `1,234.50`, optional leading `$`; rejects more than two decimals, negative, exponent notation, empty, non-numeric, and > $1,000,000. Converts with integer math on the string (no `parseFloat`).
- Live announcer (`useLiveAnnouncer`): price region `aria-live="polite"` updates at most every 3000 ms with the newest text "Current price {price}, leader {name}"; outbid/won/offer messages go to a separate `aria-live="assertive"` region once per event id.

---

## 12. Bots

### 12.1 Personas

All money values are multiples of the auction's current increment. `budget` is drawn once per bot from the PRNG as `round_to_increment(starting_price × U(lo, hi))`.

| Parameter | Cautious | Steady | Sniper |
|---|---|---|---|
| Budget multiplier `U(lo, hi)` of starting price | 2.0–3.0 | 3.0–4.5 | 4.0–6.0 |
| First bid allowed after | 5 s from start | 1 s | only in last 15 s (30% chance of one opening bid at 3–8 s) |
| Think interval (normal phase) | 4–6 s | 2–4 s | 1 s checks, never bids |
| Think interval (last 15 s) | 3–5 s | 2–3 s | 2–3 s |
| Chance to bid when allowed (normal / last 15 s) | 50% / 40% | 80% / 90% | 0% / 95% |
| Bid amount | `min_next_bid` | `min_next_bid` (+1 step with 25%) | `min_next_bid` + 0–2 steps |
| Pays when it wins / gets an offer | 100% | 90% | 60% |
| Pay delay | 3–8 s | 3–8 s | 3–8 s |

Global rules applied to every persona in `scheduler.ts`:
- Never bid while the bot is the leader.
- Never bid an amount above `budget`; if `min_next_bid > budget`, the bot drops out (`status: "out", outAt: current_price`) and stops.
- At least 2000 ms between two bids of the same bot (matches server limit `bid_bot_2s`).
- Every wait is clamped to [1000, 6000] ms.
- "Last 15 s" means `remainingMs(ends_at, serverNow) <= 15000`. After an extension the phase is re-evaluated, so bots stay aggressive during soft-close battles.
- On `BID_TOO_LOW` the bot re-evaluates on its next tick (no immediate retry). On `RATE_LIMITED` it waits `retry_after_ms`. On `AUCTION_CLOSED` it stops bidding and switches to the payment phase.
- Payment phase: if `state.offer` is open and `offer.bidder_id === bot.id`, draw "pays" once; if yes, wait the pay delay and call `POST /pay` with its token.

### 12.2 Scheduler (pure, unit-tested)

```ts
// src/client/bots/scheduler.ts
export type BotDecision =
  | { type: "wait"; ms: number }
  | { type: "bid"; amount: number }
  | { type: "pay" }
  | { type: "drop" }
  | { type: "stop" };

export interface BotMemory { id: string; persona: Persona; budget: number; lastBidAt: number | null;
  status: "watching" | "bidding" | "out" | "paused" | "done"; payDecision: boolean | null; openingBidDone: boolean }

export function decide(mem: BotMemory, room: AuctionState, serverNow: number, rng: () => number): BotDecision;
```

`BotRunner.tsx` (client component, rendered only when the viewer owns the sandbox):
1. `POST /api/bot-tokens` once; on failure show the token error copy.
2. Create one `mulberry32(seed + index)` per bot (`index` 0, 1, 2), compute budgets, and start one `setTimeout` loop per bot: call `decide`, execute, schedule the next tick.
3. Bot requests send `Authorization: Bot <token>` plus the owner's cookie (the browser sends it automatically) and their own idempotency key per bid.
4. Pause all loops while the tab is hidden; resume on visible with a fresh snapshot.
5. Stop all loops on unmount, when the token expires, or when the auction is `settled`/`unsold`.

PRNG:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

In `APP_ENV=test` the server returns `bot_seed = BOT_SEED_OVERRIDE` (42), so the sequence of decisions for the same room states is identical between runs (network timing still varies; e2e assertions are written to tolerate it).

---

## 13. Security

### 13.1 Session cookie

- Name `bl_sid`. Value `s1.<bidder_uuid>.<iat>.<sig>` where `iat` is Unix seconds and `sig = base64url(HMAC-SHA256(SESSION_SECRET, "s1.<bidder_uuid>.<iat>"))`.
- Attributes: `HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000` (400 days) and `Secure` when `APP_ENV=production`.
- Verify: split into exactly 4 parts; prefix `s1`; uuid valid; `iat` integer not in the future by more than 300 s and not older than 400 days (the browser's `Max-Age` is not trusted; decision D-35); recompute HMAC with `SESSION_SECRET` (and `SESSION_SECRET_PREVIOUS` if set); compare with `crypto.timingSafeEqual` on equal-length buffers. Any failure = no session.
- Re-issue the cookie (same bidder, new `iat`) when it was verified with the previous secret or when `iat` is older than 30 days (sliding renewal; done in `GET /api/me` only).
- The cookie contains no personal data. Bidder ids are not secret (D-20); the signature is what proves ownership.

### 13.2 Bot tokens

- Format `bt1.<payload>.<sig>`; `payload = base64url(JSON.stringify({ v: 1, sub: botId, aid: auctionId, sid: sandboxId, own: ownerId, iat, exp }))`; `sig = base64url(HMAC-SHA256(BOT_TOKEN_SECRET, "bt1." + payload))`.
- Verification on `POST /bids` and `POST /pay`: signature (timing-safe), `v === 1`, `exp > now`, `aid === :id` path param, and the request's session cookie bidder `=== own`. The bidder used for the call is `sub`.
- A leaked token is useless without the owner's cookie and expires within 15 minutes; it can only bid as that bot in that sandbox (also enforced in SQL by `place_bid`).

### 13.3 CSRF

`SameSite=Lax` prevents the cookie on cross-site POSTs from other origins in modern browsers; the Origin check (FR-85) covers older behaviour and same-site subdomains (other `*.firatkil.com` hosts are same-site, so `SameSite` alone would not stop them). Current browsers send `Origin` on every `fetch` POST/PATCH, including same-origin ones; a missing `Origin` or `Origin: null` is rejected with 403. `APP_ORIGIN` entries are compared as exact strings after URL normalisation (scheme + host + port, no trailing slash). All mutating client calls send `content-type: application/json`, which also forces a CORS preflight for any cross-origin script; no route answers preflights (no CORS headers are ever sent). GET routes are safe to call cross-site: their only side effects are idempotent time-based transitions and guest creation by `GET /api/me` (rate limited).

### 13.4 Headers and CSP

`src/proxy.ts` (matcher: all paths except `/api/*`, `/_next/static`, `/_next/image`, `favicon.ico`; API responses get their headers from `route()`) generates a 16-byte base64 nonce per request and sets the CSP below on both the forwarded request headers (`NextResponse.next({ request: { headers } })` with `content-security-policy` and `x-nonce`) and the response. Next.js reads the nonce from the request's `content-security-policy` header and adds it to its own framework and hydration scripts; `x-nonce` is what `layout.tsx` reads for the theme script. Without the request header the framework scripts are blocked by `'strict-dynamic'`. Headers:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' https://{SUPABASE_HOST} wss://{SUPABASE_HOST};
  frame-ancestors 'none';
  base-uri 'none';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Strict-Transport-Security: max-age=63072000; includeSubDomains   (production only)
Cross-Origin-Opener-Policy: same-origin
```

In development add `'unsafe-eval'` to `script-src` (React dev tooling). `{SUPABASE_HOST}` is omitted when `NEXT_PUBLIC_SUPABASE_URL` is empty. `style-src 'unsafe-inline'` is needed for Next's injected style tags and is acceptable (no user HTML is rendered). `layout.tsx` reads the nonce from `headers()` for the theme script.

### 13.5 Input and output

- Every input parsed by Zod `.strict()` schemas; unknown keys are rejected.
- React escapes all text. `dangerouslySetInnerHTML` is allowed only in `StateMachine.tsx` for the committed SVG imported as a string at build time; ESLint rule `react/no-danger` is on with a single disable comment there.
- SQL only through postgres.js tagged templates (parameterised). `sql.unsafe` is allowed only in `scripts/db/*.ts` and `scripts/bench/verify.ts` (committed SQL files, parameters passed separately).

### 13.6 IP handling

`getClientIp(req)`: if `TRUST_PROXY=vercel`, take the first comma-separated value of `x-forwarded-for` (Vercel overwrites this header with the real client IP), trimmed; else `"local"`. IPv6 addresses are reduced to their /64 prefix; IPv4 kept whole. `ipHash = HMAC-SHA256(IP_HASH_SALT, ip).hex.slice(0, 32)`. Raw IPs are never logged or stored.

### 13.7 Test-only surface

- `/api/test/*` handlers are declared with `route({ …, testOnly: true }, handler)`; `route()` then calls `assertTestEnv(req)` (`src/server/testGuard.ts`) as step 1b, which returns the unknown-route 404 envelope unless `env().APP_ENV === "test"` and `x-test-secret` matches `TEST_API_SECRET` (constant-time compare). `check:guards` rule 1 checks that every exported handler in `src/app/api/test/**` passes `testOnly: true`.
- `create_test_auction` and `set_test_clock` raise in a non-test database.
- `BOT_SEED_OVERRIDE` is ignored unless `APP_ENV=test`.
- Env validation refuses to start in production with test variables set.

### 13.8 Static guard script (`pnpm check:guards`, run in CI static job)

Fails when:
1. Any exported handler in a file under `src/app/api/test/` is not a `route({ … testOnly: true … }, …)` call.
2. Any file under `src/client/` or `src/components/` imports `postgres`, `server-only` modules, or `@/server/*`.
3. Any `.ts/.tsx` file in `src/` contains the strings `parseFloat(` or `toFixed(` inside a function whose name contains `price`, `amount` or `cents` (money must stay integer).
4. Any SQL migration contains `set bidlock.now_override` or `test_clock_offset_ms =` outside `0012_test_support.sql`.
5. `.github/workflows/load.yml` or `load/bid-storm.js` contains `firatkil.com`.

### 13.9 Display names

`normalizeName(input)`: NFC normalize, trim, collapse whitespace runs to one space. `validateName(name)` returns the first failing reason: `length` (2–24 code points), `characters` (regex `^[\p{L}\p{N} ._-]+$`u), `bot_suffix` (`/bot$/i` after trimming), `profanity` (lowercase, apply the de-leet map `0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`, remove spaces, dots, dashes and underscores, then check whether any word from `src/domain/profanity.ts` (a list of about 60 common English profanities and slurs, lowercase, committed in the repo) is a substring).

## 14. Observability

- Logger `src/server/log.ts`: `log.info(msg, fields)`, `log.warn`, `log.error`; writes `JSON.stringify({ ts, level, msg, ...fields })` to stdout (Vercel captures it). Level filter from `LOG_LEVEL`.
- Request log line (one per API request, written by `route()`): `{ ts, level, msg: "request", request_id, route, method, status, duration_ms, auction_id?, bidder_id?, is_bot?, error_code?, replayed?, db_ms? }`. `db_ms` is the time spent in the business SQL call.
- Error log adds `err_name`, `err_message`, `stack` (server only), `sqlstate`.
- Redaction: the logger drops keys named `cookie`, `authorization`, `token`, `secret`, `password`, `ip` at any depth.
- Audit: `auction_events` (FR-16). The README shows `select type, count(*) from bidlock.auction_events group by 1;` as an example.
- Health: `/api/health` (§10.11), used by keepalive and the compose healthcheck.
- Stats: `stats()` behind a 60 s cache; displayed on `/how-it-works` (FR-70).

## 15. Testing

### 15.1 Strategy

| Layer | Tool | Runs where | What it proves |
|---|---|---|---|
| Rules | pgTAP (`db/tests`) | local container, CI `db` job | every SQL rule and transition, with time control |
| Concurrency | Vitest + postgres.js (`tests/integration`) | local, CI `integration` job | invariants under real parallel transactions |
| Pure logic | Vitest (`tests/unit`) | local, CI `static` job | formatting, ladder, clock, reconciler, tokens, bots |
| End to end | Playwright (`tests/e2e`) | local, CI `e2e` job (polling feed, production build) | UI states, copy, two-user flows, a11y |
| Load | k6 + `invariants.sql` | CI `load` workflow, `pnpm load:local` | headline claim at 500 VUs |

Fixtures: `tests/fixtures/db.ts` exports `adminSql()` (postgres.js with `DATABASE_URL_ADMIN`), `appSql()` (runtime role), both built with the same options as `src/server/db.ts` (`prepare: false`, the `bigint` → safe `number` type, `transform.undefined`) through a shared `createSql(url, max)` in `tests/fixtures/db.ts` that does not import `server-only` code; `makeBidders(n)` (calls `create_bidder` with a fresh random IP hash per bidder, so the guest limit never trips); `makeAuction(opts)` (calls `create_test_auction`); `withNow(sql, iso, fn)` (runs `fn` in `sql.begin` after `set_config('bidlock.now_override', iso, true)`). The app role cannot `select` from tables, so tests read tables (and run `db/verify/invariants.sql`) through `adminSql()` only. Every test creates its own auctions and bidders; tests never assume an empty database.

### 15.2 pgTAP (DB-xx)

Runner `scripts/db/test-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DATABASE_URL_ADMIN:-postgres://postgres:postgres@localhost:54329/bidlock_test}"
if command -v pg_prove >/dev/null 2>&1; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f db/tests/helpers/00_helpers.sql
  pg_prove --dbname "$DB_URL" --ext .sql --verbose --failures db/tests/*.test.sql
else
  docker compose -f docker/compose.yml exec -T db bash -c \
    "psql -U postgres -d bidlock_test -v ON_ERROR_STOP=1 -q -f /bidlock/db/tests/helpers/00_helpers.sql && \
     pg_prove -U postgres -d bidlock_test --ext .sql --verbose --failures /bidlock/db/tests/*.test.sql"
fi
```

Each test file:

```sql
begin;
select plan(<n>);
-- arrange with bidlock_test.* helpers; move time with bidlock_test.set_now('2026-01-01 12:00:00+00')
-- assertions: is(), ok(), throws_ok(), results_eq(), has_table(), col_type_is(), ...
select * from finish();
rollback;
```

Helpers (`db/tests/helpers/00_helpers.sql`, schema `bidlock_test`, created only in test databases):
- `set_now(ts timestamptz)` → `set_config('bidlock.now_override', ts::text, true)`.
- `bidder(name text default null) returns uuid` → inserts a human bidder.
- `auction(duration_s int default 300, starting_price bigint default 1000, starts_offset_s int default 0, snipe int default 10, extend int default 30, cap int default 20, pay_window int default 180) returns uuid` → inserts a `test` auction relative to `bidlock_now()`.
- `bid(auction uuid, bidder uuid, amount bigint, key uuid default gen_random_uuid()) returns bidlock.bid_result`.
- `sandbox(owner uuid) returns bidlock.sandbox_result`.
- `clean()` → `delete from bidlock.sandboxes; delete from bidlock.auctions; delete from bidlock.bidders; delete from bidlock.rate_counters;` Tests whose assertions count global rows (DB-07 `close_due_auctions` counts, DB-10 public room, DB-11 `stats()`, DB-12 capacity and cleanup) call `bidlock_test.clean()` first. It runs inside the test's own transaction, so the `rollback` at the end restores the data; never run `pnpm test:db` while e2e or k6 use the same database (AGENTS.md).
- The helper file starts with `create schema if not exists bidlock_test;`, uses `create or replace function` only, and is applied by `test-db.sh` before every run.

Test files and required cases (n = minimum assertions):

| ID | File | Cases |
|---|---|---|
| DB-01 | `001_now.test.sql` | no override → within 1 s of `clock_timestamp()`; override honoured when env=test; env=prod + override → throws `BLK01`; offset 60000 → +60 s; `update settings set env='prod', test_clock_offset_ms=5` → throws check violation (23514) |
| DB-02 | `002_schema.test.sql` | tables and key columns exist with types; CHECK `status_payment_pair` rejects (`live`,`paid`), (`settled`, null), (`closed`, null); `price_leader_count` rejects inconsistent rows; unique `auctions_one_open_public`; `set role bidlock_app` then direct `insert into bidlock.auctions` throws 42501; `bidlock_app` can execute `place_bid`; cannot execute `tick`, `advance_auction_locked`, `rate_hit`, `close_due_auctions`, `cleanup_expired`, `_event`, `ensure_public_auction` (`throws_ok(…, '42501')` after `set local role bidlock_app`); no function in schema `bidlock` is executable through `PUBLIC`: inside the test transaction `create role bidlock_probe nologin`, then `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bidlock' and has_function_privilege('bidlock_probe', p.oid, 'execute')` must be 0 (catches a migration that forgot the §6.3 revoke) |
| DB-03 | `003_increments.test.sql` | `increment_for` at 0, 999, 1000, 4999, 5000, 9999, 10000, 24999, 25000, 49999, 50000, 99999, 100000, 249999, 250000, 499999, 500000, 100000000; `min_next_bid(1000, null) = 1000`; `min_next_bid(1000, 999) = 1049`; `min_next_bid(1000, 4950) = 5050`; `max_bid(1000, null) = 1000 + 100*100 = 11000`; cap at 100000000 |
| DB-04 | `004_place_bid_rules.test.sql` | first bid < start → `BID_TOO_LOW` with `min_next_bid = start`; = start accepted, `bid_no = 1`, `version` +1, leader set; second bid by same bidder → `ALREADY_LEADING`; other bidder at price+inc−1 → `BID_TOO_LOW`; at price+inc → accepted; band crossing (price 990 → min 1040; price 1000 → min 1100); `BID_TOO_HIGH` at max+1, accepted at max; amount 0 → `VALIDATION`; scheduled → `AUCTION_NOT_LIVE`; scheduled whose `starts_at` passed → accepted (lazy start); at `ends_at` → `AUCTION_CLOSED` and status now `closed`; unknown auction / bidder → `NOT_FOUND`; sandbox: stranger `NOT_FOUND`, owner accepted, own bot accepted, other sandbox's bot `NOT_FOUND`, bot on test auction `NOT_FOUND`; `bidding_paused` → `BIDDING_PAUSED` and no request row; bids row fields (`prev_amount`, `min_required`, `ends_at_before/after`); `bid_requests` row stored for rule rejections and not for `NOT_FOUND`/`VALIDATION` |
| DB-05 | `005_idempotency.test.sql` | replay accepted → same `bid_id`, `replayed = true`, `bid_count` unchanged, no new event; replay after being outbid → still original accepted result; replay of rejection → same code, `replayed = true`; same key + different amount → `IDEMPOTENCY_MISMATCH`, request count unchanged; same key + other auction → `IDEMPOTENCY_MISMATCH`; two bidders using the same key → both processed independently; replay after auction closed → original result |
| DB-06 | `006_soft_close.test.sql` | bid at `ends_at − 11 s` → no extension; at `ends_at − 10 s` → `ends_at = now + 30 s`, `extended = true`, extension row n=1, event `auction_extended`; at `ends_at − 1 ms` → extends; custom window 5 / extend 20 honoured; `snipe_window_s = 0` → never extends; cap: with `max_extensions = 3`, the 4th late bid accepted with `extended = false` and `extension_count = 3`; `ends_at` never decreases; `ends_at_after` on bid rows matches |
| DB-07 | `007_closing.test.sql` | lazy close via `place_bid` (status `closed`, offer rank 1, `closed_at = ends_at`, not the processing time); lazy close via `auction_state`; no bids → `unsold`, `payment_state` null; `close_due_auctions()` closes 3 due auctions and returns 3, second call returns 0; not-yet-due auction untouched; scheduled due → `live`; scheduled with passed `ends_at` → `unsold` in one call; `tick()` returns counts and a public auction id; D-28: with a test-only `before update` trigger on `bidlock.auctions` (created inside the test transaction) that raises for one chosen auction id, `close_due_auctions()` still closes the other due auctions and the chosen one stays `live` |
| DB-08 | `008_settlement.test.sql` | offer deadline = processing time + `payment_window_s`; winner pays before deadline → `settled`/`paid`, `settled_at`, event; second pay → `replayed = true`; non-winner pays → `NOT_PAYABLE`; winner pays after deadline → `OFFER_EXPIRED`, runner-up offer rank 2 at runner-up's highest bid, strike count 1 and strike row; runner-up selection with three bidders (A 10, B 11, C 12, B 13, C 14 → winner C, runner-up B at 13); runner-up pays → `settled` rank 2; runner-up expires → `unsold`/`expired`, winner strike still 1, runner-up strike 0; single-bidder auction expiry → `unsold`/`expired`; `expire_due_offers()` idempotent; late processing: window opens at processing time |
| DB-09 | `009_rate_limits.test.sql` | (reset limits to defaults in-transaction) human: hits 1–3 in one second → 0, 4th → retry in (0, 1000]; next second → 0; 61st in a minute → > 0; bot: 2nd within 2 s → > 0, after 2 s → 0; IP: 201st → > 0; `retry_after_ms` = ms to window end (with fixed `now`); unknown limit → `BLK20`; `create_bidder` 21st within an hour → `RATE_LIMITED`; counters keyed by subject (other bidder unaffected) |
| DB-10 | `010_public_room.test.sql` | `ensure_public_auction()` creates one live public auction when none; second call returns the same id; inserting a second open public auction throws 23505; after the public lot closes, the next has `starts_at = closed_at + 15 s` (`scheduled`) and becomes `live` lazily; `auction_state` of the finished lot returns `next_public_auction_id`; public lot defaults (start 1000, 5 minutes, no sandbox) |
| DB-11 | `011_reads.test.sql` | `auction_state` key set equals the documented list; `null` for stranger on sandbox; `list_bids` newest page, `cursor`, `after`, `next_cursor` null at the end; `get_me` returns active sandbox and only non-expired open offers; `get_me` of a bot → null; `stats()` counts |
| DB-12 | `012_sandboxes.test.sql` | create → accepted, live auction of 2 min at 2000, 3 bots with personas; second create → `SANDBOX_EXISTS` with same ids; after the sandbox auction becomes `settled`, a new create succeeds; `max_active_sandboxes = 2` → third owner gets `SANDBOX_CAPACITY`; IP limit (reset to 5) → 6th → `RATE_LIMITED`; `sandbox_bots` null for non-owner and after expiry; `cleanup_expired()` deletes sandboxes that expired before UTC midnight (with all rows), keeps today's, deletes public auctions older than 7 days, deletes idle bidders older than 30 days only when unreferenced |
| DB-13 | `013_realtime.test.sql` | create stub `realtime.send` (schema `realtime`, logs calls into a temp table); `realtime_mode='broadcast'`: one call per accepted bid with topic `auction:<id>`, event `auction_changed`, payload `version` and `bid.bid_no`; one call per lifecycle transition; no call on a rejected bid without transition; stub that raises → bid still accepted; `realtime_mode='none'` → no calls |
| DB-14 | `014_audit.test.sql` | event sequence for a full lifecycle (created, started, bid_accepted ×n, auction_extended, auction_closed, offer_opened, offer_expired, strike_recorded, offer_opened, offer_paid) in order with correct bidder ids |
| DB-15 | `015_test_support.test.sql` | `create_test_auction` and `set_test_clock` work when env=test; with env=prod both throw `BLK30` |

### 15.3 Integration tests (INT-xx)

`vitest.integration.config.ts`: `include: ["tests/integration/**/*.int.test.ts"]`, `pool: "forks"`, `poolOptions.forks.singleFork: true` (Vitest 4 renamed pool options; use the equivalent of the installed major), `testTimeout: 60_000`, env `DATABASE_URL` (app role) and `DATABASE_URL_ADMIN` with the local `bidlock_test` defaults from §5 when unset, `resolve.alias` for `server-only` as in `vitest.config.ts`, and the same test values as the Playwright `webServer.env` for `APP_ENV=test`, `DEMO_MODE=on`, `APP_ORIGIN`, `TRUST_PROXY=none`, `SESSION_SECRET`, `BOT_TOKEN_SECRET`, `IP_HASH_SALT`, `TEST_API_SECRET` (route-handler tests call `env()`). `pnpm db:reset` must have run against that database (CI does it in the job; locally `pnpm test:all` does).

INT-01 `concurrency.int.test.ts` (FR-91):

```ts
test("500 parallel bids from 200 bidders keep every invariant", async () => {
  const app = createSql(DATABASE_URL, 50);       // app role, same types/options as src/server/db.ts
  const admin = adminSql();                      // reads tables (the app role has no SELECT)
  const bidders = await makeBidders(200);
  const auctionId = await makeAuction({ duration_s: 600, starting_price: 1000, snipe_window_s: 0 });

  type Call = { bidder: string; key: string; amount: number; kind: "fresh" | "replay" | "mismatch" };
  const results: Array<{ call: Call; row: BidResultRow }> = [];

  async function freshCall(i: number): Promise<void> {
    const bidder = bidders[i % 200]!;
    const [s] = await admin`select current_price, starting_price from bidlock.auctions where id = ${auctionId}`;
    const min = minNextBid(s.starting_price, s.current_price);          // TS mirror
    const amount = min + incrementFor(s.current_price ?? s.starting_price) * Math.floor(Math.random() * 3);
    const call: Call = { bidder, key: crypto.randomUUID(), amount, kind: "fresh" };
    const [row] = await app`select * from bidlock.place_bid(${auctionId}, ${bidder}, ${amount}, ${call.key})`;
    results.push({ call, row: BidResultRow.parse(row) });
  }

  await Promise.all(Array.from({ length: 500 }, (_, i) => freshCall(i)));
  // 50 replays (same key + amount) and 10 mismatches (same key, amount + 1) of random earlier calls, in parallel:
  const sample = pickRandom(results, 60);
  await Promise.all(sample.map(({ call }, j) => replayOrMismatch(call, j < 50 ? "replay" : "mismatch")));

  // Assertions
  //  1. no thrown errors; every outcome in {accepted, BID_TOO_LOW, ALREADY_LEADING} for fresh calls
  //  2. accepted fresh count === auctions.bid_count === count(bids)
  //  3. exactly one leader; leader = bidder of max(amount); current_price = max(accepted amounts)
  //  4. ordered by bid_no: 1..n consecutive; amount >= prev + incrementFor(prev); no consecutive same bidder
  //  5. replays: same bid_id/error as original, replayed === true; mismatches: IDEMPOTENCY_MISMATCH
  //  6. count(bid_requests where auction) === number of distinct (bidder,key) fresh calls
  //  7. db/verify/invariants.sql (run with admin, $1 = auctionId) returns 0 violations for every check
  //  8. at least 20 accepted bids (the test must actually contend)
});
```

INT-02 `races.int.test.ts`:
- SKIP LOCKED: connection A `begin; select … for update` on a due auction; connection B `select bidlock.close_due_auctions()` returns without waiting (assert it finishes in < 1 s) and the auction is still `live`; A commits; B again → the auction is now `closed`/`unsold`. (Assert on the auction's status, not on the returned count: other due auctions may exist in the shared test database.)
- Lazy close race: 20 parallel bids issued 50 ms after `ends_at` (using a test auction with `duration_s: 2`) → all `AUCTION_CLOSED`, exactly one `auction_closed` event, one offer.
- Same key, same auction, 10 parallel identical calls → exactly one bid, nine `replayed = true`.
- Same key, two auctions, parallel → one processed, the other `IDEMPOTENCY_MISMATCH`.
- Two parallel `pay_offer` calls by the winner → one `replayed = false`, one `replayed = true`.
- 10 parallel `ensure_public_auction()` with no open public auction (first close the current open public auction, if any, with `withNow(admin, <its ends_at + 1 s>, sql => sql\`select bidlock.close_due_auctions()\`)`; never update `ends_at` directly, the `ends_not_before_orig` CHECK forbids moving it back) → all 10 return the same id and exactly one open public auction exists.
- 5 parallel `create_sandbox` for one owner → one accepted, four `SANDBOX_EXISTS`.
- Due public auction locked by connection A (`begin; select … for update`): `ensure_public_auction()` and `list_auctions(null)` on connection B return that auction's id (never null) without waiting; after A commits, B's next call advances it.

INT-03 `increments-parity.int.test.ts`: `select lower_bound, increment from bidlock.increment_bands order by 1` deep-equals `INCREMENT_BANDS` in `src/domain/increments.ts`.

### 15.4 Unit tests (UT-xx)

| ID | File | Covers |
|---|---|---|
| UT-01 | `money.test.ts` | `formatCents` (0 → "$0.00", 105 → "$1.05", 123456 → "$1,234.56", 100000000 → "$1,000,000.00"); `parseDollarInput` accept/reject table from §11.8 |
| UT-02 | `increments.test.ts` | band boundaries; `minNextBid`; `quickBidAmounts(state)` = [min, min+inc, min+4·inc]; quick amounts never exceed `max_bid` (clamped and deduplicated) |
| UT-03 | `clock.test.ts` | offset from symmetric RTT; lowest-RTT wins; outliers ignored; ring buffer of 8; `formatCountdown` 0 → "0:00", 999 → "0:01", 7000 → "0:07", 192000 → "3:12", 3723000 → "1:02:03"; never negative |
| UT-04 | `reconcile.test.ts` | rules 1–7 of §11.7 including stale change ignored, gap → refetch, status change → refetch, bid dedupe, trim to 100, extension detection duration 30000 |
| UT-05 | `session.test.ts` | round trip; tampered uuid/iat/sig; wrong prefix; future iat; previous secret accepted and flagged for re-issue |
| UT-06 | `botTokens.test.ts` | round trip; expired; `aid` mismatch; `own` mismatch; tampered payload |
| UT-07 | `botScheduler.test.ts` | determinism (same seed + same room sequence → same decisions); never bids while leading; ≥ 2000 ms between bids; waits in [1000, 6000]; sniper silent before last 15 s; drop when min > budget; payment probability per persona over 10,000 draws within ±2% |
| UT-08 | `names.test.ts` | normalization; each failure reason; leet profanity ("sh1t" style cases from the list); "Robot" rejected (`bot` suffix), "Botanist" accepted |
| UT-09 | `errors.test.ts` | every `ErrorCode` has a status and a copy key; DB result → AppError mapping |
| UT-10 | `ip.test.ts` | XFF parsing with spaces and multiple values; IPv6 /64 reduction; `TRUST_PROXY=none` → "local"; hash stable and 32 hex chars |
| UT-11 | `liveAnnouncer.dom.test.ts` | 3 s throttle, latest value wins, assertive once per event id |
| UT-12 | `benchReport.test.ts` | builds result JSON and Markdown row from fixture k6 summary + verify output; threshold pass/fail |
| UT-13 | `http.test.ts` | route() order: DEMO_OFF before Origin; readonly blocks mutating only; Origin mismatch 403; missing Origin and `Origin: null` 403; body > 4 KB 413; request id reuse |
| UT-14 | `csp.test.ts` | CSP header string for dev/prod, with and without the Supabase host; nonce present in `script-src`; proxy forwards the CSP on the request headers (§13.4) |

Coverage goal: `src/domain/**` ≥ 90% lines (`vitest --coverage` with v8); not enforced for components.

### 15.5 E2E (E2E-xx)

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 3_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  projects: [
    { name: "parallel", grepInvert: /@isolated/, fullyParallel: true, workers: 4 },
    { name: "isolated", grep: /@isolated/, dependencies: ["parallel"], fullyParallel: false, workers: 1 },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_ENV: "test", DEMO_MODE: "on", APP_ORIGIN: `http://localhost:${PORT}`, TRUST_PROXY: "none",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123", BOT_TOKEN_SECRET: "e2e-bot-secret-0123456789abcdef01234567",
      IP_HASH_SALT: "e2e-ip-salt-0123456789", TEST_API_SECRET: "e2e-test-secret", BOT_SEED_OVERRIDE: "42", DB_POOL_MAX: "10",
    },
  },
});
```

Project-level `workers` requires Playwright ≥ 1.52 (A-08); if unavailable, run `playwright test --project=parallel` then `playwright test --project=isolated --workers=1`.

Fixtures (`tests/e2e/fixtures.ts`): `testApi` (request context with `x-test-secret`), `createAuction(opts)`, `setClock(ms)` / `resetClock()` (always called in `finally` / `afterEach` for isolated tests), `newBidder(browser)` (new context, visits `/` so `/api/me` creates a fresh bidder, renames it to a unique `E2E-<random6>`).

| ID | File | Project | Scenario |
|---|---|---|---|
| E2E-01 | `api.spec.ts` | parallel | `GET /api/me` sets `bl_sid` HttpOnly; POST without Origin → 403; invalid body → 400 `VALIDATION`; replay over HTTP → 200 + `Idempotent-Replayed`; mismatch → 422; bot token for another auction → 401; `/api/test/clock` without secret → 404; `GET /state` with matching `If-None-Match` → 304 |
| E2E-02 | `two-bidders.spec.ts` | parallel | test auction; A and B in two contexts; A clicks "Bid $10.00" → A sees "You are the highest bidder."; B sees price $10.00 and "Leader: E2E-…" within 3 s; B presses key `2`; A sees "You've been outbid." and new price; A's quick buttons show the new minimum; A clicks a stale amount via the custom field → "Someone bid first. The minimum is now …"; bid history shows both rows with "You" on the right one |
| E2E-03 | `sandbox-bots.spec.ts` | parallel | visitor clicks "Start a sandbox" → room with "Your sandbox · expires in 14:5x", bot strip with three chips; within 15 s at least one row with a "BOT" badge; visitor bids; leader line updates; the BotRunner never places two bids from the same bot within 2 s (assert from bid timestamps) |
| E2E-04 | `settlement.spec.ts` | isolated | A wins a 20 s test auction (clock +21 s) → "You won Lot …" and "Pay now (simulated)"; click → "Paid. Lot … is yours for …". Second test: B bids, A outbids; clock +21 s; wait until A's page shows "You won Lot …" (the room's polling applied T4, so the offer window opened at +21 s, D-14); only then clock +202 s (21 + 181) → B sees "Second-chance offer." and pays → "Paid. … through a second-chance offer."; A sees "Your payment window expired…" and name chip "1 missed payment". Moving the clock to +202 s directly would open the window at +202 s and nothing would expire |
| E2E-05 | `extension-banner.spec.ts` | isolated | test auction 120 s; clock +112 s; A bids → banner "Late bid! Closing moved to 0:30" and "Extension 1 of 20"; countdown reads 0:29 or 0:30; history row has "+0:30" tag |
| E2E-06 | `public-room.spec.ts` | isolated | lobby shows a "PUBLIC ROOM · LIVE" or "PUBLIC ROOM · NEXT LOT" card with a countdown; "Enter the room" navigates; bid succeeds or returns a valid rejection; the lobby benchmark headline shows either the with-data copy or the exact without-data copy from PRD §9.2, matching `bench/results/latest.json` |
| E2E-07 | `a11y.spec.ts` | parallel | axe on `/`, `/a/<test auction>`, `/how-it-works` (light and dark via `colorScheme`) → 0 serious/critical (`/how-it-works` is added in T-44); keyboard-only bid (Tab to "Bid", Enter); 360×740 viewport: `document.documentElement.scrollWidth <= 360` on all pages; `reducedMotion: "reduce"` → price element has no running animations (`getAnimations().length === 0`); polling build: no `page.on("websocket")` event on `/a/<id>` (FR-46, Supabase client not loaded) |
| E2E-08 | `states.spec.ts` | parallel | rate limited: from the bidder's own context call `POST /bids` 65 times as fast as possible with unique keys and an amount 1 cent below the minimum (all counted, including rejections), then click a quick bid → text matches `/^Slow down\. You can bid again in \d+ s\.$/` and controls are disabled (65 > 60/min makes the minute window trip even if the burst straddles a one-second boundary); not found `/a/<random uuid>` → "Auction not found."; scheduled test auction (`starts_in_s: 60`) → "Opens in 1:00"/"0:59" and disabled controls |
| E2E-09 | `bundle.spec.ts` | parallel | NFR-15 fallback (D-33): open `/a/<test auction>` in a fresh context, sum `encodedBodySize` of `performance.getEntriesByType("resource")` entries with `initiatorType === "script"` under `/_next/` after `load` → ≤ 180 × 1024 bytes (Next's server gzips responses by default) |

DEMO_MODE `readonly`/`off` behaviour is covered by UT-13 and a manual release-checklist step (switching modes needs a server restart).

Component tests use Testing Library (`@testing-library/react`, `@testing-library/user-event`, `jsdom` as dev dependencies) in `tests/unit/*.dom.test.tsx`; components read copy from `src/domain/copy.ts`, so these tests assert against the same constants.

### 15.6 Load test (LOAD-01)

#### 15.6.1 Setup

- Run parameters (env, passed into the k6 container by compose, §17.2): `VUS` (default 500), `DURATION` (default `60s`), `AUCTION_S` (auction `duration_s`, default 45). Small local runs use e.g. `VUS=50 DURATION=15s AUCTION_S=8`.
- Environment: `docker/compose.yml` (§17.2) with `db` (postgres:17, `max_connections=200`), `migrate` (applies migrations + `db/env/load.sql`), `app` (production standalone build, `APP_ENV=test`, `DB_POOL_MAX=20`, `NEXT_PUBLIC_FEED=polling`), `k6` (profile `load`).
- The live site is never a target: `BASE_URL` defaults to `http://app:3000` and `check:guards` rejects `firatkil.com` in load files.

#### 15.6.2 `load/bid-storm.js`

```js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

const BASE = __ENV.BASE_URL || "http://app:3000";
const SECRET = __ENV.TEST_API_SECRET;
const VUS = Number(__ENV.VUS || 500);
const DURATION = __ENV.DURATION || "60s";
const AUCTION_S = Number(__ENV.AUCTION_S || 45);
const ORIGIN = __ENV.APP_ORIGIN || BASE;
const EXPECTED = new Set(["BID_TOO_LOW", "ALREADY_LEADING", "AUCTION_CLOSED", "RATE_LIMITED"]);

const bidLatency = new Trend("bid_latency", true);
const unexpected = new Rate("unexpected_errors");
const replayMismatch = new Counter("replay_mismatch");
const outcomes = {
  accepted: new Counter("outcome_accepted"), BID_TOO_LOW: new Counter("outcome_bid_too_low"),
  ALREADY_LEADING: new Counter("outcome_already_leading"), AUCTION_CLOSED: new Counter("outcome_auction_closed"),
  RATE_LIMITED: new Counter("outcome_rate_limited"), OTHER: new Counter("outcome_other"),
};

export const options = {
  setupTimeout: "180s",
  scenarios: { storm: { executor: "constant-vus", vus: VUS, duration: DURATION, gracefulStop: "10s" } },
  thresholds: {
    "bid_latency": ["p(95)<250", "p(99)<600"],
    "unexpected_errors": ["rate<0.01"],
    "replay_mismatch": ["count==0"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  // Bidders first: creating 500 guests takes seconds, and the auction clock must not run meanwhile.
  const cookies = [];
  for (let i = 0; i < VUS; i++) {
    const r = http.get(`${BASE}/api/me`, { jar: new http.CookieJar() });   // fresh jar => new bidder each time
    const c = r.cookies.bl_sid && r.cookies.bl_sid[0];
    if (!c) throw new Error(`no cookie for bidder ${i}: ${r.status}`);
    cookies.push(`bl_sid=${c.value}`);
  }
  const a = http.post(`${BASE}/api/test/auctions`, JSON.stringify({
    duration_s: AUCTION_S, starting_price: 1000, snipe_window_s: 10, extend_by_s: 12, max_extensions: 20,
  }), { headers: { "content-type": "application/json", "x-test-secret": SECRET } });
  if (a.status !== 201) throw new Error(`test auction not created: ${a.status} ${a.body}`);
  const auctionId = a.json("auction_id");
  return { auctionId, cookies, startedAt: Date.now() };
}

let state = { min: 1000, inc: 100, last: null, closed: false };   // per VU

export default function (data) {
  if (state.closed) { sleep(1); return; }
  const headers = { "content-type": "application/json", origin: ORIGIN, cookie: data.cookies[__VU - 1] };
  const replay = state.last && Math.random() < 0.05;
  const body = replay ? state.last.body : {
    amount: state.min + state.inc * Math.floor(Math.random() * 3),
    idempotency_key: uuidv4(),
  };
  const res = http.post(`${BASE}/api/auctions/${data.auctionId}/bids`, JSON.stringify(body),
                        { headers, tags: { name: "bid" } });
  bidLatency.add(res.timings.duration);

  let code = null;
  if (res.status === 200 || res.status === 201) {
    const j = safeJson(res) || { auction: { min_next_bid: state.min } };
    outcomes.accepted.add(1);
    state.min = j.auction.min_next_bid;
  } else {
    const j = safeJson(res) || {};
    code = j.error && j.error.code;
    (outcomes[code] || outcomes.OTHER).add(1);
    const d = (j.error && j.error.details) || {};
    if (d.min_next_bid) state.min = d.min_next_bid;
    if (code === "AUCTION_CLOSED") state.closed = true;
  }
  unexpected.add(!(res.status < 300 || EXPECTED.has(code)));

  // Only stored outcomes are replayable (D-09): accepted and rule rejections. RATE_LIMITED, network
  // errors (status 0) and 5xx are never stored, so they are neither recorded as "last" nor compared.
  const stored = res.status !== 0 && res.status < 500 && code !== "RATE_LIMITED";
  if (replay) {
    if (stored) {
      const sameOutcome = (res.status < 300) === (state.last.status < 300) && code === state.last.code;
      if (!sameOutcome) replayMismatch.add(1);
    }
  } else if (stored) {
    state.last = { body, status: res.status, code };
  }
  // increment for the next attempt: ask the server's ladder via the response when available
  state.inc = incrementFor(state.min);
  sleep(0.35 + Math.random() * 0.6);                    // ~1.5 req/s per VU, under the 3/s burst limit
}

function safeJson(res) {
  try { return res.json(); } catch (_) { return null; }   // network errors have no body
}

function incrementFor(p) {                               // copy of the ladder for amount generation only
  const bands = [[500000, 25000], [250000, 10000], [100000, 5000], [50000, 2500], [25000, 1000], [10000, 500], [5000, 200], [1000, 100], [0, 50]];
  for (const [lb, inc] of bands) if (p >= lb) return inc;
  return 50;
}

export function handleSummary(data) {
  return { "/out/k6-summary.json": JSON.stringify(data, null, 2), stdout: textSummary(data) };
}
```

Timing with the defaults (`AUCTION_S = 45`, `snipe_window_s: 10`, `extend_by_s: 12`, `max_extensions: 20`), measured from the end of `setup()`: the soft-close window opens at ~35 s. Every accepted bid inside the window moves `ends_at` to `now + 12 s` (FR-07: with `extend_by_s ≥ snipe_window_s` each window bid extends), so at hundreds of bids per second the 20 extensions are used within the first second of the window; the auction then closes at ~35 s + 12 s ≈ 47 s, and the remaining ~13 s exercise lazy close under load and post-close `AUCTION_CLOSED` rejections. VUs that saw `AUCTION_CLOSED` idle, so latency samples come from the live phase plus the first post-close requests. The auction id reaches the verifier through `handleSummary`: the k6 summary JSON contains `setup_data.auctionId`, written to `/out/k6-summary.json` (= `bench/out/k6-summary.json` on the host).

#### 15.6.3 Verification (`scripts/bench/verify.ts` + `db/verify/invariants.sql`)

`verify.ts`: reads the auction id from `bench/out/k6-summary.json` (`setup_data.auctionId`); with `DATABASE_URL_ADMIN` polls every 2 s (max 120 s) calling `select bidlock.close_due_auctions()` until the auction status is not `live`; runs `invariants.sql` with `$1 = auction id` (`sql.unsafe(text, [auctionId])`, the one allowed `sql.unsafe` use outside `scripts/db`); writes `bench/out/verify.json` `{ auction_id, status, final_price, bid_count, extension_count, checks: [{ id, check, violations }] }`; exits 1 if any `violations > 0`, if the auction is still `live` after 120 s, or if `bid_count < BENCH_MIN_BIDS` (env, default 100; the run must have contended; small local runs set e.g. `BENCH_MIN_BIDS=10`).

```sql
-- db/verify/invariants.sql ($1 = auction id)
with a as (select * from bidlock.auctions where id = $1),
     b as (select * from bidlock.bids where auction_id = $1),
     o as (select b.*, lag(amount) over w as prev_amount_seq, lag(bidder_id) over w as prev_bidder,
                  lag(bid_no) over w as prev_no
             from b window w as (order by bid_no))
select 'INV-01' as id, 'leader is the bidder of the highest bid' as check, count(*)::int as violations
  from a where a.leader_bidder_id is distinct from (select bidder_id from b order by amount desc limit 1)
union all
select 'INV-02', 'current_price equals max accepted amount', count(*)::int
  from a where a.current_price is distinct from (select max(amount) from b)
union all
select 'INV-03a', 'bid_no is 1..n without gaps', count(*)::int from o where bid_no <> coalesce(prev_no, 0) + 1
union all
select 'INV-03b', 'each bid meets start or previous + increment', count(*)::int
  from o cross join a
 where (o.prev_amount_seq is null and o.amount < a.starting_price)
    or (o.prev_amount_seq is not null and o.amount < o.prev_amount_seq + bidlock.increment_for(o.prev_amount_seq))
union all
select 'INV-04', 'no consecutive bids by the same bidder', count(*)::int from o where bidder_id = prev_bidder
union all
select 'INV-05', 'every bid placed before ends_at at that moment', count(*)::int from b where placed_at >= ends_at_before
union all
select 'INV-06', 'no bid at or after the logical close', count(*)::int
  from b cross join a where a.closed_at is not null and b.placed_at >= a.closed_at
union all
select 'INV-07a', 'one request row per (bidder, key)', count(*)::int
  from (select 1 from bidlock.bid_requests where auction_id = $1 group by bidder_id, idempotency_key having count(*) > 1) x
union all
select 'INV-07b', 'every bid has exactly one accepted request', count(*)::int
  from b left join bidlock.bid_requests r on r.id = b.request_id where r.id is null or r.outcome <> 'accepted'
union all
select 'INV-07c', 'every accepted request has a bid', count(*)::int
  from bidlock.bid_requests r where r.auction_id = $1 and r.outcome = 'accepted'
   and not exists (select 1 from b where b.request_id = r.id)
union all
select 'INV-08a', 'extension_count within cap and equal to extension rows', count(*)::int
  from a where a.extension_count > a.max_extensions
            or a.extension_count <> (select count(*) from bidlock.auction_extensions e where e.auction_id = $1)
union all
select 'INV-08b', 'extensions move ends_at forward', count(*)::int
  from bidlock.auction_extensions e where e.auction_id = $1 and e.new_ends_at <= e.old_ends_at
union all
select 'INV-10', 'at most one open and one paid offer; settled iff one paid offer', count(*)::int
  from a where (select count(*) from bidlock.offers where auction_id = $1 and status = 'open') > 1
            or (select count(*) from bidlock.offers where auction_id = $1 and status = 'paid') > 1
            or ((a.status = 'settled') <> exists (select 1 from bidlock.offers where auction_id = $1 and status = 'paid'))
union all
select 'INV-11', 'runner-up offer goes to another bidder at their own highest bid', count(*)::int
  from bidlock.offers r
  join bidlock.offers w on w.auction_id = r.auction_id and w.rank = 1
 where r.auction_id = $1 and r.rank = 2
   and (r.bidder_id = w.bidder_id
        or r.amount <> (select max(amount) from b where b.bidder_id = r.bidder_id))
union all
select 'INV-12', 'bid_count equals accepted bids', count(*)::int from a where a.bid_count <> (select count(*) from b)
union all
select 'INV-13', 'valid status / payment_state pair', count(*)::int
  from a where ((a.status in ('scheduled','live') and a.payment_state is null)
                 or (a.status = 'closed' and a.payment_state in ('awaiting_payment','offered_to_runner_up'))
                 or (a.status = 'settled' and a.payment_state = 'paid')
                 or (a.status = 'unsold' and (a.payment_state is null or a.payment_state = 'expired'))) is not true
order by 1;
```

#### 15.6.4 Report (`scripts/bench/report.ts`)

Inputs: `bench/out/k6-summary.json`, `bench/out/verify.json`, env `GITHUB_SHA`, `RUNNER_OS`, `/proc/cpuinfo` model name and `os.cpus().length`, `os.totalmem()`. Output `bench/results/<YYYY-MM-DD>.json` (suffix `-2`, `-3` when the date exists), copy to `bench/results/latest.json`, regenerate `bench/SUMMARY.md` from all result files (newest first). `--no-commit` (local runs) writes `bench/out/result.json` and `bench/out/SUMMARY.md` instead and leaves `bench/results/` untouched. `--k6-outcome <success|failure>` records the k6 step outcome; `thresholds.passed` is true only when it is `success` and every threshold in the k6 summary passed. `--init` writes the empty-state `bench/results/latest.json` (below) if the file is missing.

Result schema (version 1), validated with Zod `BenchResult` in `src/domain/schemas.ts` (also used by the lobby headline and `/how-it-works`):

```json
{
  "schema": 1,
  "date": "2026-10-18",
  "commit": "abc1234",
  "runner": { "os": "Linux", "cpus": 4, "cpu_model": "AMD EPYC 7763 64-Core Processor", "memory_gb": 16 },
  "config": { "vus": 500, "duration_s": 60, "db_pool_max": 20, "postgres": "17.x",
              "auction": { "duration_s": 45, "snipe_window_s": 10, "extend_by_s": 12, "max_extensions": 20 } },
  "requests": { "bids": 41230, "replays": 2010, "rps": 680.5 },
  "outcomes": { "accepted": 3120, "BID_TOO_LOW": 31002, "ALREADY_LEADING": 2400, "AUCTION_CLOSED": 4700, "RATE_LIMITED": 8, "OTHER": 0 },
  "unexpected_error_rate": 0,
  "latency_ms": { "p50": 21.4, "p90": 60.2, "p95": 84.0, "p99": 160.3, "max": 410.9 },
  "auction": { "final_price": 1234500, "bid_count": 3120, "extension_count": 20, "status": "closed" },
  "invariants": [{ "id": "INV-01", "check": "leader is the bidder of the highest bid", "violations": 0 }],
  "thresholds": { "p95_ms": 250, "p99_ms": 600, "unexpected_error_rate": 0.01, "passed": true }
}
```

The numbers above are placeholders for shape only; never commit a fabricated result. Until the first real run, `bench/results/` contains only the committed empty-state file `bench/results/latest.json` = `{"schema":1,"empty":true}` (created in T-32, so the static `import` in the lobby and `/how-it-works` always resolves at build time) and the UI shows the "no data" copy. `BenchResult` is therefore a Zod union: `z.object({ schema: z.literal(1), empty: z.literal(true) }).strict()` or the full object above (`.strict()`). `report.ts` never copies the empty file into a dated result.

`SUMMARY.md` columns: Date, Commit, VUs, Bid requests, Accepted, p95 ms, p99 ms, Unexpected errors, Invariant violations, Thresholds.

---

## 16. CI (GitHub Actions)

### 16.1 `.github/workflows/ci.yml`

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "24"
  # Job-level env cannot read the env context, so the two URLs are repeated in each database job.

jobs:
  static:
    name: lint, typecheck, unit, guards
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:unit --coverage
      - run: pnpm check:guards

  db:
    name: pgTAP
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: bidlock_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -h 127.0.0.1 -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 20
    env:
      DATABASE_URL_ADMIN: postgres://postgres:postgres@localhost:5432/bidlock_test
      DATABASE_URL: postgres://bidlock_app:bidlock_app@localhost:5432/bidlock_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # The stock postgres:17 image has no pgTAP. Service containers cannot be built from a Dockerfile,
      # so install the PGDG package into the running container (it runs as root and ships the PGDG
      # apt source; A-07). The package only adds extension files, so no restart is needed.
      # If A-07 fails: drop the service, `docker build -t bidlock-postgres:17 docker/postgres` and
      # `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bidlock_test bidlock-postgres:17`,
      # then wait with `until pg_isready -h 127.0.0.1 -U postgres; do sleep 1; done`.
      # Healthchecks use -h 127.0.0.1: during first-start init the entrypoint's temporary server listens
      # on the Unix socket only, so a socket check can report "ready" before the real server is up.
      - name: Install pgTAP extension into the service container
        run: |
          docker exec ${{ job.services.postgres.id }} bash -c \
            "apt-get update -qq && apt-get install -y -qq --no-install-recommends postgresql-17-pgtap"
          docker exec ${{ job.services.postgres.id }} test -f /usr/share/postgresql/17/extension/pgtap.control
      - name: Install pg_prove and psql on the runner
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq --no-install-recommends libtap-parser-sourcehandler-pgtap-perl postgresql-client
      - run: pnpm db:reset
      - run: pnpm test:db

  integration:
    name: concurrency integration
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: bidlock_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -h 127.0.0.1 -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 20
    env:
      DATABASE_URL_ADMIN: postgres://postgres:postgres@localhost:5432/bidlock_test
      DATABASE_URL: postgres://bidlock_app:bidlock_app@localhost:5432/bidlock_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:reset --no-pgtap
      - run: pnpm test:concurrency

  e2e:
    name: e2e (polling feed)
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: bidlock_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -h 127.0.0.1 -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 20
    env:
      DATABASE_URL_ADMIN: postgres://postgres:postgres@localhost:5432/bidlock_test
      DATABASE_URL: postgres://bidlock_app:bidlock_app@localhost:5432/bidlock_test
      NEXT_PUBLIC_FEED: polling
      NEXT_PUBLIC_POLL_INTERVAL_MS: "1000"
      NEXT_PUBLIC_REPO_URL: https://github.com/firatkill/bidlock
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:reset --no-pgtap
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report
            test-results
          retention-days: 7

  build:
    name: production build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      APP_ENV: production
      NEXT_PUBLIC_FEED: broadcast
      NEXT_PUBLIC_POLL_INTERVAL_MS: "2000"
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
      NEXT_PUBLIC_REPO_URL: https://github.com/firatkill/bidlock
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: First-load JS budget for /a/[id] (NFR-15)
        run: node scripts/check-bundle.mjs --route "/a/[id]" --max-kb 180
```

`scripts/check-bundle.mjs` reads `.next/app-build-manifest.json` (Webpack builds), sums the gzipped size (`zlib.gzipSync`) of the JS chunks listed for the route (including the shared root chunks), and exits 1 above the budget. Next 16 builds with Turbopack by default and may not emit that manifest (verify at T-33, A-10); when the manifest is absent the script prints `check-bundle: manifest not found, NFR-15 enforced by E2E-09` and exits 0, and E2E-09 (measured transfer size of a production build in the e2e job) is the enforcing check (D-33).

`pnpm/action-setup@v4` reads the pnpm version from `packageManager` in `package.json`.

### 16.2 `.github/workflows/load.yml`

```yaml
name: load

on:
  workflow_dispatch:
    inputs:
      vus:
        description: Virtual users
        default: "500"
      duration:
        description: k6 duration
        default: "60s"
  schedule:
    - cron: "0 4 * * 1"          # Mondays 04:00 UTC

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: load
  cancel-in-progress: false

env:
  COMPOSE: docker compose -f docker/compose.yml
  DATABASE_URL_ADMIN: postgres://postgres:postgres@localhost:54329/bidlock_load

jobs:
  bid-storm:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: mkdir -p bench/out && chmod 777 bench/out     # grafana/k6 runs as a non-root user
      - name: Build images
        run: $COMPOSE build db migrate app
      - name: Start database, migrate, start app
        run: |
          $COMPOSE up -d db --wait
          $COMPOSE run --rm migrate
          $COMPOSE up -d --no-deps app
          for i in $(seq 1 60); do curl -fsS http://localhost:3000/api/health >/dev/null && break; sleep 2; done
          curl -fsS http://localhost:3000/api/health
      - name: Run k6
        id: k6
        continue-on-error: true
        env:
          VUS: ${{ inputs.vus || '500' }}
          DURATION: ${{ inputs.duration || '60s' }}
        # The k6 service's command (compose) is "run /load/bid-storm.js"; the image entrypoint is k6.
        run: $COMPOSE --profile load run --rm --no-deps k6
      - name: Verify invariants
        id: verify
        run: pnpm bench:verify
      - name: Write report
        run: pnpm bench:report --k6-outcome "${{ steps.k6.outcome }}"
      - name: Collect logs
        if: always()
        run: $COMPOSE logs --no-color > bench/out/compose.log 2>&1 || true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: bench-${{ github.run_id }}
          path: |
            bench/out
            bench/results
            bench/SUMMARY.md
          retention-days: 30
      - name: Open pull request with results
        if: steps.verify.outcome == 'success'
        uses: peter-evans/create-pull-request@v7
        with:
          branch: bench/results
          delete-branch: true
          commit-message: "bench: load test results ${{ github.run_id }}"
          title: "bench: load test results"
          body: |
            Automated k6 bid-storm run ${{ github.run_id }}.
            k6 thresholds: ${{ steps.k6.outcome }}. Invariant verification: passed.
            See bench/SUMMARY.md and the run artifact.
          add-paths: |
            bench/results/*.json
            bench/SUMMARY.md
      - name: Fail when thresholds failed
        if: steps.k6.outcome != 'success'
        run: exit 1
      - name: Shut down
        if: always()
        run: $COMPOSE --profile load down -v
```

Repository setting required: Settings → Actions → General → Workflow permissions → enable "Allow GitHub Actions to create and approve pull requests" (A-09). PRs opened with `GITHUB_TOKEN` do not trigger `ci.yml`; that is acceptable because they only change JSON and Markdown.

### 16.3 `.github/workflows/keepalive.yml`

```yaml
name: keepalive

on:
  schedule:
    - cron: "17 6 */3 * *"       # every third day, 06:17 UTC
  workflow_dispatch:

permissions: {}

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Health check (touches the database)
        run: |
          curl -fsS --retry 3 --retry-delay 10 --max-time 20 \
            "https://bidlock.firatkil.com/api/health?db=1" | tee /dev/stderr | grep -q '"db":"ok"'
```

This is the only scheduled traffic to production (NFR-31): one request every three days.

## 17. Docker

### 17.1 `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Used by the compose "migrate" service.
FROM deps AS tools
COPY . .
CMD ["pnpm", "tsx", "scripts/db/reset.ts", "--env", "load", "--no-pgtap"]

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_FEED=polling
ARG NEXT_PUBLIC_POLL_INTERVAL_MS=1000
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_REPO_URL=https://github.com/firatkill/bidlock
ENV NEXT_PUBLIC_FEED=$NEXT_PUBLIC_FEED NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_REPO_URL=$NEXT_PUBLIC_REPO_URL
RUN pnpm build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r -g 1001 app && useradd -r -u 1001 -g app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```

### 17.2 `docker/compose.yml`

```yaml
name: bidlock

services:
  db:
    build: ./postgres
    image: bidlock-postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bidlock
    command: ["postgres", "-c", "max_connections=200", "-c", "shared_buffers=256MB", "-c", "log_min_duration_statement=1000"]
    ports: ["54329:5432"]
    volumes:
      - ../db:/bidlock/db:ro
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      # -h 127.0.0.1: the init-time temporary server is socket-only, so this passes only once the real server is up
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d bidlock"]
      interval: 2s
      timeout: 3s
      retries: 30

  migrate:
    build:
      context: ..
      target: tools
    environment:
      DATABASE_URL_ADMIN: postgres://postgres:postgres@db:5432/bidlock_load
    depends_on:
      db:
        condition: service_healthy
    restart: "no"

  app:
    build:
      context: ..
      target: runner
      args:
        NEXT_PUBLIC_FEED: polling
        NEXT_PUBLIC_POLL_INTERVAL_MS: "1000"
    environment:
      APP_ENV: test
      DEMO_MODE: "on"
      DATABASE_URL: postgres://bidlock_app:bidlock_app@db:5432/bidlock_load
      DB_POOL_MAX: "20"
      APP_ORIGIN: http://app:3000
      TRUST_PROXY: none
      SESSION_SECRET: load-session-secret-0123456789abcdef0123
      BOT_TOKEN_SECRET: load-bot-secret-0123456789abcdef01234567
      IP_HASH_SALT: load-ip-salt-0123456789
      TEST_API_SECRET: load-test-secret
      LOG_LEVEL: warn
    ports: ["3000:3000"]
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully

  k6:
    image: grafana/k6:1          # pin the exact 1.x.y tag at implementation time
    profiles: ["load"]
    command: ["run", "/load/bid-storm.js"]     # entrypoint of the image is "k6"
    environment:
      BASE_URL: http://app:3000
      APP_ORIGIN: http://app:3000
      TEST_API_SECRET: load-test-secret
      VUS: ${VUS:-500}
      DURATION: ${DURATION:-60s}
      AUCTION_S: ${AUCTION_S:-45}
    volumes:
      - ../load:/load:ro
      - ../bench/out:/out
    depends_on:
      app:
        condition: service_healthy

volumes:
  pgdata:
```

`docker/postgres/Dockerfile`:

```dockerfile
FROM postgres:17
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-pgtap libtap-parser-sourcehandler-pgtap-perl \
 && rm -rf /var/lib/apt/lists/*
```

`docker/postgres/init/01-databases.sql`: `create database bidlock_test; create database bidlock_load;` (runs once on a new volume). Local dev uses `bidlock` (dev), `bidlock_test` (pgTAP, integration, e2e) and `bidlock_load` (k6, reset on every load run, so load runs never wipe dev data). `bidlock` and `bidlock_test` get `db/env/test.sql`; `bidlock_load` gets `db/env/load.sql`. `pnpm db:reset` resets the database named in `DATABASE_URL_ADMIN` (default `bidlock_test`); `pnpm db:reset --db bidlock` resets the dev database (§6.1).

The compose `app` service sets `APP_ORIGIN: http://app:3000`, which is the `Origin` k6 sends. A browser opened on `http://localhost:3000` against this container would fail the Origin check on POSTs; the container is for k6 only.

Log level `warn` in the load app container keeps request logs from becoming the bottleneck; `/api/health` stays at info.

## 18. Deployment

### 18.1 Environments

| Environment | App | Database | Feed | APP_ENV | settings.env |
|---|---|---|---|---|---|
| Local dev | `pnpm dev` | compose `db` → `bidlock` | polling 1 s | development | test |
| Local tests / CI | `pnpm start` (e2e) | `bidlock_test` / service container | polling 1 s | test | test |
| Load (CI, local) | compose `app` | compose `db` | polling 1 s | test | test |
| Production | Vercel Hobby | Supabase Free | broadcast (fallback polling 2 s) | production | prod |

No Vercel preview environment talks to the production database: preview deployments get `DEMO_MODE=off` (env var scoped to Preview), so they render the offline page.

### 18.2 Supabase setup (one time)

1. Create project `bidlock` in the region closest to the Vercel function region (`us-east-1` with Vercel `iad1`). Save the database password in a password manager.
2. Dashboard → Database → Extensions: enable `pg_cron`. (`pgcrypto` is not needed; `gen_random_uuid()` is core.)
3. Dashboard → Settings → API: make sure the exposed schemas are only `public` and `graphql_public` (never add `bidlock`).
4. Realtime settings: make sure public channels are allowed (the setting that restricts Realtime to private channels only must be off; its dashboard name may differ). Verify per A-01; if public database broadcasts do not arrive, take fallback (2) in §8.1.
5. Note the connection strings (Dashboard → Connect): direct (`db.<ref>.supabase.co:5432`), session pooler (`aws-0-<region>.pooler.supabase.com:5432`), transaction pooler (`…:6543`).

### 18.3 Migrations (manual, from the owner's machine)

```bash
export DATABASE_URL_ADMIN='postgres://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres?sslmode=require'
pnpm db:migrate --status
pnpm db:migrate
BIDLOCK_SQL_APP_PASSWORD='<generated 32-char password>' pnpm db:env supabase
pnpm db:cron
```

- Use the direct connection: migrations need session semantics (advisory lock, multi-statement transactions) and must not go through the transaction pooler. The Supabase free plan's direct host is IPv6-only; if the machine has no IPv6 route, use the session pooler URL (`postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432`), which is session mode and equivalent for migrations.
- Migrations are never run from CI or Vercel (no production credentials in GitHub).
- Order for a release with schema changes: migrate first (migrations are additive and backward compatible), then deploy the app.

### 18.4 Vercel setup

1. Import `firatkill/bidlock`, framework Next.js, Node.js 24.x, root directory `/`, install `pnpm install --frozen-lockfile`, build `pnpm build`.
2. Function region: Settings → Functions → region matching Supabase (`iad1`).
3. Env vars (Production scope):

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_URL` | `postgres://bidlock_app.<ref>:<app-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require` |
| `DB_POOL_MAX` | `3` |
| `SESSION_SECRET`, `BOT_TOKEN_SECRET`, `IP_HASH_SALT` | `openssl rand -base64 48` each |
| `DEMO_MODE` | `on` |
| `APP_ORIGIN` | `https://bidlock.firatkil.com` |
| `TRUST_PROXY` | `vercel` |
| `NEXT_PUBLIC_FEED` | `broadcast` |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `2000` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable/anon key |
| `NEXT_PUBLIC_REPO_URL` | `https://github.com/firatkill/bidlock` |

Preview scope: `DEMO_MODE=off`, `APP_ENV=production`, dummy secrets, no `DATABASE_URL` needed (offline page and health only; health reports `db: error` there, which is expected).

4. Domain: Settings → Domains → add `bidlock.firatkil.com`. At the DNS provider of `firatkil.com` create `CNAME bidlock → <target shown by Vercel>` (typically `cname.vercel-dns.com`; newer projects may show a project-specific target; use the value Vercel displays). Wait for the certificate to issue.
5. Smoke test: `curl -s https://bidlock.firatkil.com/api/health` → `db: "ok"`; open `/` in two browsers and bid.

### 18.5 Release procedure

1. CI green on `main`; latest bench PR merged.
2. If migrations changed: §18.3, including `pnpm db:env supabase` again after `pnpm db:migrate` (re-applies the Supabase revokes to new objects; idempotent).
3. Vercel deploys `main` automatically; verify `/api/health` `version` equals the commit SHA.
4. Manual checks in IMPLEMENTATION_PLAN "Release checklist".

### 18.6 Runbook: abuse

| Step | Action | Time to effect |
|---|---|---|
| 1 | Emergency stop without deploy: in Supabase SQL editor `update bidlock.settings set bidding_paused = true;` (bids and payments return `BIDDING_PAUSED`) | < 1 min |
| 2 | Read-only mode: Vercel → Env → `DEMO_MODE=readonly` → Redeploy latest | 2–5 min |
| 3 | Fully off: `DEMO_MODE=off` → Redeploy | 2–5 min |
| 4 | Purge sandboxes: `delete from bidlock.sandboxes;` (cascades) | immediate |
| 5 | Tighten limits: `update bidlock.rate_limits set max_hits = 1 where name = 'sandbox_ip_3600s';` etc. | immediate |
| 6 | Inspect: `select data->>'amount', bidder_id, at from bidlock.auction_events where at > now() - interval '10 min' order by id desc limit 100;` and Vercel logs filtered by `error_code` | |
| 7 | Restore: `bidding_paused = false`, `DEMO_MODE=on`, redeploy, reset limits to the values in 0008 | |

### 18.7 Runbook: paused database

Supabase pauses free projects after a period of inactivity (7 days at writing; A-05). Symptoms: `/api/health` returns 503 `db: "error"`; pages show load errors.

1. Supabase dashboard → project → "Restore project". Wait until status is healthy (typically a few minutes).
2. Verify `select bidlock.tick();` in the SQL editor and `cron.job` rows still active.
3. `curl https://bidlock.firatkil.com/api/health?db=1`.
4. Check why keepalive did not prevent it: Actions → keepalive history. GitHub disables scheduled workflows in public repositories after 60 days without repository activity; re-enable the workflow and merge the pending bench PR.

Honest alternative if pausing keeps happening: (a) Supabase Pro (paid, breaks NFR-30), or (b) accept pauses and state "The demo database may be paused; it restores on request" in the README, or (c) move Postgres to another free host and drop Broadcast (feed falls back to polling; pg_cron would then need `pnpm db:ticker` elsewhere). Option (b) is the documented default.

### 18.8 Secret rotation

Set `SESSION_SECRET_PREVIOUS` to the old value and `SESSION_SECRET` to a new one; redeploy; after 30 days remove `SESSION_SECRET_PREVIOUS`. Bot tokens and IP salt can be rotated at any time (tokens expire in 15 minutes; IP rotation only resets rate-limit buckets).

## 19. Cost model

The $0 figures are the plan prices at writing, not guarantees; every limit below is a value to look up and record at build time (A-04, A-05, A-06), and the README records the numbers with the date they were checked.

| Item | Plan | Monthly cost (at writing; verify) | Usage expectation | Limit to watch (verify A-04, A-05, A-06) |
|---|---|---|---|---|
| App hosting | Vercel Hobby | $0 | < 50k function invocations; broadcast avoids polling. Worst case on the polling fallback: one open room ≈ 1,800 state requests per hour at 2 s, so the fallback is what to watch | function invocations, active CPU, fast origin transfer, bandwidth; Hobby is limited to non-commercial use (verify the terms cover a personal portfolio demo) |
| Database, Realtime, cron | Supabase Free | $0 | < 50 MB data with nightly cleanup; < 100k realtime messages | database size (500 MB at writing), egress, Realtime concurrent connections and messages per month, number of free projects per account, pause after inactivity (A-05) |
| CI, load test, keepalive | GitHub Actions, public repo | $0 | ~10 CI runs/week × ~10 min, 1 load run/week × ~10 min | standard GitHub-hosted runners are free for public repositories at writing (verify); scheduled workflows are disabled after 60 days without repository activity |
| DNS | existing `firatkil.com` zone | $0 (domain already owned) | 1 CNAME | |
| Error tracking, analytics | none | $0 | logs only | |
| Total | | $0 | | |

Load on production is limited by design: no k6 against production (NFR-31), rate limits per bidder and IP, 50-sandbox cap, bots run in visitors' browsers and are rate limited like humans.

## 20. Performance notes and trade-offs

- Throughput per auction is bounded by lock hold time. `place_bid` holds the lock for one function execution (several index lookups and 3–5 inserts/updates, typically well under 2 ms on the CI runner), so one auction can serialize several hundred bids per second. Different auctions never contend.
- The per-IP rate counter is a second hot row during the load test (all VUs share one IP). It is held only for the `check_bid_rate` statement.
- The app pool (`DB_POOL_MAX=20` in compose) bounds concurrent transactions; excess requests queue in postgres.js, which is visible as latency rather than errors.
- In production, `realtime.send` runs inside the bid transaction (while the lock is held). The benchmark runs with `realtime_mode = 'none'`, so it does not measure Broadcast fan-out; `/how-it-works` states this.
- Read paths never take the auction lock unless a transition is due, and then with `SKIP LOCKED`.

## 21. Assumptions to verify at build time

Each assumption has an owner task. If verification fails, apply the stated fallback and log it in PRD §14.

| ID | Assumption | How to verify | Fallback | Task |
|---|---|---|---|---|
| A-01 | Supabase provides `realtime.send(payload jsonb, event text, topic text, private boolean)` and delivers database broadcasts to public channels on the free plan | In the Supabase SQL editor: `select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'realtime' and p.proname = 'send';` then subscribe from a browser console with supabase-js to `auction:test` (public channel, anon/publishable key) and run `select realtime.send('{"x":1}'::jsonb, 'auction_changed', 'auction:test', false);` as `postgres`, also from inside a `security definer` function owned by `postgres` (the trigger's context). Check that the message arrives and that `_publish_auction` raised no warning | Adjust argument order in `_publish_auction`; if public delivery fails, §8.1 fallback (2) private channel + RLS policy on `realtime.messages`; then §8.2 Postgres Changes; then polling | T-45 |
| A-02 | Supavisor accepts custom roles (`bidlock_app.<ref>`) in transaction mode | `psql "postgres://bidlock_app.<ref>:<pw>@<pooler>:6543/postgres" -c "select current_user"` returns `bidlock_app` | Use the `postgres` role in `DATABASE_URL`; keep `SECURITY DEFINER` functions; record that table privileges are not enforced at the role level in prod | T-45 |
| A-03 | pg_cron is available on Supabase Free, `cron.schedule(name, …)` upserts by name, jobs run in database `postgres` | Enable extension; run `db/env/supabase-cron.sql` twice; `select count(*) from cron.job where jobname like 'bidlock-%'` = 4 | Use `cron.unschedule(name)` before `cron.schedule`; if pg_cron is missing, rely on lazy transitions and a GitHub Action every 5 minutes calling a protected `POST /api/tick` (only then add that endpoint) | T-45 |
| A-04 | Vercel Hobby limits (function invocations, duration, CPU, bandwidth) are sufficient | Read https://vercel.com/docs/limits and https://vercel.com/pricing on the implementation date; record numbers in README | Increase polling interval, keep Broadcast mandatory | T-46 |
| A-05 | Supabase free projects pause after 7 days without activity and a database query made through the pooler (the keepalive's `/api/health?db=1`) counts as activity; whether the every-minute pg_cron job counts is unknown and must not be relied on | Read https://supabase.com/docs/guides/platform/billing-on-supabase and the pricing page on the implementation date; after deploy, confirm the project is still active after more than 7 days with only keepalive traffic | Shorten keepalive schedule; document runbook §18.7 | T-46 |
| A-06 | Supabase free limits: 500 MB database, Realtime connection and message quotas | Supabase pricing page and Dashboard → Usage | Shorter retention in `cleanup_expired` | T-45 |
| A-07 | `postgres:17` image has the PGDG apt repository so `postgresql-17-pgtap` installs with apt | `docker run --rm postgres:17 bash -c "apt-get update -qq && apt-cache policy postgresql-17-pgtap"` shows a candidate | Build `docker/postgres/Dockerfile` in CI and run it with `docker run` instead of a service container | T-05 |
| A-08 | Playwright project-level `workers` is supported (≥ 1.52) | `pnpm exec playwright --version`; config type-checks | Two invocations as noted in §15.5 | T-33 |
| A-09 | `GITHUB_TOKEN` can open PRs after enabling the repository setting | Run `load` via workflow_dispatch once | Push to branch `bench/results` without a PR and open it manually | T-43 |
| A-10 | Next.js major in use: middleware file name (`proxy.ts` in 16, `middleware.ts` in 15) and its default runtime (Node in 16), `"use cache"` vs `unstable_cache`, async `params`; Next reads the CSP nonce from the forwarded request's `content-security-policy` header (§13.4); `next start` serves an `output: "standalone"` build (it may only warn); whether `next build` (Turbopack default in 16) emits `app-build-manifest.json` | `pnpm view next version`; Next upgrade guide and CSP guide for that major; `pnpm build && pnpm start` then load `/` with the CSP on and check the console for blocked scripts; `ls .next/app-build-manifest.json` | Use the names that version requires; if `next start` refuses standalone, the e2e `webServer.command` becomes `node .next/standalone/server.js` after copying `.next/static` and `public` into `.next/standalone` (with `PORT=3100 HOSTNAME=127.0.0.1`); if the manifest is missing, E2E-09 enforces NFR-15 (D-33) | T-01, T-25, T-33 |
| A-11 | `jslib.k6.io` modules (k6-utils 1.4.0, k6-summary 0.1.0) are reachable from GitHub runners | First load run | Vendor the two small modules into `load/lib/` | T-40 |
| A-12 | Vercel sets `x-forwarded-for` to the real client IP and strips client-supplied values | Vercel docs "Request headers"; log a hashed value from two networks | Use `x-real-ip` | T-46 |
