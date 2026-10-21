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

`pnpm install --frozen-lockfile`, then `pnpm dev`. Database setup arrives in T-03/T-04.

## Verification

`pnpm lint && pnpm typecheck && pnpm test:unit && pnpm check:guards && pnpm build`. Other scripts fail explicitly until implemented.

## Decisions

Frankfurt deployment; no analytics; load tests execute in CI only. See [owner decisions](docs/OWNER-DECISIONS.md), [plan](docs/IMPLEMENTATION_PLAN.md) and [progress](docs/PROGRESS.md).

MIT — Fırat Kıl.
