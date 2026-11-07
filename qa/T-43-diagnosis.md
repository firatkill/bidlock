# T-43 diagnosis — owner checkpoint

Owner authorization: D-82 (2026-11-07). Source: [failed run 42310825613](https://github.com/firatkill/bidlock/actions/runs/42310825613), artifact `bench-42310825613`, its k6 summary, verification result, Compose logs, and complete GitHub run log. Source commit: `99ab16e`. No rerun or local reproduction was needed to prove the timing contradiction. No result numbers or PR #45 were edited.

## Measured latency and workload

| Measurement                                   |                 Failed CI run |
| --------------------------------------------- | ----------------------------: |
| Bid requests                                  |                        33,874 |
| Replays                                       |                 1,687 (4.98%) |
| Accepted HTTP outcomes / unique bids          |                     246 / 235 |
| BID_TOO_LOW / RATE_LIMITED                    |                32,315 / 1,313 |
| AUCTION_CLOSED                                |                             0 |
| Bid mean / p95 / p99                          | 238.93 / 406.83 / 1,029.53 ms |
| All-HTTP mean duration / waiting for response |            235.48 / 235.34 ms |
| All-HTTP mean sending / receiving             |            0.0649 / 0.0752 ms |
| All-HTTP p95 waiting / p99 waiting            |          405.43 / 1,021.91 ms |
| All-HTTP mean blocked / connecting            |            0.6672 / 0.6378 ms |
| Mean iteration duration                       |                     889.61 ms |
| Reported request rate                         |                 543.86 bids/s |
| Unexpected errors / replay mismatches         |                         0 / 0 |
| Invariant violations                          |        0 across all 16 checks |
| Extensions                                    |                      12 of 20 |
| thresholds.passed                             |                         false |

All-HTTP metrics include 500 setup guest requests and one auction creation as well as the 33,874 bids. About 99.94% of mean HTTP duration is waiting for the response; this includes server work, scheduling and transport, not solely PostgreSQL execution. Blocked/connecting metrics are separate from HTTP duration; do not subtract percentiles to derive a component breakdown. Bid p95/p99 fail the configured 250/600 ms limits.

The script matches TRD pacing: 0.35–0.95 s sleep (mean 650 ms) and a 5% replay probability after a stored response exists. Mean bid duration plus expected sleep is approximately 889 ms, matching the observed iteration mean. The configured request mix is therefore present; this is not evidence for changing pacing. The 60-second per-bidder production rate limit remains active; 1,313 rate-limited outcomes are observed, but the artifact does not distinguish burst and sustained limits.

## What can and cannot be attributed

- **App versus PostgreSQL:** Compose sets LOG_LEVEL=warn, so request duration/db_ms records are absent. Even if enabled, existing db_ms excludes the authentication getMe call and includes client queueing plus round-trip time for the wrapped calls. There is no defensible app/SQL percentage split in this artifact.
- **Database work:** each bid authenticates via getMe, calls check_bid_rate, then calls place_bid unless rate-limited. These are three sequential database statements for eligible bids. In the workload, check_bid_rate updates the same IP bucket for all VUs despite its raised limit. This is a second serialization point in addition to the protected auction-row lock. Its actual wait contribution was not sampled.
- **Lock waits:** place_bid retains SELECT FOR UPDATE and reads time after acquisition. PostgreSQL logs contain no slow-statement entries at the configured 1,000 ms cutoff. This does not rule out substantial sub-second lock waits or multiple shorter statements per HTTP request. No pg_stat_activity samples or log_lock_waits measurements were captured.
- **Pool:** all calls share postgres.js max=20. Five hundred VUs do not mean 500 simultaneous database calls because of think time. Pool queue saturation is plausible but unmeasured. Raising max blindly could increase lock contention and CPU overhead; lowering it could reduce backend contention while increasing queue delay.
- **CPU/event loop:** the report identifies four AMD EPYC virtual CPUs shared by app, db and k6. There are no container CPU, throttling or Node event-loop measurements. CPU contention remains a hypothesis, not an established cause.
- **Logging/validation:** info logs are already suppressed before redaction/serialization; env validation is cached. Accepted results are parsed more than once, but only 246 accepted HTTP outcomes occurred. No profile establishes JSON validation as the latency bottleneck, and boundary validation must remain.

Evidence paths: src/server/http.ts; src/app/api/auctions/[id]/bids/route.ts; src/server/db.ts; src/server/repo/me.ts; src/server/repo/bids.ts; src/server/log.ts; src/server/env.ts; src/server/ip.ts; db/migrations/0005_place_bid.sql; db/migrations/0008_rate_limits.sql; db/env/load.sql; docker/compose.yml; load/bid-storm.js. Codebase-memory skill was loaded; graph tools were unavailable, so findings use direct source reads.

## Why the cap and post-close phase are missed

The SQL correctly implements FR-07. At extension time t, ends_at becomes t+12. The next eligible window starts at (t+12)-10 = t+2. Bids during those two seconds cannot extend, regardless of throughput.

With the initial 45-second deadline, the first extension cannot precede auction age 35 seconds. For extension n, the lower bound is 35 + 2(n-1):

| Extension | Earliest auction age | Earliest new deadline |
| --------- | -------------------: | --------------------: |
| 1         |                 35 s |                  47 s |
| 12        |                 57 s |                  69 s |
| 13        |                 59 s |                  71 s |
| 20        |                 73 s |                  85 s |

These are ideal lower bounds; time until the next accepted bid pushes them later. The scenario begins shortly after auction creation, not at its exact timestamp. The original setup has no long intentional delay after creation that could make an 85-second auction fit into the 60-second bidding phase. The observed 12 extensions and zero AUCTION_CLOSED responses are consistent with these bounds. The verifier can close the auction afterward, explaining its final closed status without post-close workload samples. Exact extension timestamps are not in the artifact.

TRD §15.6.2 incorrectly says all 20 extensions are consumed within one second of the first window and close occurs near 47 seconds. This cannot be repaired by pool tuning or faster bidding. It is independent of the latency failure. TC-264 requires an owner-approved specification correction.

## Proposed next step — not implemented

1. **Recommended timing correction:** approve load-only extend_by_s=10 with snipe_window_s=10, retaining AUCTION_S=45, cap=20, 500 VUs, 60 s and ubuntu-latest. After an extension the window is immediately eligible again, allowing 20 accepted window bids followed by closing within the run if they arrive promptly. This changes the TRD-fixed load shape, so requires owner approval; it does not change SQL rules. Update the spec's timing explanation and workload tests together. Do not claim guaranteed closure timing independent of accepted bid arrivals.
2. **Alternative:** retain the current workload and revise TC-264 to separate cap/post-close lifecycle coverage from the 60-second performance benchmark. This also changes acceptance and needs approval. Increasing duration would conflict with the owner's fixed 60 seconds and is not proposed.

Before selecting a latency fix, collect a bounded diagnostic profile: separate timings for authentication/rate/place_bid and aggregate Node event-loop delay; sample pg_stat_activity wait_event_type/wait_event and blockers; collect container CPU/throttling; use lower slow-statement and lock-wait logging only in the isolated load configuration. Compare pool behavior under the same workload. Avoid exporting SQL parameter values, cookies, session secrets or raw IPs. Local profiles can identify code costs but cannot establish CI performance. CI attribution requires runner measurements; never present local measurements as a CI breakdown.

No pool/resource/app change is justified as a proven fix by the current artifact alone. No fix PR or new dispatch was made because AGENTS.md owner checkpoint 2 applies to the false timing assumption. Original workflow PR #44 is merged at 99ab16e; bot PR #45 remains open and unmerged. T-43 remains blocked; T-44 has not started. There are no after measurements.

Documentation validation: pnpm lint, pnpm typecheck, pnpm test:unit (214 passed) and pnpm check:guards passed. Runtime files are unchanged.

## Approved timing correction and diagnostic evidence (D-83/D-84)

[Instrumentation PR #46](https://github.com/firatkill/bidlock/pull/46) merged as `df22752` after all six [CI jobs](https://github.com/firatkill/bidlock/actions/runs/42312876353) passed. [Diagnostic run 42313175983](https://github.com/firatkill/bidlock/actions/runs/42313175983) is the first of the two additionally authorized dispatches. Artifact `bench-42313175983` contains 33,329 per-request samples, 62 event-loop samples, 180 PostgreSQL activity snapshots and container CPU/throttling. Sampler errors are empty (PostgreSQL stderr only a newline). PostgreSQL logs contain zero parameter-detail lines. Diagnostic [PR #47](https://github.com/firatkill/bidlock/pull/47) remains unmerged; #45 head remains `61bb96f21c7592d842d693f45fb4d6e8ea0a1f03`.

The corrected 10-second extension reached 20/20 extensions and 500 AUCTION_CLOSED outcomes. Result: 33,329 bids, 1,685 replays, 263 accepted HTTP outcomes (249 unique bids), p95 241.3247772 ms, p99 726.37423376 ms, unexpected errors0, all16 invariant checks0, thresholds.passed=false (p99). This fixes the timing coverage but does not establish a latency fix.

| Per-request phase           | Mean ms |  p95 ms |  p99 ms |
| --------------------------- | ------: | ------: | ------: |
| Handler total               |  84.373 | 237.165 | 604.183 |
| getMe                       |  25.371 |  88.574 | 176.734 |
| check_bid_rate              |  21.977 |  75.729 | 134.181 |
| place_bid                   |  36.855 |  97.811 | 221.269 |
| Total minus measured phases |   0.170 |   0.239 |   0.372 |

Phase durations include client queueing, driver/network, SQL and result validation. They are not pure SQL durations. Only place_bid produced logged bid-path SQL durations above10 ms (18,118 statements; conditional mean19.95 ms, p99 51.39 ms, max102.11 ms). No get_me/check_bid_rate statement crossed that cutoff, despite much longer phase timings. This supports substantial time outside SQL execution, without assigning an exact native pool-queue duration.

Of sampled blocked backends, 1,175 were place_bid and one check_bid_rate. Auction tuple/transaction waits dominated; active backends reached the pool ceiling20 (snapshot p95=20). Thus the shared-IP limiter was not the measured bottleneck in this run. Per-phase pending-call maxima were65/70/84 for auth/rate/bid; these include queued and active calls and are not direct pool-queue counts.

The first two seconds of handler completions had p99 700.90 ms (1,316 requests), versus243.04 ms in seconds2–10,420.95 ms in seconds10–35, and205.57 ms in seconds35–50. This locates a substantial tail in initial contention; HTTP includes additional time outside the handler and is the authoritative acceptance metric.

Docker CPU samples (100%=one core): app mean81.55%, p95 117.91%; db mean96.65%, p95 128.02%; k6 mean30.29%, p95 50.90%. All sampled cgroup nr_throttled/throttled_usec counters were0 and CPU quotas were unlimited. Event-loop utilization p95=.934; delay histogram mean20.64 ms includes its20 ms sampling resolution, maximum observed delay126.75 ms. Node is busy, but neither global four-core saturation nor quota throttling is established by these samples. Profiling itself adds overhead; final comparison retains it.

## Smallest measured fix (D-85)

Reduce load-only DB_POOL_MAX from20 to4. With a single auction serialization point, twenty backends do not permit twenty concurrent bids to commit; the sample shows many waiting on that lock. Four connections limit simultaneous lock contenders and backend overhead while permitting other statements to progress. The exact value is a conservative tuning hypothesis, not a measured optimum; driver queueing may increase. Only the one authorized final dispatch can establish whether end-to-end p95/p99 improve. No SQL, rate-limit semantics, locks, constraints, indexes, workload pacing, dependencies or production settings change.

## Final authorized run — pool reduction failed

Fix [PR #48](https://github.com/firatkill/bidlock/pull/48) merged as `880d155` after six green [CI jobs](https://github.com/firatkill/bidlock/actions/runs/42313828024). The first E2E job failed during the Next font build before tests (`next/font/google queries have exactly one entry`); the production-build job passed on the same commit. The failed-jobs rerun API returned HTTP500 without starting a run; a targeted job rerun succeeded without source changes. This CI retry did not consume a load dispatch.

[Final run 42314282647](https://github.com/firatkill/bidlock/actions/runs/42314282647) is the second and last dispatch authorized by D-84. It failed both latency thresholds. Artifact `bench-42314282647` uploaded (872,476 bytes); FullBenchResult parses and confirms actual pool4. Bot [PR #49](https://github.com/firatkill/bidlock/pull/49) changes exactly bench/results/2026-11-06.json, bench/results/latest.json and bench/SUMMARY.md. It remains unmerged. No result has been published; #45 and diagnostic #47 remain open, unchanged and unmerged.

| Metric                            | Original pool20 / extension12 | Diagnostic pool20 / extension10 | Final pool4 / extension10 |
| --------------------------------- | ----------------------------: | ------------------------------: | ------------------------: |
| Bids                              |                        33,874 |                          33,329 |                    21,788 |
| Replays                           |                         1,687 |                           1,685 |                     1,066 |
| Accepted HTTP outcomes            |                           246 |                             263 |                       124 |
| Unique accepted bids              |                           235 |                             249 |                       117 |
| p95 ms                            |                        406.83 |                          241.32 |                    896.46 |
| p99 ms                            |                      1,029.53 |                          726.37 |                  1,529.86 |
| Unexpected error rate             |                             0 |                               0 |                         0 |
| Invariant violations (16 checks)  |                             0 |                               0 |                         0 |
| Extensions / post-close responses |                        12 / 0 |                        20 / 500 |                  20 / 500 |
| thresholds.passed                 |                         false |                           false |                     false |

Final per-request mean618.411 ms comprises getMe206.747, check_bid_rate200.989, place_bid210.379 and residual0.295 ms. The handler p99 was1,074.883 ms; authoritative HTTP p99 includes work before/after the handler. Every phase became slower, despite reduced backend contention. Only19 place_bid SQL statements crossed10 ms (max22.939 ms); none of the rate/auth statements did. This is strong evidence of waiting outside SQL execution (including driver queue/scheduling), not a reason to change auction locking or rate-limit rules.

Activity snapshots decreased from180 to165: blocked place_bid observations1175→53; total active-backend observations1791→355; hence blocked place_bid was about65.6%→14.9% of active observations. These are sampled states, not complete wait durations. Final active-backend p95=4, matching the new pool limit. Per-phase pending-call maxima rose from65/70/84 to179/214/273. The smaller pool reduced concurrent lock contention but caused much larger awaiting-call backlogs and lowered measured throughput. Four was not a successful tuning choice.

Final Docker CPU means: app94.47%, db91.92%, k630.01%; all sampled throttling counters remained0. Event-loop utilization p95=.913 and largest sampled delay107.28 ms; the20 ms histogram resolution remains part of the mean delay. These samples do not isolate native pool queue time from Node/driver scheduling costs. Instrumentation was retained across both runs; different runner instances and stochastic arrivals also limit causal precision.

**Owner checkpoint:** both permitted dispatches have been used. Recommend restoring load pool20 (the better measured configuration) and authorizing focused client/driver scheduling plus cold-start profiling before another fix/run. Alternatively retain pool4 and investigate it further, accepting that it is currently substantially worse. No threshold, VU, runner, SQL invariant, lock or workload change is proposed. No further modification or dispatch is made without approval. Pool4 remains on main from the authorized fix merge; documentation does not silently revert it. T-43 remains blocked and T-44 untouched.

## D-86–D-88 single-call/ramp measurement — stop before scored run

[PR #50](https://github.com/firatkill/bidlock/pull/50) merged as `d3bc583` after six green [CI jobs](https://github.com/firatkill/bidlock/actions/runs/42316110169). Initial E2E stopped in the recurring Next font build error before tests; targeted CI rerun passed without source changes. Local validation passed221 unit tests,437 pgTAP assertions (74 in the new parity file),51 concurrency/integration tests including INT-01/INT-02, production build and33 E2E tests. These tests establish contract parity/correctness, not performance.

D-86 restored pool20; D-87 composed get_me/check_bid_rate/place_bid into one SQL transaction used by production and load; D-88 added10 s ramp and diagnostics opt-in. [Measurement run42316538127](https://github.com/firatkill/bidlock/actions/runs/42316538127) used diagnostics=true. It is the first of the latest two authorized dispatches. It failed both thresholds and is worse than the earlier pool20 diagnostic baseline, although better than the failed pool4 experiment. Under the measurement gate, **the scored dispatch was not started**.

| Metric                                | Three calls, pool20, constant500 | Three calls, failed pool4 | Single call, pool20, ramp10s |
| ------------------------------------- | -------------------------------: | ------------------------: | ---------------------------: |
| Bids                                  |                           33,329 |                    21,788 |                       22,755 |
| Replays                               |                            1,685 |                     1,066 |                        1,167 |
| Accepted HTTP / unique bids           |                        263 / 249 |                 124 / 117 |                    150 / 145 |
| p95 ms                                |                           241.32 |                    896.46 |                       641.86 |
| p99 ms                                |                           726.37 |                  1,529.86 |                       753.51 |
| Unexpected errors                     |                                0 |                         0 |                            0 |
| Invariant violations                  |                                0 |                         0 |                            0 |
| Extensions / AUCTION_CLOSED responses |                         20 / 500 |                  20 / 500 |                     20 / 500 |
| thresholds.passed                     |                            false |                     false |                        false |

The original pre-timing-correction run remains in the earlier table (p95=406.83/p99=1029.53, cap12 and no post-close responses). The new measurement is also worse on p95 than that original, while better on p99. The most relevant prior comparison is pool20 with the corrected10 s extension and diagnostics enabled:641.861405 vs241.3247772 ms p95, and753.5082123 vs726.37423376 ms p99. This is not an isolated A/B experiment: workload ramp and SQL transaction structure both changed, and runners differ; the observed regression is sufficient to stop, not to attribute an exact causal percentage.

### Measured breakdown

- 22,755 handler samples: mean429.332 ms, p95 634.021, p99 745.185. The combined submit_bid phase mean429.050 ms, p95 633.747, p99 744.879; residual application work mean0.282 ms. Phase duration includes driver waiting, network, SQL and result parsing, not just server execution.
- 14,461 SQL statements above the10 ms logging cutoff: conditional mean52.476 ms, p95 139.005, p99 206.195, max475.404. This truncated sample cannot be subtracted from the full handler mean to calculate exact pool queue time.
- 147 database snapshots:1,065 active transaction-ID lock observations,486 LockManager lightweight-lock observations, and3 tuple-lock observations.1,028 sampled sessions had blockers; active backend p95=20. Pending submit_bid calls reached288 (p95=256); this is awaiting calls, not the driver's native queue length.
- All54 emitted PL/pgSQL wait-context occurrences identify rate_hit → check_bid_rate → submit_bid. The composed transaction retains rate-counter locks while doing bid work. Since each VU has a separate bidder and one in-flight request, the shared-IP counter is the likely common rate-lock hotspot. The samples identify submit_bid as a whole and do not prove that every wait was on that counter.
- Docker mean CPU: app77.74%, PostgreSQL122.94%, k634.17% (100%=one core). All sampled throttling counters are0. Event-loop utilization p95=.886, largest sampled delay81.527 ms. No quota throttling was observed.

The single-call change removed round trips but lengthened the rate-counter critical section: those locks now last through place_bid and commit. The evidence supports increased rate/lock-manager contention plus client awaiting backlogs. No SQL rule, threshold or lock was changed to make the run pass.

Artifact `bench-42316538127` uploaded (695,758 bytes); FullBenchResult validates vus500,duration60,ramp_up_s10,pool20,extension10,all16 invariant checks0. Logs have zero parameter-detail lines. Bot [PR #51](https://github.com/firatkill/bidlock/pull/51) changes only bench/results/2026-11-07.json, bench/results/latest.json and bench/SUMMARY.md and remains unmerged. #45/#47/#49 remain unchanged and open. No benchmark is published and no scored numbers exist.

**Owner options:** authorize revisiting the single-transaction composition so rate-counter locks can be released before auction work (recommended for design investigation), or retain the composed transaction and authorize deeper lock/driver profiling before another change. Either path needs an explicit decision before more work/runs. Main currently retains the approved pool20, single-call path and10 s ramp. The unused scored dispatch has not been spent; the measurement stop condition prevents using it automatically. T-43 blocked; T-44 untouched.

## D-89/D-90: remove artificial IP contention and release rate locks

Owner approved both changes on 2026-11-07. D-87 run42316538127 p95=641.861405/p99=753.5082123 ms regressed against pool20 three-call baseline241.3247772/726.37423376 ms. Handler mean429.332 ms versus submit_bid429.050 ms (other0.282 ms). All54 logged lock contexts traverse rate_hit/check_bid_rate/submit_bid. The load app's TRUST_PROXY=none maps every request to local, serializing the shared IP counter; the combined transaction holds it through auction processing.

D-89 sets only the load Compose app to TRUST_PROXY=vercel and gives each k6 VU a stable distinct private address, including guest creation. The result records per-vu-forwarded. D-90 replaces the route call with prepare_bid (existing get_me/check_bid_rate), committed before separate unchanged place_bid. Production uses this transaction boundary too. No rate-rule logic, auction lock, clock, limits, thresholds or pacing changes. Migration0014 is additive;0013 is unchanged.

New TC-281 covers all500 identities and load-only settings; TC-282 covers every prior SQL outcome/rate counter plus replay, grants, ordered route calls and independent rate-lock availability. Diagnostic sampler labels prepare_bid separately. Pool20, ramp10, extension10 remain. At most two new dispatches: measurement never published; scored only after comparison to the pool20 three-call baseline.

## D-89/D-90 measurement: stop before scored dispatch

[Fix PR #52](https://github.com/firatkill/bidlock/pull/52) merged as 8b957bce45d85cca6bfdd04b774657092f04b87d after all six [CI jobs](https://github.com/firatkill/bidlock/actions/runs/42318978463) passed. Initial CI rejected formatting in appended QA evidence; corrected in d7465cf before the green run. Local validation: lint/typecheck/225 unit/guards,511 pgTAP,52 integration (INT-01/INT-02), build and33 E2E passed.

[Measurement run42319246136](https://github.com/firatkill/bidlock/actions/runs/42319246136) used default500 VUs,60 s, ramp10, pool20, extension10 and per-vu-forwarded, with diagnostics on. The run failed p95. Artifact bench-42319246136 uploaded (1,340,238 bytes), full schema parsed, all16 invariant counts zero. [Bot PR #53](https://github.com/firatkill/bidlock/pull/53) head1544a76f50d28e186a3ee2d5d36a58f38a182ff4 changes only bench/results/2026-11-07.json, latest.json and bench/SUMMARY.md; remains unmerged.

| Measurement                       | Pool20 three-call baseline42313175983 | D-87 single call42316538127 | D-90 two calls, per-VU IP42319246136 |
| --------------------------------- | ------------------------------------: | --------------------------: | -----------------------------------: |
| Bids                              |                                33,329 |                      22,755 |                               27,674 |
| Replays                           |                                 1,685 |                       1,167 |                                1,376 |
| Accepted HTTP / unique bids       |                              263 /249 |                    150 /145 |                             215 /203 |
| p95 ms                            |                           241.3247772 |                  641.861405 |                          336.6236303 |
| p99 ms                            |                          726.37423376 |                 753.5082123 |                          415.7450225 |
| Unexpected error rate             |                                     0 |                           0 |                                    0 |
| Invariant violations              |                                     0 |                           0 |                                    0 |
| Extensions / post-close responses |                               20 /500 |                     20 /500 |                              20 /500 |
| thresholds.passed                 |                                 false |                       false |                                false |

p95 increased39.49% versus the required three-call baseline; p99 decreased42.77%. Baseline used constant500 VUs; current run uses the owner-approved10 s ramp. These are real separate CI runs, not a controlled causal comparison. The explicit owner gate nevertheless requires stopping on this p95 regression. No scored dispatch was made, and none of the five result PRs #45/#47/#49/#51/#53 was merged or edited. No benchmark published; T-43 remains blocked.

### Where the time went

All27,674 request records were captured. Handler mean171.109 ms splits into prepare_bid79.317 ms, place_bid91.524 ms and other0.268 ms. Phase p95 values are166.682 and184.455 ms, respectively (not additive percentiles). PostgreSQL samples:169 snapshots,936 blocked place_bid observations, zero blocked prepare_bid observations;895 tuple-lock and72 transaction-ID wait observations in place_bid. No rate_hit/check_bid_rate lock-log contexts remain;9857 place_bid contexts do. The artificial rate-counter hotspot is removed.

The >10 ms PostgreSQL log captures15,211 place_bid statements, conditional mean21.409 ms/p9535.988/max112.872, versus only9 prepare_bid statements over10 ms (mean13.834/max18.779). These are threshold-selected, unpaired server durations: they cannot be subtracted from full request averages to claim an exact pool wait. The much larger app phase durations include pool waiting, event-loop scheduling, round trips and parsing.

Pending phase counts (not a native pool queue): prepare maximum104/p9597.25; place maximum134/p95114.40. Event-loop utilization p95=.9886, max=.9915; interval maximum delay p9537.19 ms, absolute max61.80 ms. Mean container CPU: app84.61%, database91.88%, k632.04%; no nonzero throttling among172 sampled counters. CPU percentages use Docker's one-core=100% convention and are not total-runner utilization. Diagnostic lock logging itself produces substantial output; scored-mode performance cannot be inferred without authorization to cross the failed gate. Parameter-detail log lines0; sampler stderr empty except one PostgreSQL newline.

### Owner checkpoint

Options: (A) authorize a bounded profile separating Node CPU/pool scheduling from diagnostic lock-log overhead before choosing another fix (recommended); (B) explicitly waive this measurement p95 gate and authorize the remaining diagnostics-off scored dispatch, retaining every fixed threshold/runner/load/SQL constraint; (C) pause T-43. No claim that either option will pass. The existing measurements establish auction-row contention plus client-side waiting/scheduling, but do not identify a justified next code change. The remaining scored dispatch is unused and must not run without the owner's new decision.

## Final scored dispatch under reviewer continuation

The reviewer removed the added baseline-regression gate and authorized the second and final D-89/D-90 dispatch, recorded in PROGRESS; no new owner decision ID, code or setting change. [Scored run42319897777](https://github.com/firatkill/bidlock/actions/runs/42319897777) ran main8b957bce45d85cca6bfdd04b774657092f04b87d with default inputs and diagnostics off. It failed only p95:269.233384 ms exceeds250 by19.233384 ms (7.69%). p99=329.68857432 ms passes600. Unexpected error and replay-mismatch thresholds pass.

| Metric                      | Three-call pool20 diagnostic | Two-call per-VU diagnostic | Two-call per-VU scored |
| --------------------------- | ---------------------------: | -------------------------: | ---------------------: |
| Run                         |                  42313175983 |                42319246136 |            42319897777 |
| Bids                        |                       33,329 |                     27,674 |                 28,925 |
| Replays                     |                        1,685 |                      1,376 |                  1,496 |
| Accepted HTTP / unique bids |                     263 /249 |                   215 /203 |               245 /229 |
| p95 ms                      |                  241.3247772 |                336.6236303 |             269.233384 |
| p99 ms                      |                 726.37423376 |                415.7450225 |           329.68857432 |
| Unexpected error rate       |                            0 |                          0 |                      0 |
| Invariant violations        |                            0 |                          0 |                      0 |
| Extensions / AUCTION_CLOSED |                      20 /500 |                    20 /500 |                20 /500 |
| thresholds.passed           |                        false |                      false |                  false |

Artifact bench-42319897777 uploaded (37,108 bytes), parsed with FullBenchResult. All16 invariant checks show0. Config confirms500 VUs/60 s/ramp10/pool20/extension10/per-vu-forwarded. Zero diagnostic records and no sampler files (out contains only k6-summary.json, verify.json, compose.log). [Bot PR #54](https://github.com/firatkill/bidlock/pull/54), headc13ef110285dc7379daf0752996c496586475ecf, changes only bench/results/2026-11-07.json, bench/results/latest.json and bench/SUMMARY.md. It remains unmerged. No numbers edited; no result published. Both authorized dispatches used. Prior failed/diagnostic PRs #45/#47/#49/#51/#53 remain open; no success exists to supersede them.

The scored run used an AMD EPYC7763 runner while the immediately preceding diagnostic used an Intel Xeon8573C, both ubuntu-latest with4 CPUs. Lower scored percentiles are consistent with reduced diagnostic overhead, but this comparison cannot isolate that overhead from runner variability. Scored mode deliberately has no per-phase/CPU samples; the last measured breakdown remains handler171.109 ms, prepare79.317 ms, place91.524 ms, other0.268 ms, with place_bid blockers and near-saturated event-loop intervals.

### Proposed bounded Node/pool profile — not authorized or run

Recommend one separately authorized60 s/500-VU diagnostic on the same unchanged load shape: capture a Node V8 CPU profile (no heap/request/parameter data), aggregate event-loop utilization and fixed-label operation durations, and instrument numeric timestamps at query enqueue, connection dispatch and completion to distinguish pool waiting from execution/return scheduling. First verify a supported postgres.js hook can expose dispatch timing; otherwise explicitly retain it as an estimate, never claim a native queue measurement. Use low-frequency pg_stat_activity wait samples and container CPU/throttle counters; keep verbose per-request and low-threshold SQL/lock logging off to reduce observer cost. Never emit query text, parameters, cookies or raw IPs. Preserve every fixed threshold, constraint and auction lock. Choose any subsequent fix only from this profile. Alternative: pause T-43. No extra dispatch is implied by this proposal.
