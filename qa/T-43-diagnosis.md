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
