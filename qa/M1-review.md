# M1 — QA milestone review

Date: 2026-10-21. Reviewed after [M1-report.md](M1-report.md). Closure is pending the T-17 mutation decision and PR CI.

| Check                | Verdict                  | Evidence                                                                                                                                                    |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger integrity     | Pass                     | Installed ledger checker passes; 127 entries including setup, no removed cases or attempts.                                                                 |
| Case coverage        | Pass within M1           | TC-014–TC-126 all have actual passing functional runs. TC-122 acceptance remains pending.                                                                   |
| Automation           | Pass                     | Every M1 TC ID occurs in its mapped SQL or TypeScript test. Report links all 113 cases to source. No skipped, todo or focused tests.                        |
| Retesting            | Pass                     | Earlier failures remain and have passing retests; no status-only resolutions.                                                                               |
| Escalations          | Pending                  | TC-122 links the owner decision in progress under the repository override. Earlier D-47 decision is retained as history; D-49 deferred assertions now pass. |
| Manual verification  | Not applicable within M1 | Browser flows, real Broadcast delivery and mobile layout are future milestone work.                                                                         |
| Audit trail          | Pass                     | No retractions or removed attempts. TC-022 fixture regression and its successful retest are retained.                                                       |
| Attempt advisories   | Pass                     | No case has three consecutive failures; ledger checker reports no stuck-case advisory.                                                                      |
| Skill/process review | Notes below              | No skill edit needed; coverage and test isolation lessons retained.                                                                                         |

## Product findings

All local SQL correctness checks pass. The mutation assumption in T-17 does not hold: the lifecycle function also takes the auction lock. This blocks completion of T-17 until the owner approves a corrected check and it is executed. API, browser, production and load verification remain outside M1.

## Agent and skill improvement notes

- Reserve an app connection before the state read in each concurrent bidding attempt. Otherwise every read can queue before the first write, producing an artificially stale workload; preserve all specified assertions.
- Global public-room fixtures must call the transactional clean helper, even when they previously passed after a database reset.
- Allow Docker bind-mounted files to synchronize before executing newly written SQL. One partial read recovered without changing the complete file.
- Keep requirement coverage scoped to the implemented layer: local realtime stubs do not prove Supabase delivery, and SQL identity tests do not prove cookie authentication.

## Closure

Not ready to close: owner mutation decision and T-17 PR CI remain. T-18 has not started.
