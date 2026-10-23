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

| Task | Goal                                               | Status | Finishing commit                         |
| ---- | -------------------------------------------------- | ------ | ---------------------------------------- |
| T-01 | Repository, tooling and CI skeleton                | done   | b90ffd4                                  |
| T-02 | Env module, logger, server-only boundaries         | done   | cd4606f                                  |
| T-03 | Postgres image and compose database                | done   | 03ee16b                                  |
| T-04 | Migration runner, reset and env SQL                | done   | b2b1c27                                  |
| T-05 | Foundation migration and pgTAP harness             | done   | cd1bd5d                                  |
| T-06 | Core tables, constraints, indexes                  | done   | 8cb98cc                                  |
| T-07 | Increment ladder                                   | done   | 1426320                                  |
| T-08 | Lifecycle internals                                | done   | 6fe5866                                  |
| T-09 | place_bid                                          | done   | 12f3921                                  |
| T-10 | pgTAP: bid rules and idempotency                   | done   | 80c7c44                                  |
| T-11 | pgTAP: soft close                                  | done   | ea6438c                                  |
| T-12 | Scheduler path and closing tests                   | done   | 4c28431                                  |
| T-13 | Settlement                                         | done   | c413084                                  |
| T-14 | Rate limiter                                       | done   | 6f06b1c                                  |
| T-15 | Read and identity functions                        | done   | 0e0e221                                  |
| T-16 | Sandboxes, cleanup, test support, realtime trigger | done   | ae025e2                                  |
| T-17 | Concurrency integration tests                      | done   | 81e558f                                  |
| T-18 | DB client and repo layer                           | done   | fff4b79                                  |
| T-19 | HTTP wrapper, Origin check, demo mode gate         | done   | cc8d215                                  |
| T-20 | Session cookie, names, /api/me                     | done   | a744db1                                  |
| T-21 | IP hashing and rate-limit integration              | done   | 7a46266                                  |
| T-22 | Read endpoints                                     | done   | 75c82d1                                  |
| T-23 | Mutating endpoints: bids and pay                   | done   | 7320006                                  |
| T-24 | Test-only endpoints and health                     | done   | 497f330                                  |
| T-25 | Security headers and CSP                           | done   | 6bd67c0                                  |
| T-26 | Design tokens, shell and name dialog               | done   | 404178a                                  |
| T-27 | Client domain utilities                            | done   | 5cbd6cc                                  |
| T-28 | AuctionFeed interface and PollingFeed              | done   | 91a11bf                                  |
| T-29 | Auction room: read-only parts                      | done   | 0a7de99                                  |
| T-30 | Bid panel and bid history                          | done   | 04e78fe                                  |
| T-31 | SupabaseBroadcastFeed                              | done   | c95b3b9                                  |
| T-32 | Lobby                                              | done   | ca01aa3                                  |
| T-33 | Playwright harness, two-bidder e2e, CI e2e job     | done   | effabbb                                  |
| T-34 | Sandbox and bot-token endpoints                    | done   | bdcaa75                                  |
| T-35 | Bot scheduler and runner                           | done   | c8794b1                                  |
| T-36 | Sandbox UI and e2e                                 | done   | 266eab9a53ecde586b98506d1618843783ad5bfa |
| T-37 | Result panel, payment and runner-up UI             | done   | ac05c7026d8e166368a0cc5778328cd50ffccb9a |
| T-38 | Extension banner and public room e2e               | todo   | —                                        |
| T-39 | App image and full compose                         | todo   | —                                        |
| T-40 | k6 bid-storm script                                | todo   | —                                        |
| T-41 | Invariant verification                             | todo   | —                                        |
| T-42 | Bench report and headline data                     | todo   | —                                        |
| T-43 | Load workflow                                      | todo   | —                                        |
| T-44 | How it works page                                  | todo   | —                                        |
| T-45 | Supabase production setup                          | todo   | —                                        |
| T-46 | Vercel deploy, DNS, keepalive                      | todo   | —                                        |
| T-47 | Polish pass                                        | todo   | —                                        |
| T-48 | README, demo GIF, release                          | todo   | —                                        |

## Open questions for the owner

None. Docker recovered after the owner restart; local database reset and focused settlement E2E pass. M5 verification in progress.

- Constraint correction (D-47) and single-invocation SQL calls (D-48) approved.

- T-05 environment dependency correction is approved and complete (D-46).

- GitHub creation and the isolated local Docker database lifecycle remain approved (D-44/D-45).

## Verification limits

- M0 has a placeholder application, strict tooling, environment/logger tests, PostgreSQL/pgTAP infrastructure and migration integration tests. M1 now implements and verifies the SQL auction rules; browser flows remain future work.
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

- T-13 complete: [PR #13](https://github.com/firatkill/bidlock/pull/13), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39570875624), task commit `c413084`.

- T-14 complete: [PR #14](https://github.com/firatkill/bidlock/pull/14), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39571473276), task commit `6f06b1c`.

- T-15 complete: [PR #15](https://github.com/firatkill/bidlock/pull/15), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39571994600), task commit `0e0e221`.

- T-16 complete: [PR #16](https://github.com/firatkill/bidlock/pull/16), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39572606913), task commit `ae025e2`.

- T-17 implementation and functional tests committed as `b290db9`: [PR #17](https://github.com/firatkill/bidlock/pull/17), all four [CI jobs passed](https://github.com/firatkill/bidlock/actions/runs/39574190011). D-50 resolves mutation acceptance; restored-suite verification and final PR CI pass.

- T-17 complete: [PR #17](https://github.com/firatkill/bidlock/pull/17), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39578517062), task commit `81e558f`.

## M1 completion

- T-05–T-17 are complete; all task PRs passed CI before merge.
- [QA report](../qa/M1-report.md) and [milestone review](../qa/M1-review.md) cover all 113 M1 cases and retained failure history.
- Final checks: lint, typecheck, 37 unit tests, 363 pgTAP assertions and 19 integration tests (9.70 seconds) pass. Approved double-lock mutation is detected; original functions are restored.
- No unresolved owner questions. API/browser, real Supabase Broadcast, production cron/deployment and CI-only load benchmarks remain for later milestones.
- Stopped at the M1 checkpoint. T-18 has not started.

## M2 progress

Owner approved continuing after M1. M2 cases TC-127–TC-167 were designed before implementation; prerequisite cases TC-168–TC-169 were added before their code. T-18–T-25 are complete.

- T-18 complete: [PR #18](https://github.com/firatkill/bidlock/pull/18), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39580737981), task commit `fff4b79`.

- T-19 HTTP core: 17 focused tests pass; full checks pass (54 unit, 363 pgTAP assertions, 21 integration tests, lint/typecheck). D-51 is approved; session authentication is implemented and all 18 HTTP tests now pass. Final T-19 CI pending.

- T-19 complete: [PR #19](https://github.com/firatkill/bidlock/pull/19), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39583760198), task commit `cc8d215`.

- T-20 local acceptance passes: session/name unit coverage, real identity route integration, rate response and live Next cookie check (port 3100; 3000 occupied). Final checks: 63 unit tests, 363 pgTAP assertions, 25 integration tests, lint/typecheck. D-51 IP helper implemented; dedicated IP acceptance remains T-21. D-52 preserves owner agent rules during Next dev. PR CI pending.

- T-20 complete: [PR #20](https://github.com/firatkill/bidlock/pull/20), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39584701848), task commit `a744db1`.

- T-21 complete: [PR #21](https://github.com/firatkill/bidlock/pull/21), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39585150915), task commit `7a46266`.

- T-22 complete: [PR #22](https://github.com/firatkill/bidlock/pull/22), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39586578172), task commit `75c82d1`.

- T-23 complete: [PR #23](https://github.com/firatkill/bidlock/pull/23), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39587637178), task commit `7320006`.

- T-24 complete: [PR #24](https://github.com/firatkill/bidlock/pull/24), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39588746380), task commit `497f330`.

- T-25 complete: [PR #25](https://github.com/firatkill/bidlock/pull/25), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39589572593), task commit `6bd67c0`.

## M2 completion

- T-18–T-25 are complete; every task PR passed all four CI jobs before merge.
- [QA report](../qa/M2-report.md) and [milestone review](../qa/M2-review.md) cover all 43 M2 cases with automation links and retained failures/retests.
- Final checks: lint, typecheck, 74 unit tests, 363 pgTAP assertions, 43 integration tests (9.83 seconds), static test-route guard and production build pass. Local Chromium verifies matching script nonces and no CSP/runtime errors.
- T-25 task commit `6bd67c0`; [passing CI](https://github.com/firatkill/bidlock/actions/runs/39589572593).
- No unresolved owner questions. Full browser auction flows, real Supabase Broadcast, production deployment, accessibility/mobile review and CI-only load benchmarks remain later work. Bot HTTP authorization remains T-34; browser E2E harness remains T-33.
- Next's app-build manifest is absent; T-33 follows the existing A-10/D-33 E2E-09 fallback. Local production server stopped after verification.
- Stopped at the M2 checkpoint. T-26 has not started.

## M3 progress

Owner approved continuing after M2. TC-170–TC-208 designed before implementation; TC-209/TC-210 add approved error-reporting and client-session boundary coverage. T-26 is in progress. D-53 approves the ID-only error-reporting endpoint.

- T-26 complete: [PR #26](https://github.com/firatkill/bidlock/pull/26), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39594121634), task commit `404178a`.

- T-27 independent work: money/clock/live-announcer helpers pass focused tests, full lint/typecheck and 92 unit tests. Domain line coverage is 95.19%, with the 90% threshold enforced. D-54 is approved; reconciler implementation is underway; T-27 is not complete.

- T-27 final local checks pass: lint, typecheck, 97 unit tests; domain line coverage 96.21%. D-54 recorded, shared feed types and pure reconciler complete. PR CI pending.

- T-27 complete: [PR #27](https://github.com/firatkill/bidlock/pull/27), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39605740702), task commit `5cbd6cc`.

- T-28 local checks pass: lint, typecheck and 104 unit tests. Polling handles ETags, history gaps, reconnect backoff, visibility and terminal states; room/clock hooks are ready. PR CI pending.

- T-28 complete: [PR #28](https://github.com/firatkill/bidlock/pull/28), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39606582000), task commit `91a11bf`.

- T-29 local checks pass: lint/typecheck, build, 110 unit tests, 363 pgTAP assertions and 44 integration tests (11.40 s). Production Chromium room checks cover 360/1280 light/dark, missing auctions, no overflow/runtime errors and zero serious/critical axe findings. PR CI pending.

- T-29 complete: [PR #29](https://github.com/firatkill/bidlock/pull/29), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39607568756), task commit `0a7de99`.

- T-30 independent bid-panel work passes lint/typecheck/build, 129 unit tests, 363 pgTAP assertions and 44 integration tests (9.21 s). Local production two-browser flow verifies quick/keyboard/custom bids, accepted/outbid notices and validation; mobile prefix spacing fixed. History pagination TC-193 remains pending owner approval of the newest-100 cap; T-30 is not complete.

- T-30 D-55 implemented: history paging stops at the newest 100 rows or exhaustion. Final checks: 132 unit tests, lint/typecheck/build and local production two-bidder/history acceptance pass. Final PR CI pending.

- T-30 complete: [PR #30](https://github.com/firatkill/bidlock/pull/30), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39621203639), task commit `04e78fe`.

- T-31 local checks pass: lint/typecheck and 138 unit tests. Strict Broadcast payloads, reconnect/safety/visibility refresh, permanent 2 s polling fallback and lazy import verified with mocks. Hosted Supabase delivery remains unverified until deployment. PR CI pending.

- T-31 complete: [PR #31](https://github.com/firatkill/bidlock/pull/31), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39622322473), task commit `c95b3b9`.

T-32: lobby cards, offer notices, strict benchmark union and empty state implemented. Local checks: 143 unit tests, 363 pgTAP assertions, 44 integration tests, lint/typecheck/build; mobile/light and desktop/dark browser acceptance and axe pass. PR CI pending; full E2E harness follows in T-33.

- T-32 complete: [PR #32](https://github.com/firatkill/bidlock/pull/32), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39624426166), task commit `ca01aa3`.

T-33: Playwright harness and 14 tests implemented. Local full run passes with four parallel workers followed by one isolated worker. Lobby visitors (including two-bidder fixtures) and shared rate checks are isolated per AGENTS.md. Lint/typecheck, 143 unit tests with coverage gate, guards, build and E2E-09 budget pass. Name dialog code now loads on Edit to meet the unchanged budget; save/focus regression checks pass. Explicit development-only playwright-core aligns axe with the runner (the diagram tool's older optional peer still warns; diagram generation belongs to T-44). PR CI and live M3 review pass. M3 completed with 41 resolved cases; hosted Broadcast remains unverified and the transient Closing frame was not visually captured. See qa/M3-report.md and qa/M3-review.md.

- T-33 complete: [PR #33](https://github.com/firatkill/bidlock/pull/33), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39630388760), task commit `effabbb`.

## M4 start

Owner approved continuing after M3. TC-211–TC-227 designed from PRD/TRD before implementation. T-34 in progress.

T-34: sandbox and bot-token endpoints, signed scoped tokens and session-or-bot authentication implemented. Local lint/typecheck, 145 unit tests, 363 pgTAP assertions and 49 integration/concurrency tests pass. Production polling build and all 14 browser regressions pass. All six PR CI jobs pass.

- T-34 complete: [PR #34](https://github.com/firatkill/bidlock/pull/34), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39633743105), task commit `bdcaa75`.

T-35: deterministic persona scheduler and browser runner implemented. Local lint/typecheck/guards, 157 unit tests, production polling build and 14 browser regressions pass. All six PR CI jobs pass. Runner UI mounting follows in T-36.

- T-35 complete: [PR #35](https://github.com/firatkill/bidlock/pull/35), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39635559095), task commit `c8794b1`.

T-36: sandbox creation UI, owner expiry header and lazy bot strip/runner mounted. Local lint/typecheck/guards, 161 unit tests, production build and 15 browser tests pass. Seeded sandbox flow passed three consecutive runs in the isolated project (shared-lobby AGENTS override). Live Chrome/mobile and native Brave pause/resume pass; missing favicon noted in QA report. All six PR CI jobs pass. The E2E job initially failed during Turbopack font processing before tests started; its unchanged rerun passed. M4 completed with 17 resolved cases; see qa/M4-report.md and qa/M4-review.md.

- T-36 complete: [PR #36](https://github.com/firatkill/bidlock/pull/36), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39638410035), task commit `266eab9a53ecde586b98506d1618843783ad5bfa`.

## M5 start

Owner approved continuing after M4. TC-228–TC-236 designed before code. T-37 in progress.

T-37 draft: result panel covers all specified closed-state viewer copy, next-public-lot link/countdown and owned-offer announcements. Profile refresh on settlement/lobby entry and expired notice filtering added. Seven focused DOM tests, targeted lint and typecheck pass. Settlement E2E scenarios written but not yet run; payment controls await pending transport/rate-copy approval. No task commit or push yet; T-38 not started.

T-37 update (2026-10-23): D-57 approved and recorded; PayButton implements identity-first strict empty POST, pending deduplication, idempotent retry, exact rejection copy, read-only and rate-limit countdown. Five focused settlement/payment tests, typecheck and production polling build pass. Full unit run: 163/166 pass; existing TC-171/193 failures under heavy host load. Affected-file rerun still fails (TC-171/172/193); failures retained in ledger, no timeouts or assertions changed. Full lint did not finish promptly. Local PostgreSQL/Docker time out even after owner restart; E2E not run. T-37 remains doing, no commit/push, T-38 not started. Next: verify Docker readiness; rerun affected unit cases (third consecutive failure for TC-171/193 requires QA check-in), finish lint, full unit suite, reset local test DB, settlement E2E then full E2E and CI.

T-37 verification recovered: local production build, typecheck, guards, 167 unit tests and all 17 E2E tests pass. Winner, runner-up, strike and lobby offer flows verified; PR CI pending. Initial host-load failures retained in the QA ledger.

- T-37 complete: [PR #37](https://github.com/firatkill/bidlock/pull/37), [passing CI](https://github.com/firatkill/bidlock/actions/runs/39929845587), task commit `ac05c7026d8e166368a0cc5778328cd50ffccb9a`.
