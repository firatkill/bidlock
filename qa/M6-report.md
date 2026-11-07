# M6 QA report — accepted closure (D-92)

T-39–T-43 complete; T-44 is outside this milestone and remains todo. Published scored run [42319897777](https://github.com/firatkill/bidlock/actions/runs/42319897777), PR #54 merge40c95ef. This is acceptance of a documented p95 gap, not a passing latency benchmark.

Source: [test-results.json](test-results.json), [test-cases.md](test-cases.md), [T-43 diagnosis](T-43-diagnosis.md). Full failed-attempt history remains intact.

## Resolved

| Case   | Title                                                             | Evidence                                             |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------- |
| TC-255 | Production container build and healthy non-root runner            | Passing latest ledger attempt; see retained history. |
| TC-256 | Load migration targets only bidlock_load                          | Passing latest ledger attempt; see retained history. |
| TC-257 | Database-only command and load profile isolation                  | Passing latest ledger attempt; see retained history. |
| TC-258 | Build context excludes local data but retains benchmarks          | Passing latest ledger attempt; see retained history. |
| TC-259 | Small load launcher reaches expected missing-script boundary      | Passing latest ledger attempt; see retained history. |
| —      | T-39 CI E2E setup interruptions                                   | Passing latest ledger attempt; see retained history. |
| TC-260 | k6 defaults, overrides and local target guards                    | Passing latest ledger attempt; see retained history. |
| TC-261 | Independent bidders and setup summary                             | Passing latest ledger attempt; see retained history. |
| TC-262 | Replay and outcome classification under load                      | Passing latest ledger attempt; see retained history. |
| TC-264 | Soft close cap and post-deadline exercise                         | Passing latest ledger attempt; see retained history. |
| TC-265 | Verifier checks every invariant and persists results              | Passing latest ledger attempt; see retained history. |
| TC-266 | Verifier fails corrupted or insufficient runs                     | Passing latest ledger attempt; see retained history. |
| TC-267 | Benchmark schema and factual report                               | Passing latest ledger attempt; see retained history. |
| TC-268 | Report filenames and local no-commit mode                         | Passing latest ledger attempt; see retained history. |
| TC-269 | Lobby reads measured benchmark data                               | Passing latest ledger attempt; see retained history. |
| TC-270 | Scheduled/manual load workflow and artifacts                      | Passing latest ledger attempt; see retained history. |
| TC-271 | Result PR and failed-threshold reporting                          | Passing latest ledger attempt; see retained history. |
| TC-276 | Load-only diagnostics preserve isolation and sensitive data       | Passing latest ledger attempt; see retained history. |
| TC-278 | Composed SQL bid entry point preserves outcomes and rate counters | Passing latest ledger attempt; see retained history. |
| TC-280 | Ramped workload and scored diagnostic isolation                   | Passing latest ledger attempt; see retained history. |
| TC-281 | Stable synthetic per-VU load IPs                                  | Passing latest ledger attempt; see retained history. |
| TC-282 | Short rate transaction before auction lock                        | Passing latest ledger attempt; see retained history. |
| TC-283 | Bounded load-only Node and pool profiling                         | Passing latest ledger attempt; see retained history. |

## Known accepted gap

TC-263 / NFR-10: published p95=269.233384 ms exceeds250 ms. p99=329.68857432 ms meets600 ms. Status remains open; D-92 accepts T-43 closure and publication with thresholds.passed=false. Follow-up is recorded under PROGRESS Open questions. No further dispatch or tuning authorized.

## Pending Decision

None awaiting a decision for M6 closure; the known NFR-10 gap was explicitly accepted.

## Manual Test Required

None outstanding for M6. T-42 owner's browser review preceded PR #43; this publication changed data and documentation, not product copy or layout.

## Audit trail

- TC-277: D-86 explicitly abandons the pool4 hypothesis after its failed measurements; all failure evidence retained. It is no longer the target configuration.
- TC-279: D-90 supersedes the one-call requirement with two statements; TC-282 covers replacement. Historical attempts retained.

## Regressions and root causes

Recorded root-cause groups: {'t41-docker-storage': ['TC-265', 'TC-266']}. The measured single-auction lock/pool waiting is documented in D-91/D-92 and the diagnosis. No historic failure was erased.

## Requirement coverage

- NFR-10: partially met; p99 passes, p95 fails and remains an accepted gap (TC-263).
- NFR-11/NFR-12: verified zero unexpected errors and zero violations across16 invariant checks (TC-263/TC-264/TC-265).
- FR-95/FR-96: workflow dispatch, artifact, factual schema/report and result PR publication verified (TC-260–TC-271).
- D-83 timing: cap20 plus500 post-close responses verified (TC-264).
- D-89/D-90: per-VU identity, unchanged SQL outcomes, rate-lock release and concurrency verified (TC-281/TC-282).
- D-91: bounded profile verified; measurements took the stop path instead of replicas (TC-283).
- D-92: published unchanged JSON with false threshold flag; neutral copy, accepted-gap documentation and task closure verified.

## Validation

Latest implementation CI: all six jobs green on PR #55 after a font-build retry. Local publication checks include lint, typecheck, unit tests and guards; generated SUMMARY required Markdown alignment only, with all cells and both JSON files verified unchanged. No new load dispatch, SQL change or production tuning.
