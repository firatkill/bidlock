# Bidlock

A live auction engine that stays correct under load.

Implementation is in progress; no benchmark claims have been measured yet.

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
