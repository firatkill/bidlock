# M6 QA report — Load test, CI and How it works

2026-11-07. T-39–T-44 implementation evidence; T-44 UI awaits owner review and merge. Source of truth: [test-results.json](test-results.json) and [test-cases.md](test-cases.md). No milestone closure is claimed before owner review.

## Results

T-44: lint, typecheck,238 unit tests, guards, production build, pgTAP and52 concurrency/integration tests pass. Six focused browser tests pass after fixing mobile grid overflow. Final full E2E suite passes39/39. Local Chromium screenshots inspected at375px in light/dark and1440px; no browser console/page errors. [Implementation CI42355483795](https://github.com/firatkill/bidlock/actions/runs/42355483795) passed all six jobs on353c86a; [PR #57](https://github.com/firatkill/bidlock/pull/57) remains open for owner review.

The published benchmark remains unchanged: p95=269.233384 ms fails250; p99=329.68857432 ms passes600; unexpected errors0; invariant violations0; thresholds.passed=false. D-92 accepts the NFR-10 gap and permits publication, not a passing latency claim. No new load run was performed for T-44.

## Resolved

| TC     | Title                                                             | Current evidence                                      |
| ------ | ----------------------------------------------------------------- | ----------------------------------------------------- |
| TC-255 | Production container build and healthy non-root runner            | Last recorded attempt passed; full history in ledger. |
| TC-256 | Load migration targets only bidlock_load                          | Last recorded attempt passed; full history in ledger. |
| TC-257 | Database-only command and load profile isolation                  | Last recorded attempt passed; full history in ledger. |
| TC-258 | Build context excludes local data but retains benchmarks          | Last recorded attempt passed; full history in ledger. |
| TC-259 | Small load launcher reaches expected missing-script boundary      | Last recorded attempt passed; full history in ledger. |
| —      | T-39 CI E2E setup interruptions                                   | Last recorded attempt passed; full history in ledger. |
| TC-260 | k6 defaults, overrides and local target guards                    | Last recorded attempt passed; full history in ledger. |
| TC-261 | Independent bidders and setup summary                             | Last recorded attempt passed; full history in ledger. |
| TC-262 | Replay and outcome classification under load                      | Last recorded attempt passed; full history in ledger. |
| TC-264 | Soft close cap and post-deadline exercise                         | Last recorded attempt passed; full history in ledger. |
| TC-265 | Verifier checks every invariant and persists results              | Last recorded attempt passed; full history in ledger. |
| TC-266 | Verifier fails corrupted or insufficient runs                     | Last recorded attempt passed; full history in ledger. |
| TC-267 | Benchmark schema and factual report                               | Last recorded attempt passed; full history in ledger. |
| TC-268 | Report filenames and local no-commit mode                         | Last recorded attempt passed; full history in ledger. |
| TC-269 | Lobby reads measured benchmark data                               | Last recorded attempt passed; full history in ledger. |
| TC-270 | Scheduled/manual load workflow and artifacts                      | Last recorded attempt passed; full history in ledger. |
| TC-271 | Result PR and failed-threshold reporting                          | Last recorded attempt passed; full history in ledger. |
| TC-276 | Load-only diagnostics preserve isolation and sensitive data       | Last recorded attempt passed; full history in ledger. |
| TC-278 | Composed SQL bid entry point preserves outcomes and rate counters | Last recorded attempt passed; full history in ledger. |
| TC-280 | Ramped workload and scored diagnostic isolation                   | Last recorded attempt passed; full history in ledger. |
| TC-281 | Stable synthetic per-VU load IPs                                  | Last recorded attempt passed; full history in ledger. |
| TC-282 | Short rate transaction before auction lock                        | Last recorded attempt passed; full history in ledger. |
| TC-283 | Bounded load-only Node and pool profiling                         | Last recorded attempt passed; full history in ledger. |
| TC-284 | Rules lifecycle and exact concurrency copy                        | Last recorded attempt passed; full history in ledger. |
| TC-285 | Static P5 two-transaction timeline                                | Last recorded attempt passed; full history in ledger. |
| TC-286 | Empty benchmark state                                             | Last recorded attempt passed; full history in ledger. |
| TC-287 | Honest full benchmark and threshold variants                      | Last recorded attempt passed; full history in ledger. |
| TC-288 | Stats cache and unavailable state                                 | Last recorded attempt passed; full history in ledger. |
| TC-289 | Accessible responsive How it works                                | Last recorded attempt passed; full history in ledger. |
| TC-290 | 375px visual review                                               | Last recorded attempt passed; full history in ledger. |
| —      | T-44 acceptance gates                                             | Last recorded attempt passed; full history in ledger. |

## Pending decision / accepted gap

TC-263 (NFR-10): still open as the owner-accepted D-92 p95 gap. Not relabeled as resolved. No further dispatch/tuning authorized. No new product decision blocks T-44; D-93 approved the benchmark failure copy and variants.

## Manual review

TC-290: local visual pass completed; [light mobile](evidence/T-44-mobile-light.png), [dark mobile](evidence/T-44-mobile-dark.png), [desktop](evidence/T-44-desktop.png). In-app browser unavailable; standalone local Chromium used. Owner must review the UI and merge the open PR. T-45 is untouched.

## Regressions and root causes

No new regression against a previously passing T-44 case. TC-289 `T44-grid-intrinsic-width` resolved by bounded grid columns. TC-288 stale revalidation replaced by an expiring cache that waits for fresh data. TC-290 Mermaid label clipping fixed with token typography and visible label overflow. Prior load tuning attempts remain in the ledger; their failures were not erased.

## Audit trail

- TC-277: Measured load pool tuning preserves correctness and thresholds. D-86 explicitly abandons the pool4 hypothesis after its failed measurements; all failure evidence retained. It is no longer the target configuration.
- TC-279: Bid HTTP path makes one database call. D-90 supersedes the one-call requirement with two statements; TC-282 covers replacement. Historical attempts retained.

## Requirements coverage

- FR-69, US-11, G-3: TC-284–287 and TC-289–290 verify rule/default display, lifecycle, exact concurrency prose, static P5 timeline, empty/full benchmark states, failure variants and accessible responsive presentation.
- FR-70: TC-288 verifies60s expiry, concurrent request sharing, timestamp, schema validation, retry and error/zero rendering.
- NFR-10: partially met; p99 passes, p95 fails (TC-263, D-92).
- NFR-11/NFR-12: published run has0 unexpected errors and0 violations; verifier evidence retained in TC-264–266.
- NFR-40/load isolation: T-39–43 build/target/workflow/diagnostics cases retain their passing evidence. T-44 did not change load settings.

## Ledger integrity

External checker passes required fields/status/resolution/manual checks but fails its pre-existing append-only comparison for repeated exploratory `—` IDs. Independent comparison keyed by `(tc_reference,title)` verifies all282 prior cases and their exact attempt prefixes remain intact; all294 current records have unique identities and valid resolution evidence. No history was deleted or rewritten. The checker limitation remains open for the QA tooling owner; it is not a product test failure.

## Retained load evidence and original acceptance IDs

Published scored run [42319897777](https://github.com/firatkill/bidlock/actions/runs/42319897777), PR#54 merge40c95ef, and [T-43 diagnosis](T-43-diagnosis.md) retain the accepted closure evidence. FR-95/FR-96 workflow/artifact/schema/result publication is covered by TC-260–271; D-83 cap20 and500 post-close responses by TC-264; D-89/D-90 per-VU identity and short rate transaction by TC-281/282; D-91 bounded profile stop path by TC-283. Historical root cause `t41-docker-storage` (TC-265/266) is resolved.

Original M6 acceptance cases TC-272–275 are now verified and logged, with detailed T-44 cases TC-284–290. Test titles carry both sets of IDs. No designed case is omitted.

The external checker also passes all non-history checks on a temporary uniquely keyed exploratory-entry view. That view has no Git history; the independent exact-prefix comparison above supplies the append-only verification. The real ledger and installed checker are unchanged.
