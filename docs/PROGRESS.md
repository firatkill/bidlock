# Progress

Updated: 2026-11-07.

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

| Task  | Goal                                               | Status | Finishing commit                         |
| ----- | -------------------------------------------------- | ------ | ---------------------------------------- |
| T-01  | Repository, tooling and CI skeleton                | done   | b90ffd4                                  |
| T-02  | Env module, logger, server-only boundaries         | done   | cd4606f                                  |
| T-03  | Postgres image and compose database                | done   | 03ee16b                                  |
| T-04  | Migration runner, reset and env SQL                | done   | b2b1c27                                  |
| T-05  | Foundation migration and pgTAP harness             | done   | cd1bd5d                                  |
| T-06  | Core tables, constraints, indexes                  | done   | 8cb98cc                                  |
| T-07  | Increment ladder                                   | done   | 1426320                                  |
| T-08  | Lifecycle internals                                | done   | 6fe5866                                  |
| T-09  | place_bid                                          | done   | 12f3921                                  |
| T-10  | pgTAP: bid rules and idempotency                   | done   | 80c7c44                                  |
| T-11  | pgTAP: soft close                                  | done   | ea6438c                                  |
| T-12  | Scheduler path and closing tests                   | done   | 4c28431                                  |
| T-13  | Settlement                                         | done   | c413084                                  |
| T-14  | Rate limiter                                       | done   | 6f06b1c                                  |
| T-15  | Read and identity functions                        | done   | 0e0e221                                  |
| T-16  | Sandboxes, cleanup, test support, realtime trigger | done   | ae025e2                                  |
| T-17  | Concurrency integration tests                      | done   | 81e558f                                  |
| T-18  | DB client and repo layer                           | done   | fff4b79                                  |
| T-19  | HTTP wrapper, Origin check, demo mode gate         | done   | cc8d215                                  |
| T-20  | Session cookie, names, /api/me                     | done   | a744db1                                  |
| T-21  | IP hashing and rate-limit integration              | done   | 7a46266                                  |
| T-22  | Read endpoints                                     | done   | 75c82d1                                  |
| T-23  | Mutating endpoints: bids and pay                   | done   | 7320006                                  |
| T-24  | Test-only endpoints and health                     | done   | 497f330                                  |
| T-25  | Security headers and CSP                           | done   | 6bd67c0                                  |
| T-26  | Design tokens, shell and name dialog               | done   | 404178a                                  |
| T-27  | Client domain utilities                            | done   | 5cbd6cc                                  |
| T-28  | AuctionFeed interface and PollingFeed              | done   | 91a11bf                                  |
| T-29  | Auction room: read-only parts                      | done   | 0a7de99                                  |
| T-30  | Bid panel and bid history                          | done   | 04e78fe                                  |
| T-31  | SupabaseBroadcastFeed                              | done   | c95b3b9                                  |
| T-32  | Lobby                                              | done   | ca01aa3                                  |
| T-33  | Playwright harness, two-bidder e2e, CI e2e job     | done   | effabbb                                  |
| T-34  | Sandbox and bot-token endpoints                    | done   | bdcaa75                                  |
| T-35  | Bot scheduler and runner                           | done   | c8794b1                                  |
| T-36  | Sandbox UI and e2e                                 | done   | 266eab9a53ecde586b98506d1618843783ad5bfa |
| T-37  | Result panel, payment and runner-up UI             | done   | ac05c7026d8e166368a0cc5778328cd50ffccb9a |
| T-38  | Extension banner and public room e2e               | done   | 5a6b82a                                  |
| T-38a | Catalogue & Ledger design pass (D-59–D-72)         | done   | `3783234` (PR #39)                       |
| T-39  | App image and full compose                         | done   | `fbecd83` (PR #40)                       |
| T-40  | k6 bid-storm script                                | done   | `8f30c43`                                |
| T-41  | Invariant verification                             | done   | `25c2751`                                |
| T-42  | Bench report and headline data                     | done   | `4c8e096` (PR #43)                       |
| T-43  | Load workflow                                      | doing  | —                                        |
| T-44  | How it works page                                  | todo   | —                                        |
| T-45  | Supabase production setup                          | todo   | —                                        |
| T-46  | Vercel deploy, DNS, keepalive                      | todo   | —                                        |
| T-47  | Polish pass                                        | todo   | —                                        |
| T-48  | README, demo GIF, release                          | todo   | —                                        |

## Open questions for the owner

- Constraint correction (D-47) and single-invocation SQL calls (D-48) approved.

- T-05 environment dependency correction is approved and complete (D-46).

- GitHub creation and the isolated local Docker database lifecycle remain approved (D-44/D-45).

## Verification limits

- M0 has a placeholder application, strict tooling, environment/logger tests, PostgreSQL/pgTAP infrastructure and migration integration tests. M1 now implements and verifies the SQL auction rules; browser flows remain future work.
- D-43 keeps benchmark claims CI-only. The owner authorized the small T-39 local infrastructure smoke (VUS=5, DURATION=5s, AUCTION_S=8), expected to stop at the missing T-40 script; no benchmark is published.
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

T-38 in progress: E2E-05 extension and E2E-06 public/benchmark/successor scenarios written. Live settlement review underway; T-37 PR CI passed all six jobs and is merged.

T-38 current gate: focused E2E-05/E2E-06 and 167 unit tests pass; typecheck passes. First full E2E run passed 18/19 (sandbox profile-load timing; focused retest passed unchanged). Second full run passed 8 parallel tests but failed TC-205 because TRD requires 1:00/0:59 despite navigation elapsed time; isolated project did not run. Owner correction approval pending. T-38 not committed or pushed; T-39 not started.

T-38 static/QA checks: lint, typecheck, 167 unit tests and ledger integrity pass. Only the full E2E gate remains blocked on the pending TC-205 specification decision; no task commit or push yet.

T-38 final local verification (2026-11-06): owner-approved D-58 implemented; TC-205 and new lifecycle specs pass, lint/typecheck and 167 unit tests pass, full E2E passes all 19 tests across parallel and isolated projects. QA ledger and M5 report updated. PR CI pending. TC-236 transient Closing frame remains a manual follow-up; T-39 not started.

T-38 delivery: [PR #38](https://github.com/firatkill/bidlock/pull/38). Initial CI passed browser, production build, pgTAP, concurrency and database-tooling jobs; final document formatting was corrected for the static job. Merge requires all final PR checks green. Local ESLint and tracked-file formatting pass; ignored owner `.codex-prompts` artifacts prevent an unfiltered workspace Prettier pass and are not changed.

T-38 complete: [PR #38](https://github.com/firatkill/bidlock/pull/38), [all six CI jobs passed](https://github.com/firatkill/bidlock/actions/runs/42213862171) after an unchanged retry of a transient font-build failure. Implementation commit `5a6b82a`; final evidence commit follows. TC-236 remains manual-required. Stop at M5; T-39 has not started.

## T-38a review delivery

D-59–D-69 recorded; TC-237–TC-248 added. Catalogue room/lobby, mobile controls, experiments, rejected ledger and receipt/lifecycle implemented. Local lint/typecheck, 176 unit tests, database suite and 49 concurrency/integration tests pass. Full E2E: 27/28 passed; legacy TC-202 updated to distinguish accepted bids from approved own rejected requests, then passed focused retest. Focused design/lifecycle run passed 22 tests. [PR #39](https://github.com/firatkill/bidlock/pull/39) is open; CI and owner review pending. [Review and deliberate departures](../qa/T-38a-review.md). Owner browser review is required before merge; T-39 has not started.

T-38a browser-review revision: F1–F7 and D1–D4 implemented; D-70–D-72 and TC-249–TC-254 added. TC-236 passed owner browser review on 2026-11-06 and is removed from open questions. Local lint/typecheck and 180 unit tests pass. Targeted layout, experiment and accessibility checks pass; full E2E found only TC-205 visual-whitespace mismatch (bounds unchanged), focused TC-205 retest and all 10 remaining isolated tests passed. CI pending. PR #39 stays open and unmerged.

T-38a round-2 review: R1 actual race winner/loser template and R2 ledger mount baseline implemented; D-70 clarified and TC-251/TC-253 extended. Focused unit tests pass (15). Targeted E2E (2), lint/typecheck, full unit (182), production build and full E2E (33, both projects) pass. QA log updated; CI pending. PR #39 remains open, do not merge.

## M6 start

T-38a merged as `3783234` (PR #39) after owner review. T-39 starts on `t-39-app-image`. M6 cases are designed before implementation; only T-39 cases are automated now. Owner approved temporarily stopping `rehearse-test-rehearse-1` to free port 3000; restore it after acceptance. Preserve the shared pgdata volume and existing development database.

T-39 interim verification: exact Node/k6 tags verified and k6 image pulled; tools image builds and resets only bidlock_load, preserving dev/test schema OIDs. Build-context tools checks pass. Lint/typecheck, 182 units, 363 pgTAP assertions and 49 integration tests pass. Runner build blocked on the missing build-env specification decision, so app health/non-root and launcher smoke are not yet verified. No T-40 code added.

T-39 build correction approved as D-75 (2026-11-07): command-scoped non-secret test/on placeholders, matching Compose runtime and CI E2E. Retest includes runner filesystem/config checks for placeholder leakage.

T-39 local acceptance complete: D-75 test/on build-only placeholders unblock standalone build; runner grep/config checks contain none of the placeholder secrets. Healthy non-root app (uid1001); dev/test schemas preserved. Small launcher smoke passed through health and failed only at missing T-40 script, as expected. App removed, Rehearse restored, pgdata retained. Final regression checks and PR CI gates recorded in qa/T-39-report.md.

T-39 complete: [PR #40](https://github.com/firatkill/bidlock/pull/40), implementation `fbecd83`. All six [CI jobs passed](https://github.com/firatkill/bidlock/actions/runs/42298376606), including 33 E2E tests, after setup interruptions and an unchanged retry. Final evidence commit must also pass CI before merge. D-73–D-75 and TC-255–TC-259 recorded; no open T-39 questions. T-40 has not started.

## T-40 bid storm

Implementation follows TRD §15.6.2 with formatting only; pinned remote imports and k6 1.8.2 work without vendoring. Rule 5 now checks both load files, with executable positive/negative guard fixtures. TC-260–TC-264 have 14 adapter/guard tests. D-76 records the owner's local acceptance authorization.

Local acceptance passed k6: 1,135 bids, 67 accepted responses, p95 21.3056ms, p99 207.8352ms, zero unexpected errors/replay mismatches. Real summary contains setup_data.auctionId and 50 distinct sessions. Launcher exit1 at the T-41 verifier placeholder is expected; report is not reached. App stopped/removed without volume deletion; Rehearse restarted and Docker health is healthy. Lint, typecheck, 196 unit tests and guards pass. TC-263 full-size CI performance and TC-264 live cap/post-deadline coverage remain planned for T-43; neither is claimed by the short acceptance run. T-41 has not started.

QA ledger structure/status checks pass. The external checker repeats the pre-existing duplicate exploratory `—` lookup collision noted in T-39; independent ordered comparison confirms all 262 previous entries are byte-equivalent as JSON values, with five new entries appended. No history was removed.

T-40 complete: [PR #41](https://github.com/firatkill/bidlock/pull/41), implementation `4ab96b1`, merge commit `8f30c43`. All six [CI jobs passed](https://github.com/firatkill/bidlock/actions/runs/42301679975) before the merge. D-76 and TC-260–TC-264 recorded. Only the full-size M6 performance/closing checks remain scheduled for T-43; no owner checkpoint is open. T-41 has not started.

## T-41 invariant verification

Verifier and six unit tests implemented; shared invariants.sql unchanged. TC-265/TC-266 extended; D-77 records local acceptance. Initial acceptance was interrupted by full disk and Docker I/O errors. The owner recovered disk space and restarted Docker with named volumes preserved; that checkpoint is resolved. Initial failure evidence remains in the append-only QA ledger.

## T-41 resumed acceptance — passed

Owner disk recovery is complete; the previous disk question is closed. Postgres rebuilt successfully and reused `bidlock_pgdata`; `bidlock`, `bidlock_test`, and `bidlock_load` all exist. Only `bidlock_test` was reset directly; the authorized load launcher reset `bidlock_load`. Development schema OID remained 79932 before/after acceptance; no dev reset and no volume deletion.

Fresh VUS=50/DURATION=15s/AUCTION_S=8/BENCH_MIN_BIDS=10 load run passed k6 and verification, then exited 1 only at the expected T-42 report placeholder. Standalone verify exited 0: auction ea1875b6-b49d-4f46-af7e-17c3f5809393, status closed, final_price 19000 cents, bid_count 67, extension_count 7; all 16 invariant checks have zero violations. Incrementing only this load auction's bid_count produced exit 1 and INV-12=1; decrement restored bid_count 67 and exit 0. Shared invariant SQL remains unchanged. No bench/out artifacts are committed.

Lint, typecheck, all 202 unit tests, guards and `pnpm test:concurrency` (49 tests, including INT-01) passed. The earlier PR revision had all six CI jobs green; evidence revision CI must be checked separately.

Bidlock app and Rehearse remain stopped; port 3000 is free for later M6 local load runs. The attempted Rehearse restore failed because its `.env` was missing. The owner subsequently decided that Rehearse restoration is outside T-41 acceptance and will restore it after the M6 local load runs (D-78). This is not a Bidlock blocker. Do not touch the Rehearse repository or start its container. All named volumes remain preserved. T-42 has not started.

Resumed QA ledger: structure/status checks pass; known duplicate exploratory `—` append-only lookup collision persists. Independent ordered comparison confirms all 269 entries and their prior attempts preserved.

T-41 complete: [PR #42](https://github.com/firatkill/bidlock/pull/42), implementation `21871fa`, acceptance evidence `65665fb`, merge commit `25c2751`. All six [CI jobs passed](https://github.com/firatkill/bidlock/actions/runs/42306710169) on the final PR commit `4e3d128` before merge. D-77/D-78 and TC-265/TC-266 recorded. All local acceptance checks pass; no T-41 questions remain. Rehearse remains stopped for owner restoration after M6 local load runs; port 3000 stays free. T-42 has not started.

## T-42 resumed — owner decision recorded

The owner approved extending k6 instrumentation and summary configuration on 2026-11-07 (D-79). The report-input checkpoint is resolved; no open owner question remains. Implementing T-42 on `t-42-report`; T-43 has not started. D-80 records the authorized full-size local acceptance run, which is not a published benchmark. Rehearse stays stopped and untouched.

T-42 local acceptance passed: 212 unit/DOM tests; 49 integration tests including INT-01/INT-02; 363 pgTAP assertions; lint/typecheck/guards/build; targeted TC-235 with full measured result and with restored empty sentinel; full E2E 33/33 once. One full-size local load run at defaults exited 0: 45,186 bid requests, 2,204 replays, 305 accepted HTTP outcomes (287 unique accepted bids), p95 57.23392675 ms, p99 462.3527715 ms, unexpected error rate 0, all 16 invariant checks zero, thresholds.passed=true. Strict result and local SUMMARY exist only in ignored bench/out. Report date is UTC (2026-11-06), local acceptance date 2026-11-07. bench/results is unchanged.

D-79/D-80 and TC-267–269 updated. Interactive browser discovery returned no browsers; automated full/empty headline checks passed, owner visual review remains required. QA ledger structural/status checks pass; the known duplicate exploratory `—` append-only lookup collision remains. Independent ordered comparison confirms all 269 original entries and their prior attempts preserved, plus three new cases. Bidlock app is stopped, Rehearse untouched, named volumes preserved. All six CI jobs passed on implementation commit `46fafea`: [run 42308943337](https://github.com/firatkill/bidlock/actions/runs/42308943337). [PR #43](https://github.com/firatkill/bidlock/pull/43) stays open for owner browser review; do not merge or start T-43. The final evidence-only revision must also retain green CI.

## T-43 workflow implementation

T-42 owner browser review passed and PR #43 merged as `4c8e096`. Load workflow follows TRD §16.2, with static TC-270/TC-271 contract coverage. D-81 records A-09 approval; read-only repository defaults and enabled PR creation verified without settings changes. Local lint, typecheck, 214 unit tests and guards pass. CI, first default dispatch and benchmark publication remain pending.

## T-43 benchmark checkpoint — owner decision required

Workflow [PR #44](https://github.com/firatkill/bidlock/pull/44) merged as `99ab16e` after all six [CI jobs](https://github.com/firatkill/bidlock/actions/runs/42310578537) passed. D-81 records the existing A-09 approval; repository settings were not changed.

First default [load run 42310825613](https://github.com/firatkill/bidlock/actions/runs/42310825613) failed latency thresholds: 33,874 bids, 1,687 replays, 246 accepted HTTP responses (235 unique bids), p95 406.8271048999999 ms (limit <250), p99 1029.5332955099943 ms (limit <600), unexpected error rate 0, all 16 invariant checks zero, thresholds.passed=false. TC-264 also lacks the required coverage: only 12/20 extensions and zero AUCTION_CLOSED responses, though the verifier eventually closed the auction.

Artifact `bench-42310825613` uploaded (37,140 bytes) and downloaded for inspection. FullBenchResult parses. A-09 works: bot [PR #45](https://github.com/firatkill/bidlock/pull/45) changes exactly `bench/results/2026-11-06.json`, `bench/results/latest.json`, `bench/SUMMARY.md` (UTC run date). It remains unmerged; no numbers edited or published to main. No retry attempted. TC-263/TC-264 failure evidence and TC-270/TC-271 workflow evidence recorded. T-43 remains blocked; T-44 not started.

Owner options: authorize diagnosis and a proposed fix before another benchmark (recommended), or authorize one unchanged retry. No thresholds or workload assumptions will be changed without approval. Evidence pushed on `t-43-load-workflow`.

QA ledger structural/status checks pass; external checker retains its documented duplicate exploratory `—` lookup collision. Independent ordered comparison verifies every prior attempt remains unchanged.

## T-43 diagnosis — timing specification checkpoint

D-82 records owner authorization to diagnose without a blind retry. [Diagnosis and proposed options](../qa/T-43-diagnosis.md) establish the soft-close timing contradiction and quantify the available HTTP latency breakdown. App/SQL/pool/CPU attribution is unavailable in the original artifact, not inferred as measured fact. No runtime change, local load, new CI dispatch, fix PR merge or change to bot PR #45. Existing failure evidence preserved; T-43 blocked, T-44 untouched.

## T-43 instrumentation implementation

D-83 corrects the load-only extension to 10 s. D-84 adds opt-in diagnostics and per-run results branches, preserving PR #45. TC-264 updated and TC-276 added. Diagnostic dispatch pending green CI and merge; no runtime rule changes.

Instrumentation local validation: lint/typecheck, 216 unit tests, pgTAP and 49 concurrency/integration tests pass; shell syntax and Compose overlay validate. Existing TC-261 fixture updated to approved extension10; failure/retest retained. TC-276 live evidence awaits the diagnostic dispatch.

## T-43 diagnostic complete — pool fix

Instrumentation PR #46 merged as `df22752` with six green CI jobs. Diagnostic run42313175983 reached20 extensions and500 post-close responses, but p99=726.37423376 ms failed (p95=241.3247772 ms); bot PR #47 intentionally unmerged. All16 invariant checks zero. Measured attribution is in qa/T-43-diagnosis.md. D-85 reduces load pool20→4 to limit observed auction lock contention; TC-277 tracks the final gate. No SQL changes. One final dispatch remains after the fix PR passes CI and merges.

## T-43 final authorized validation — failed, owner checkpoint

Fix PR #48 merged as `880d155` with six green CI jobs after a transient E2E font-build failure passed on rerun. Final [run42314282647](https://github.com/firatkill/bidlock/actions/runs/42314282647): 21,788 bids,1,066 replays,124 accepted HTTP outcomes (117 unique bids), p95=896.4585606 ms, p99=1529.85733683 ms, errors0, all16 invariant checks0, thresholds.passed=false. Cap20 and500 post-close responses satisfy TC-264. Pool4 worsened latency relative to the diagnostic pool20 run; exact breakdown recorded in qa/T-43-diagnosis.md.

Artifact uploaded and full schema/file scope validated. Bot PR #49 remains unmerged, as do untouched #45/#47. Both additional dispatches used; no retry, no benchmark publication and no T-44 work. D-83/D-84/D-85 and TC-276/TC-277 retained. Main still has the authorized pool4 setting; proposed restoration to20 needs the next owner decision. Evidence is pushed on t-43-final-evidence. QA ledger prior attempts preserved; known external exploratory-label checker collision remains.

## T-43 single-call/ramp revision

D-86 restores pool20 and records D-85 as failed. D-87 adds migration0013 submit_bid and one-call production/load route with parity tests. D-88 adds10 s ramp metadata and opt-in diagnostic dispatch. New TC-278–280; regression validation underway. No new load dispatch yet.

Single-call/ramp local acceptance: lint/typecheck/guards,221 unit tests,437 pgTAP assertions,51 concurrency/integration tests including INT-01/INT-02, production build and33 E2E tests pass. New SQL parity file has74 assertions. TC-278 fixture failures/retests retained; D-86 retires TC-277 pool4 target without deleting history. CI and the two authorized dispatches remain pending.

## T-43 single-call measurement checkpoint

PR #50 merged as `d3bc583` with six green CI jobs. D-88 diagnostic [run42316538127](https://github.com/firatkill/bidlock/actions/runs/42316538127) failed:22,755 bids,1,167 replays,150 accepted HTTP outcomes (145 unique),p95=641.861405 ms,p99=753.5082123 ms,unexpected errors0,all16 invariant checks0,thresholds.passed=false. Cap20 and500 post-close responses pass TC-264. Compared with prior pool20 diagnostic, both percentiles are worse; scored run not started.

Combined SQL-await mean429.050 ms dominates429.332 ms handler mean. Database wait contexts now identify rate_hit/check_bid_rate/submit_bid; the single transaction retains shared rate locks through bid processing. Exact breakdown and qualification are in qa/T-43-diagnosis.md. Artifact/schema/file scope verified; bot PR #51 and older #45/#47/#49 remain open and unchanged. No benchmark published. One of the latest two dispatches used; the measurement gate stops further work pending owner decision. Evidence on t-43-single-call-evidence; T-44 untouched.

D-89/D-90 approved: distinct synthetic load client IPs and short identity/rate transaction before bidding. Two new dispatches authorized, gated by measurement versus pool20 three-call baseline; T-44 untouched.
