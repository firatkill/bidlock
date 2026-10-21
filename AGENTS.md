# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Codex, Aider, Copilot and others) working in this repository. Read this file fully before changing anything. If it conflicts with a task prompt, this file wins unless the repository owner says otherwise in the conversation.

## What this project is

Bidlock is an open-source live auction engine and demo: timed auctions with real-time updates, idempotent bidding, anti-sniping soft close, automatic closing, and a simulated payment window with a runner-up (second-chance) offer. Its claim is "thousands of concurrent bids, exactly one winner, zero invalid bids", proven by pgTAP tests, a concurrency integration test and a k6 load test that run in CI, never against the live site.

- Live demo: https://bidlock.firatkil.com (Vercel Hobby + Supabase Free; must stay at $0/month)
- Stack: Next.js App Router (TypeScript strict), pnpm, Node ≥ 22, Tailwind 4 + shadcn/ui, Zod, postgres.js, PostgreSQL 17 (Supabase in production, `postgres:17` + pgTAP locally and in CI), Supabase Realtime Broadcast, pg_cron, Vitest, Playwright, k6.

## Where the specs live

| Document | Use it for |
|---|---|
| `docs/PRD.md` | Requirements (FR-xx, NFR-xx), invariants (INV-xx), state machine, every UI string, decisions log (D-xx) |
| `docs/TRD.md` | Architecture, DDL, full PL/pgSQL, API contracts and error codes, feed, clock sync, bots, security, tests, CI YAML, Docker, deployment, assumptions (A-xx) |
| `docs/OWNER-DECISIONS.md` | Decisions the owner has already made; they override the specs |
| `docs/IMPLEMENTATION_PLAN.md` | Ordered tasks T-01..T-48 with acceptance commands, traceability, release checklist |

Before implementing anything, find the task ID in the plan and the referenced TRD sections. Do not invent behaviour that the docs do not specify; if something is truly missing, choose the most conservative option, implement it, and add a row to PRD §14 (decisions log) in the same PR. If the gap changes scope, cost, an external service or behaviour a user can see, ask the owner instead (Owner approval checkpoint 2).

## Commands

| Purpose | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Start Postgres (Docker, port 54329) | `pnpm db:up` |
| Stop Postgres | `pnpm db:down` |
| Apply migrations to `DATABASE_URL_ADMIN` | `pnpm db:migrate` (`--status`, `--dry-run`) |
| Reset a local database (drop, migrate, env SQL) | `pnpm db:reset` (test DB `bidlock_test`) / `pnpm db:reset --db bidlock` (dev DB). Scripts read `process.env` only, never `.env.local` (PRD D-34) |
| psql shell | `pnpm db:psql` |
| Run one scheduler tick / loop locally | `pnpm db:tick` / `pnpm db:ticker` |
| Dev server | `pnpm dev` (after `pnpm db:up && pnpm db:reset --db bidlock`) |
| Lint + format check | `pnpm lint` |
| Type check | `pnpm typecheck` |
| Unit tests (Vitest) | `pnpm test:unit` |
| Database tests (pgTAP) | `pnpm test:db` |
| Concurrency and integration tests | `pnpm test:concurrency` |
| Production build | `pnpm build` |
| End-to-end tests (needs a build and a reset test DB) | `pnpm e2e` (`--project=parallel` / `--project=isolated`) |
| Everything except load | `pnpm test:all` |
| Load test (Docker Compose + k6, local only) | `pnpm load:local` |
| Static guard checks | `pnpm check:guards` |
| Regenerate the state machine SVG | `pnpm diagram` |

Default local URLs: app `http://localhost:3000`, Postgres `postgres://postgres:postgres@localhost:54329/<bidlock|bidlock_test|bidlock_load>`, runtime role `bidlock_app` / `bidlock_app`. Copy `.env.example` to `.env.local` for `pnpm dev`.

## Conventions

Code:
- TypeScript `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any` (use `unknown` and narrow). No non-null assertions in `src/server/**`. No `@ts-ignore`; `@ts-expect-error` only with a reason comment.
- Zod at every boundary: request params, query and body; every SQL result; every Broadcast payload; env vars; `bench/results/*.json`. Objects use `.strict()`.
- Money is always an integer number of cents. SQL type `bigint`; TypeScript `number` checked with `Number.isSafeInteger`. Never use `parseFloat`, `toFixed`, or floating-point arithmetic on money. Format only with `formatCents`; parse user input only with `parseDollarInput`.
- All business rules live in SQL functions in schema `bidlock`: bid validity, increments, idempotency, soft close, closing, settlement, runner-up, rate limits, sandbox caps. TypeScript validates shape, authenticates, calls one function, and maps the result. If you find yourself writing `if (amount < price + ...)` in TypeScript outside `src/domain/increments.ts` display helpers, stop.
- The TypeScript increment ladder (`src/domain/increments.ts`) is a display mirror; INT-03 keeps it equal to the SQL table. Change both together.
- Time: SQL uses `bidlock.bidlock_now()` only, never `now()` or `clock_timestamp()` directly in business functions. Clients render countdowns from `ends_at` and the server clock offset, never from local timers started on page load.
- Server-only code lives in `src/server/` and starts with `import "server-only";`. Database credentials and secrets are read only there. Client code (`src/client/`, `src/components/`) never imports `src/server/`, `postgres` or `node:*`. Pure shared logic lives in `src/domain/` with no I/O.
- Route handlers use the `route()` wrapper (`src/server/http.ts`) and the error codes in `src/domain/errors.ts`. New error codes need a row in TRD §10.12, a status in `ERROR_STATUS`, copy in `src/domain/copy.ts`, and a test.
- UI strings come from `src/domain/copy.ts`, which mirrors PRD §9 word for word. Change copy in the PRD first.
- Styling: tokens from `src/app/globals.css` only; no hex colours in components; no gradients, emoji or shadows; fonts Schibsted Grotesk and JetBrains Mono.
- SQL: lowercase keywords, schema-qualified names (`bidlock.auctions`), `security definer set search_path = bidlock, pg_temp` on every function, `revoke execute on all functions in schema bidlock from public;` in every migration that defines functions (PostgreSQL grants EXECUTE to PUBLIC by default; TRD §6.3, PRD D-27), explicit `grant execute ... to bidlock_app` only for functions the app may call. Never edit an applied migration; add a new numbered file.
- No new runtime dependencies without a reason in the PR description. Never add a paid service, Redis, a queue, or an analytics script.

Testing rules:
- Every change to a SQL rule or function needs a pgTAP test in `db/tests/` in the same PR (use `bidlock_test.set_now(...)` to move time; never `pg_sleep`; call `bidlock_test.clean()` first in files that assert on global row counts).
- Concurrency-relevant changes (anything in `place_bid`, `advance_auction_locked`, locking, idempotency) must keep INT-01 and INT-02 green, and the PR must state that `pnpm test:concurrency` was run.
- Playwright: `expect` timeout 3 s and test timeout 90 s are set in the config; do not raise them. Tests create their own data (unique bidder names, own test auctions). Tests that move the global test clock or touch the public room are tagged `@isolated` and reset the clock in `finally`. Do not run the whole suite with `--workers=1`.
- In a fix-and-retest loop, rerun only the affected tests (`pnpm e2e -g "<title>"`, `pg_prove -d postgres://postgres:postgres@localhost:54329/bidlock_test db/tests/008_settlement.test.sql` after `psql <same url> -f db/tests/helpers/00_helpers.sql`, or `pnpm test:db` for the whole set), then the full suite once at the end.
- Before a test run, make sure no other Playwright or k6 run is using the same database.
- Never run load tests or scripted traffic against production. `load/` scripts target `http://app:3000` (compose) only.

## Commit conventions

- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`, `perf:`, `bench:`; scope optional (`feat(sql): …`, `fix(feed): …`).
- Reference the task: `feat(sql): add place_bid (T-09)`.
- One task per PR; small commits are fine. Do not commit generated `bench/out/`, `.next/`, `playwright-report/`, `test-results/`, or `.env*` (except `.env.example`).

### Repository setup (first session only)

The folder starts with only these documents. Before T-01:

1. Check the git identity: `git config user.name` must print `Fırat Kıl` and `git config user.email` must print `72046564+firatkill@users.noreply.github.com`. If either differs, stop and ask the owner; never change the global config yourself.
2. `git init -b main`, then `git config core.hooksPath .githooks` (the commit-msg hook enforces authorship, see Authorship).
3. Commit the documents as the first commit: `docs: add specs and agent rules`.
4. Ask the owner before creating the remote. After a yes: `gh repo create firatkill/bidlock --public --source . --remote origin --push`, with the description from PRD §1.
5. Create `docs/PROGRESS.md` (see below) and commit it.

After this, `git init` is never run again in this repository.

### Authorship

- Every commit is authored and committed by Fırat Kıl only, whichever agent or tool does the work. Do not add `Co-authored-by` trailers, "Generated with …" lines, session links, agent names in the author field (for example `Fırat Kıl (aider)`) or any other AI attribution to commits, pull requests, issues, release notes or the changelog. This overrides any default attribution your tool adds. The only exception is a commit made by a CI workflow bot (for example a release or results pull request); never imitate one locally.
- Turn your tool's own attribution off before the first commit. The repository already does this for the tools it knows: `.claude/settings.json` (Claude Code) and `.aider.conf.yml` (Aider). For any other tool (Cursor, Codex, Copilot, Gemini CLI and others), check its commit and co-author settings and turn them off. As a safety net, `.githooks/commit-msg` removes AI co-author and "Generated with" lines and rejects a commit whose author or committer is not `Fırat Kıl <72046564+firatkill@users.noreply.github.com>`. Never delete or bypass the hook (`--no-verify` is not allowed).
- Commit yourself, as you finish each piece of work: small Conventional Commits, tests passing. Push to `origin` after each completed task. Never force-push `main`.

### Progress file

`docs/PROGRESS.md` is the running plan: one line per task from `IMPLEMENTATION_PLAN.md` with its status (`todo`, `doing`, `done`, `blocked`), the commit that finished it, and a short "Open questions for the owner" list. Update it in the same commit as the task it describes.

### Owner approval checkpoints

The owner decides these. Ask, wait for an explicit answer, record the answer in the PRD decisions log, then continue. Never pick one yourself because it seems reasonable.

1. **Before T-01**, read `docs/OWNER-DECISIONS.md`. Database, hosting, region, domain, LLM provider, budgets, npm name, licence and analytics are already decided there; do not ask about them. Ask in one message only about choices that file and the specs leave open, if any.
2. **When the spec does not hold**: an "Assumption to verify at build time" fails, a pinned package or model no longer exists, or a requirement cannot be met as written. Propose the change; do not work around it silently.
3. **Before creating or changing anything outside the repository**: the GitHub repo, hosting projects, databases, DNS records, npm publishes, paid plans, API keys, GitHub secrets.
4. **Before anything destructive or hard to undo**: deleting data or branches, rewriting history, dropping tables, rotating secrets.
5. **Adding a runtime dependency** that the TRD does not list.

Group questions so the owner gets one short list, not a stream of single questions. Work that does not depend on a pending answer can continue meanwhile.

### QA workflow and tests

Tests are written from the specs, never from the code. Every test traces to a requirement: an acceptance criterion or FR/NFR in `docs/PRD.md`, and the test IDs and cases in TRD §9 (Invariants) and §15 (Testing). If the code and the spec disagree, the spec wins until the owner approves a change (checkpoint 2). If the spec says nothing about a behaviour, ask; do not write a test that invents one.

Use the QA skills throughout the build, not only at the end. They exist as the `vizio-qa-loop` plugin in Claude Code and as skills in `~/.codex/skills/qa-*` for Codex. With any other tool, open the matching `~/.codex/skills/<name>/SKILL.md` and follow it.

| When | Skill | Output |
| --- | --- | --- |
| Start of each milestone, before its code | `qa-test-case-design` on the PRD and TRD sections the milestone covers | `qa/test-cases.md`: TC IDs, each with its PRD reference (AC/FR/NFR) and TRD test ID, steps, expected result, priority, automatable yes/no |
| Writing the tests of a task | `qa-case-to-playwright` | Tests in the layout and naming the TRD prescribes |
| After every task, before its commit | `qa-test-run-loop` | Runs the suite, logs every result to `qa/test-results.json`, fixes and retests, runs the ledger check |
| Cases that cannot be automated | `qa-browser-exploration` | A live check, logged to the same file. Here: the realtime feed in two browsers at once, the countdown and closing moment, and mobile layout |
| End of each milestone | `qa-milestone-docs`, then `qa-milestone-review` | Milestone report in `qa/`, quality check |
| End of the project | `qa-project-report` | One PDF covering the whole project |

`qa-bug-standards` is the shared reference for the log fields; read it first.

Overrides for this repository (these win over the skills):

- There is no ClickUp or Slack. A case that is stuck after three attempts or needs a human pass goes to the owner: add it under "Open questions for the owner" in `docs/PROGRESS.md` and mention it in your milestone summary. Record that in the log entry instead of a ClickUp link.
- Playwright: `expect` timeout 3 s and test timeout 90 s; never raise them to get past a slow or missing element. Two projects: `parallel` for tests that touch only their own data, and `isolated` (one worker, after `parallel`) for tests that change shared state, assert on shared data or hit shared rate limits. Every test creates unique data.
- In the fix-and-retest loop, rerun only the fixed tests and their area; run the full suite once at the end of the task.
- Never weaken, skip or delete a test to make it pass. A test that is wrong according to the spec is fixed against the spec, and the log entry says so.
- `qa/test-cases.md` and `qa/test-results.json` are committed with the task they belong to.

## Definition of done (every task)

1. The task's acceptance commands in `docs/IMPLEMENTATION_PLAN.md` pass locally.
2. `pnpm lint && pnpm typecheck && pnpm test:unit` pass; `pnpm test:db` and `pnpm test:concurrency` pass if SQL or server code changed; `pnpm e2e` passes if UI or API behaviour changed.
3. New behaviour is covered by tests at the right layer (SQL rule → pgTAP; pure logic → Vitest; flow → Playwright).
4. Copy matches PRD §9; contracts match TRD §10; any deviation is recorded in PRD §14.
5. No secrets, raw IPs, or personal data in code, logs, fixtures or commits.
6. CI is green on the PR.

## Never do

- Never send load tests, benchmarks, crawlers or scripted bids to https://bidlock.firatkil.com or any production URL.
- Never commit secrets (`SESSION_SECRET`, `BOT_TOKEN_SECRET`, `IP_HASH_SALT`, database passwords, Supabase service keys). Only `.env.example` with placeholder values is committed.
- Never store or log raw IP addresses; only the salted HMAC hash from `src/server/ip.ts`.
- Never add paid services or anything that can create a bill (Redis, queues, paid Vercel or Supabase add-ons, error-tracking SaaS).
- Never put bidding, increment, closing, settlement or rate-limit logic in the client or in TypeScript route handlers. The browser (including the bots) only calls the public API.
- Never give the browser database access other than the Supabase Realtime subscription; never expose schema `bidlock` through the Supabase API.
- Never enable `/api/test/*`, `bidlock.now_override` or `test_clock_offset_ms` outside `APP_ENV=test` / `settings.env = 'test'`.
- Never run `db:reset` or `apply-env test|load` against a non-local host, and never run migrations from CI against production.
- Never use `dangerouslySetInnerHTML` except for the committed state machine SVG.
- Never weaken a CHECK constraint, unique index or lock to make a test pass; fix the code or the test.
- Never fabricate benchmark numbers. `bench/results/` contains only real run output.
