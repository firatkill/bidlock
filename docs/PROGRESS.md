# Progress

Updated: 2026-10-21.

## Repository setup

- Local repository initialized on `main`; required Git identity verified.
- Commit hook enabled at `.githooks`; executable and syntax checked. Attribution removal and author/committer rejection checks passed.
- Initial specifications committed as `9ec3283` (`docs: add specs and agent rules`).
- Commits use Git directly with explicit messages and no attribution trailers; existing Claude/Aider attribution settings retained.
- GitHub creation, remote configuration and pushes approved (D-44); CI will be verified per task.
- All five project documents read before setup. Owner decisions override conflicting deployment-region and load-run instructions (PRD D-42/D-43).
- M0 (T-01–T-04) is complete. All four task PRs passed CI before merge. Owner approved continuing into M1. T-05 specification review found an environment SQL dependency conflict; owner approved the correction (D-46).

## Tasks

A finishing commit is recorded only when acceptance checks, including required CI, pass.

| Task | Goal                                               | Status | Finishing commit |
| ---- | -------------------------------------------------- | ------ | ---------------- |
| T-01 | Repository, tooling and CI skeleton                | done   | b90ffd4          |
| T-02 | Env module, logger, server-only boundaries         | done   | cd4606f          |
| T-03 | Postgres image and compose database                | done   | 03ee16b          |
| T-04 | Migration runner, reset and env SQL                | done   | b2b1c27          |
| T-05 | Foundation migration and pgTAP harness             | done   | cd1bd5d          |
| T-06 | Core tables, constraints, indexes                  | done   | 8cb98cc          |
| T-07 | Increment ladder                                   | done   | 1426320          |
| T-08 | Lifecycle internals                                | done   | 6fe5866          |
| T-09 | place_bid                                          | done   | 12f3921          |
| T-10 | pgTAP: bid rules and idempotency                   | done   | 80c7c44          |
| T-11 | pgTAP: soft close                                  | done   | ea6438c          |
| T-12 | Scheduler path and closing tests                   | done   | 4c28431          |
| T-13 | Settlement                                         | doing  | —                |
| T-14 | Rate limiter                                       | todo   | —                |
| T-15 | Read and identity functions                        | todo   | —                |
| T-16 | Sandboxes, cleanup, test support, realtime trigger | todo   | —                |
| T-17 | Concurrency integration tests                      | todo   | —                |
| T-18 | DB client and repo layer                           | todo   | —                |
| T-19 | HTTP wrapper, Origin check, demo mode gate         | todo   | —                |
| T-20 | Session cookie, names, /api/me                     | todo   | —                |
| T-21 | IP hashing and rate-limit integration              | todo   | —                |
| T-22 | Read endpoints                                     | todo   | —                |
| T-23 | Mutating endpoints: bids and pay                   | todo   | —                |
| T-24 | Test-only endpoints and health                     | todo   | —                |
| T-25 | Security headers and CSP                           | todo   | —                |
| T-26 | Design tokens, shell and name dialog               | todo   | —                |
| T-27 | Client domain utilities                            | todo   | —                |
| T-28 | AuctionFeed interface and PollingFeed              | todo   | —                |
| T-29 | Auction room: read-only parts                      | todo   | —                |
| T-30 | Bid panel and bid history                          | todo   | —                |
| T-31 | SupabaseBroadcastFeed                              | todo   | —                |
| T-32 | Lobby                                              | todo   | —                |
| T-33 | Playwright harness, two-bidder e2e, CI e2e job     | todo   | —                |
| T-34 | Sandbox and bot-token endpoints                    | todo   | —                |
| T-35 | Bot scheduler and runner                           | todo   | —                |
| T-36 | Sandbox UI and e2e                                 | todo   | —                |
| T-37 | Result panel, payment and runner-up UI             | todo   | —                |
| T-38 | Extension banner and public room e2e               | todo   | —                |
| T-39 | App image and full compose                         | todo   | —                |
| T-40 | k6 bid-storm script                                | todo   | —                |
| T-41 | Invariant verification                             | todo   | —                |
| T-42 | Bench report and headline data                     | todo   | —                |
| T-43 | Load workflow                                      | todo   | —                |
| T-44 | How it works page                                  | todo   | —                |
| T-45 | Supabase production setup                          | todo   | —                |
| T-46 | Vercel deploy, DNS, keepalive                      | todo   | —                |
| T-47 | Polish pass                                        | todo   | —                |
| T-48 | README, demo GIF, release                          | todo   | —                |

## Open questions for the owner

None. D-49 approved: TC-066 and TC-098 remain explicitly deferred to T-15 and required before M1 completion.

- Constraint correction (D-47) and single-invocation SQL calls (D-48) approved.

- T-05 environment dependency correction is approved and complete (D-46).

- GitHub creation and the isolated local Docker database lifecycle remain approved (D-44/D-45).

## Verification limits

- M0 has a placeholder application, strict tooling, environment/logger tests, PostgreSQL/pgTAP infrastructure and migration integration tests. Auction rules and browser flows are not implemented yet.
- Local k6 execution is excluded by OWNER-DECISIONS; M6 acceptance must use CI runs (D-43).
- Stop for an owner summary at the end of every milestone.

## M0 completion

- [QA report](../qa/M0-report.md) and [milestone review](../qa/M0-review.md).
- Local checks: 17 unit tests, eight migration integration tests, lint, typecheck, guards, production build and database-tooling acceptance pass.
- Task PRs: [T-01](https://github.com/firatkill/bidlock/pull/1), [T-02](https://github.com/firatkill/bidlock/pull/2), [T-03](https://github.com/firatkill/bidlock/pull/3), [T-04](https://github.com/firatkill/bidlock/pull/4).
- Final task CI: https://github.com/firatkill/bidlock/actions/runs/39565265815.
- No unresolved M0 questions. Auction schema, business tests, browser QA and production deployment remain in M1–M7.

## M1 progress

- T-05 complete: foundation migration, five DB-01 assertions, pgTAP CI job, and approved staged environment setup (D-46).
- Local verification: lint, typecheck, 17 unit tests, five pgTAP assertions and nine migration integration tests pass.
- [T-05 PR](https://github.com/firatkill/bidlock/pull/5) passed all three [CI jobs](https://github.com/firatkill/bidlock/actions/runs/39567084402).

- T-06 complete: [PR #6](https://github.com/firatkill/bidlock/pull/6), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39567684105), task commit `8cb98cc`.

- T-07 complete: [PR #7](https://github.com/firatkill/bidlock/pull/7), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39568377523), task commit `1426320`.

- T-08 complete: [PR #8](https://github.com/firatkill/bidlock/pull/8), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39568809410), task commit `6fe5866`.

- T-09 complete: [PR #9](https://github.com/firatkill/bidlock/pull/9), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39569232276), task commit `12f3921`.

- T-10 complete: [PR #10](https://github.com/firatkill/bidlock/pull/10), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39569625770), task commit `80c7c44`.

- T-11 complete: [PR #11](https://github.com/firatkill/bidlock/pull/11), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39570014492), task commit `ea6438c`.

- T-12 complete: [PR #12](https://github.com/firatkill/bidlock/pull/12), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39570492066), task commit `4c28431`.
