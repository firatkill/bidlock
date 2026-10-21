# M4 QA report — Sandbox and bots

Status: **M4 complete**. T-34–T-36 passed local verification and PR CI. Stopped before T-37 for the owner’s milestone review.

## Evidence

- 161 unit tests, 15 browser tests, lint, typecheck, static guards and production polling build pass locally. T-34 server/auth work also passed 363 pgTAP assertions and 49 concurrency/integration tests, including INT-01/INT-02.
- Seeded E2E-03 passed three consecutive local runs, then the full browser suite. It induces a bot counterbid before asserting same-bot timestamps are at least 2000ms apart. Shared public-lobby access requires the isolated project under AGENTS.md, overriding the plan's parallel label. No expect/test timeouts were raised.
- UT-06 covers token signature, expiry, auction/owner binding and tampering. UT-07 covers deterministic decisions, budgets, pacing, opening/late phases, exact probability/interval boundaries and 10000 payment draws per persona.
- Native browser review verified owner creation, bot bids, human bidding, active sandbox return, mobile layout and actual background pause/resume. [Detailed live evidence](M4-browser-plan.md), [mobile screenshot](evidence/M4-mobile.jpg).
- [T-34 CI](https://github.com/firatkill/bidlock/actions/runs/39633743105) and [T-35 CI](https://github.com/firatkill/bidlock/actions/runs/39635559095) passed all six jobs. [T-36 CI](https://github.com/firatkill/bidlock/actions/runs/39638410035) also passed all six jobs; the E2E job passed on its second attempt.

## Resolved

All 17 designed M4 cases have passing local evidence in the [append-only ledger](test-results.json).

| Case   | Behavior                                  | Current result          |
| ------ | ----------------------------------------- | ----------------------- |
| TC-211 | Bot token signing and lifetime            | Passed; ledger evidence |
| TC-212 | Bot token scope and integrity             | Passed; ledger evidence |
| TC-213 | Sandbox creation and existing room        | Passed; ledger evidence |
| TC-214 | Sandbox capacity and IP limit             | Passed; ledger evidence |
| TC-217 | Bot payment authorization                 | Passed; ledger evidence |
| TC-215 | Bot token issuer ownership                | Passed; ledger evidence |
| TC-216 | Bot bidding and owner-cookie binding      | Passed; ledger evidence |
| TC-218 | Deterministic random sequence and budgets | Passed; ledger evidence |
| TC-219 | Bot pacing and leader protection          | Passed; ledger evidence |
| TC-220 | Persona phases and budget dropout         | Passed; ledger evidence |
| TC-221 | Bot payment choices and delay             | Passed; ledger evidence |
| TC-222 | Runner token startup and shared API       | Passed; ledger evidence |
| TC-223 | Runner pause and terminal cleanup         | Passed; ledger evidence |
| TC-224 | Runner rejection scheduling               | Passed; ledger evidence |
| TC-225 | Sandbox entry and status copy             | Passed; ledger evidence |
| TC-226 | Seeded sandbox bidding flow               | Passed; ledger evidence |
| TC-227 | Sandbox visual and background states      | Passed; ledger evidence |

## Pending decision

None. No new service, runtime dependency, cost or specification change was introduced.

## Manual test required

None outstanding for M4. TC-227 is complete. Controlled Chrome reported the tab as visible after tab switches; native Brave supplied the actual pause/resume evidence and its DOM inspector showed the exact hidden-tab message. Viewport, DevTools docking and QA tabs were restored/closed.

## Regressions and audit trail

No unresolved product regressions or retracted cases. T-36’s first CI E2E job failed before tests started because Turbopack could not process its Google font imports. The separate build job passed; rerunning only the failed job on the same commit passed without code, assertion or timeout changes. Both attempts are retained in the ledger. Failed attempts remain in the ledger followed by actual retests. New tests were corrected to compare ISO instants, read `leader.id`, validate the saved SQL fixture setting and use asynchronous React `act` correctly; product assertions were not relaxed.

## Root causes and advisory review

No unresolved root-cause clusters. Strict lint caught fixture typing, mock callback and closure-narrowing issues; fixes preserve the post-await lifecycle checks. Review also added a regression that prevents further bidding after AUCTION_CLOSED until a failed snapshot refresh eventually succeeds. No M4 case has three consecutive unresolved failures.

## Acceptance coverage

This covers the M4 portions of the following requirements, not later settlement UI, deployment or load evidence.

| Reference | Cases                                                          | Verification |
| --------- | -------------------------------------------------------------- | ------------ |
| D-16      | TC-217, TC-221                                                 | Verified     |
| FR-23     | TC-212, TC-216                                                 | Verified     |
| FR-32     | TC-213, TC-225                                                 | Verified     |
| FR-33     | TC-211, TC-212, TC-217, TC-215, TC-216, TC-222, TC-223, TC-226 | Verified     |
| FR-34     | TC-218, TC-219, TC-220, TC-224, TC-226                         | Verified     |
| FR-35     | TC-214                                                         | Verified     |
| FR-38     | TC-223, TC-227                                                 | Verified     |
| NFR-20    | TC-227                                                         | Verified     |
| US-09     | TC-213, TC-225, TC-226                                         | Verified     |

## Limits

Hosted Supabase Broadcast, production deployment and load benchmarks remain unverified in this milestone. Manual and browser flows use local polling. Native Brave reported `/favicon.ico` 404; favicon artwork is outside M4 and no M4 API error was observed. Payment decisions and bot payment API behavior are verified; the visitor settlement UI belongs to M5. No benchmark numbers are claimed.
