# Bidlock

A live auction engine that stays correct under load.

Implementation is in progress. The [first published benchmark](bench/SUMMARY.md) records p95 269.23 ms against the 250 ms target, p99 329.69 ms against 600 ms, zero unexpected errors and zero invariant violations. NFR-10 p95 remains an owner-accepted gap (D-92); thresholds are unchanged and `thresholds.passed=false`.

## Stack

Resolved 2026-10-21 from the package registry, using the specified major lines where the TRD constrains them.

| Package                     | Version |
| --------------------------- | ------- |
| next                        | 16.4.2  |
| react                       | 19.3.1  |
| react-dom                   | 19.3.1  |
| zod                         | 4.6.7   |
| postgres                    | 3.4.9   |
| @supabase/supabase-js       | 2.118.0 |
| server-only                 | 0.0.1   |
| sonner                      | 2.0.8   |
| @radix-ui/react-slot        | 1.5.0   |
| @radix-ui/react-dialog      | 1.3.1   |
| class-variance-authority    | 0.7.1   |
| clsx                        | 2.1.1   |
| tailwind-merge              | 3.7.0   |
| lucide-react                | 1.61.0  |
| typescript                  | 5.9.3   |
| @types/node                 | 26.6.5  |
| @types/react                | 19.3.0  |
| @types/react-dom            | 19.3.0  |
| tailwindcss                 | 4.3.3   |
| @tailwindcss/postcss        | 4.3.3   |
| eslint@9                    | 9.39.5  |
| eslint-config-next          | 16.4.2  |
| typescript-eslint@8         | 8.72.0  |
| prettier                    | 3.9.10  |
| vitest                      | 4.1.12  |
| @vitest/coverage-v8         | 4.1.12  |
| @testing-library/react      | 16.3.3  |
| @testing-library/user-event | 14.6.8  |
| jsdom                       | 30.1.3  |
| tsx                         | 4.23.15 |
| shadcn                      | 3.8.5   |
| @playwright/test            | 1.64.1  |
| @axe-core/playwright        | 4.14.0  |
| @mermaid-js/mermaid-cli     | 11.17.0 |
| pnpm@10                     | 10.34.7 |

Node: 24 (minimum 22). Next 16 uses `src/proxy.ts` rather than `middleware.ts` (A-10); CSP and standalone serving are verified in T-25/T-33. See [Next upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

## Development

`pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm db:up` and `pnpm db:reset --db bidlock` first; copy `.env.example` to `.env.local` for the dev server.

## Verification

`pnpm lint && pnpm typecheck && pnpm test:unit && pnpm check:guards && pnpm build`. Other scripts fail explicitly until implemented.

## Decisions

Frankfurt deployment; no analytics; load tests execute in CI only. See [owner decisions](docs/OWNER-DECISIONS.md), [plan](docs/IMPLEMENTATION_PLAN.md) and [progress](docs/PROGRESS.md).

MIT — Fırat Kıl.

## Local PostgreSQL

`pnpm db:up` starts the project database on port 54329. `pnpm db:down` stops it without deleting its volume. The image is pinned to `postgres:17.11`, the current 17.x minor on 2026-10-21 ([PostgreSQL versioning](https://www.postgresql.org/support/versioning/)). It creates `bidlock`, `bidlock_test`, and `bidlock_load`; migration and reset tooling is available. Auction schema migrations begin in M1.

A-07 verified locally on 2026-10-21: the official image installs `postgresql-17-pgtap` (1.3.4) and provides `/usr/bin/pg_prove`. The database-tooling CI job repeats the availability checks.

## Database scripts

Scripts read `process.env` only, never `.env.local`. `DATABASE_URL_ADMIN` defaults to the local `bidlock_test` database. Use `pnpm db:migrate --status` or `--dry-run` to inspect migration state. `pnpm db:reset` resets test data; `pnpm db:reset --db bidlock` targets the dev database. Reset refuses non-local hosts. `pnpm test:concurrency` currently runs the eight migration-tooling cases against a disposable `bidlock_migrate_test`; auction concurrency tests arrive in M1.

At M0 there are no auction migrations: reset warns and skips environment SQL until `bidlock.settings` exists. The committed production environment and cron SQL are not executed locally. The ticker needs the later `bidlock.tick()` function. pgTAP rule tests, e2e and load scripts remain unavailable until their owning tasks.

## Deployment notes

Recorded 2026-11-08. Production observations below were supplied by the owner/reviewer, not rerun by the recording agent. No production scripts or load tests were run.

- Supabase project `ufnpdyrpsxjaiyrsdqlz`: Free, Frankfurt `eu-central-1`, PostgreSQL 17.11 (64-bit; `server_version_num=170011`), pg_cron enabled. Only `public` and `graphql_public` are exposed; public Realtime channels allowed. Settings: `prod | broadcast | 0`.
- Migrations 0001–0014 applied. The owner's IPv6-only direct host was unreachable; migrations used the documented session-pooler fallback. `db:env supabase` and `db:cron` (twice) succeeded.
- **A-02 passed:** transaction pooler port 6543 with `bidlock_app.<ref>` returned `current_user=bidlock_app`.
- **A-03 passed:** exactly four active jobs (`bidlock-cleanup`, `bidlock-cron-log-gc`, `bidlock-rate-gc`, `bidlock-tick`); run details show `succeeded`.
- **A-01 passed:** supabase-js 2.118.0 and the publishable key subscribed to public `auction:test`. Direct `realtime.send(…, false)` delivered `{"x":1}` at 12:35:49Z; a postgres-owned security-definer pg_temp probe delivered `{"x":2}` at 12:36:17Z. No fallback needed.
- Vercel Hobby, Node 24.x: `bidlock-tawny.vercel.app`, custom domain `bidlock.firatkil.com`, valid HTTPS. DNS CNAME `bidlock` → `96628b3a8b6951b4.vercel-dns-017.com.`. After correcting the function region and redeploying, `x-vercel-id` was `fra1::fra1::…` (previously `fra1::iad1`).
- Health returned `{"status":"ok","db":"ok","demo_mode":"on","version":"84c53edcabe553f8e027cf6bd2a0a222c05bd169"}`, matching origin/main at deployment. [Keepalive dispatch](https://github.com/firatkill/bidlock/actions/runs/42482100743) passed.
- Manual two-network Broadcast, public lot 0006: phone on mobile data bid $12.00 at server time 12:58:27.783Z; desktop on home broadband rendered it at 12:58:27.944Z (**161 ms**). Owner confirmed the desktop's $11.00 bid appeared on the phone (reverse latency not measured). Desktop made no requests during 10 idle seconds. No scripted bids.
- **D-96:** no Preview environment. Ignored Build Step is `[ "$VERCEL_GIT_COMMIT_REF" != "main" ]`; only main builds. `DATABASE_URL`, `SESSION_SECRET`, `BOT_TOKEN_SECRET`, `IP_HASH_SALT` are Production-only.

Public documentation checked **2026-11-08**, without login:

| Assumption | Published allowance / contract                                                                                                                                                                                                                                                                                       | Source                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A-04       | Hobby $0/month; monthly included 1,000,000 function invocations, 4 active CPU-hours, 360 GB-hours provisioned memory, 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer and 1,000,000 CDN requests.                                                                                                              | [Pricing](https://vercel.com/pricing), [Hobby](https://vercel.com/docs/plans/hobby)                        |
| A-04       | Fluid Compute Hobby function duration default/max 300 s; 2 GB memory / 1 vCPU. 100 deployments/day. These are published limits, not measured usage or a capacity guarantee.                                                                                                                                          | [Function limits](https://vercel.com/docs/functions/limitations), [limits](https://vercel.com/docs/limits) |
| A-06       | Free $0/month: 500 MB database, 5 GB egress plus 5 GB cached egress, 1 GB storage, 200 peak Realtime connections, 2 million messages/month, 256 KB message size.                                                                                                                                                     | [Supabase pricing](https://supabase.com/pricing)                                                           |
| A-06       | Free Realtime: 100 messages/s, 100 channel joins/s, 100 channels/connection, 256 KB Broadcast payload. Actual project usage has not been recorded; owner must capture dated database size, peak connections, messages and egress from Usage.                                                                         | [Realtime limits](https://supabase.com/docs/guides/realtime/limits)                                        |
| A-12       | Vercel documents x-forwarded-for as the client's public IP; it overwrites incoming X-Forwarded-For and does not forward external IP values to prevent spoofing. Custom trusted-proxy forwarding is an Enterprise feature. Documentation supports the trust contract; distinct runtime salted keys remain unverified. | [Request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for)                         |

**Open follow-ups:** A-05 stays open until after **2026-11-15**: verify more than seven days of activity with only keepalive traffic (restart the observation window if manual traffic intervenes). Supabase publishes pausing after one inactive week; a successful initial query or cron is not proof that keepalive prevents pausing. A-04 actual dashboard usage and A-06 actual usage remain unrecorded; no capacity claim is made.

For **A-12**, next time the owner and reviewer each place one ordinary manual bid from mobile data/home broadband, inspect `bidlock.rate_counters` entries for `bid_ip_60s` immediately, within the 60-second window. Correlate each counter update with bid timing and confirm two distinct salted keys; record only time, count and distinctness, never raw IPs, secrets or full hashes. The previous counters expired before inspection. No scripted production bidding or spoofing test is authorized.
