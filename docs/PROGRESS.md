# Progress

Updated: 2026-10-21.

## Repository setup

- Local repository initialized on `main`; required Git identity verified.
- Commit hook enabled at `.githooks`; executable and syntax checked. Attribution removal and author/committer rejection checks passed.
- Initial specifications committed as `9ec3283` (`docs: add specs and agent rules`).
- Commits use Git directly with explicit messages and no attribution trailers; existing Claude/Aider attribution settings retained.
- GitHub creation, remote configuration and pushes approved (D-44); CI will be verified per task.
- All five project documents read before setup. Owner decisions override conflicting deployment-region and load-run instructions (PRD D-42/D-43).
- No implementation task or milestone is complete. M0 test cases will be designed from the specs before T-01 code.

## Tasks

A finishing commit is recorded only when acceptance checks, including required CI, pass.

| Task | Goal | Status | Finishing commit |
|---|---|---|---|
| T-01 | Repository, tooling and CI skeleton | todo | — |
| T-02 | Env module, logger, server-only boundaries | todo | — |
| T-03 | Postgres image and compose database | todo | — |
| T-04 | Migration runner, reset and env SQL | todo | — |
| T-05 | Foundation migration and pgTAP harness | todo | — |
| T-06 | Core tables, constraints, indexes | todo | — |
| T-07 | Increment ladder | todo | — |
| T-08 | Lifecycle internals | todo | — |
| T-09 | place_bid | todo | — |
| T-10 | pgTAP: bid rules and idempotency | todo | — |
| T-11 | pgTAP: soft close | todo | — |
| T-12 | Scheduler path and closing tests | todo | — |
| T-13 | Settlement | todo | — |
| T-14 | Rate limiter | todo | — |
| T-15 | Read and identity functions | todo | — |
| T-16 | Sandboxes, cleanup, test support, realtime trigger | todo | — |
| T-17 | Concurrency integration tests | todo | — |
| T-18 | DB client and repo layer | todo | — |
| T-19 | HTTP wrapper, Origin check, demo mode gate | todo | — |
| T-20 | Session cookie, names, /api/me | todo | — |
| T-21 | IP hashing and rate-limit integration | todo | — |
| T-22 | Read endpoints | todo | — |
| T-23 | Mutating endpoints: bids and pay | todo | — |
| T-24 | Test-only endpoints and health | todo | — |
| T-25 | Security headers and CSP | todo | — |
| T-26 | Design tokens, shell and name dialog | todo | — |
| T-27 | Client domain utilities | todo | — |
| T-28 | AuctionFeed interface and PollingFeed | todo | — |
| T-29 | Auction room: read-only parts | todo | — |
| T-30 | Bid panel and bid history | todo | — |
| T-31 | SupabaseBroadcastFeed | todo | — |
| T-32 | Lobby | todo | — |
| T-33 | Playwright harness, two-bidder e2e, CI e2e job | todo | — |
| T-34 | Sandbox and bot-token endpoints | todo | — |
| T-35 | Bot scheduler and runner | todo | — |
| T-36 | Sandbox UI and e2e | todo | — |
| T-37 | Result panel, payment and runner-up UI | todo | — |
| T-38 | Extension banner and public room e2e | todo | — |
| T-39 | App image and full compose | todo | — |
| T-40 | k6 bid-storm script | todo | — |
| T-41 | Invariant verification | todo | — |
| T-42 | Bench report and headline data | todo | — |
| T-43 | Load workflow | todo | — |
| T-44 | How it works page | todo | — |
| T-45 | Supabase production setup | todo | — |
| T-46 | Vercel deploy, DNS, keepalive | todo | — |
| T-47 | Polish pass | todo | — |
| T-48 | README, demo GIF, release | todo | — |

## Open questions for the owner

None. GitHub creation and the isolated local Docker database lifecycle approved on 2026-10-21 (D-44/D-45).

## Verification limits

- Setup checks only; there is no application, package manifest, test suite or CI workflow yet.
- Local k6 execution is excluded by OWNER-DECISIONS; M6 acceptance must use CI runs (D-43).
- Stop for an owner summary at the end of every milestone.
