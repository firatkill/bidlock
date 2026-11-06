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
