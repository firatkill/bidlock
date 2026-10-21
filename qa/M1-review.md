# M1 — QA milestone review

Date: 2026-10-21. Reviewed after [M1-report.md](M1-report.md). Owner decision D-50 is implemented; final restored-suite verification passes; updated PR CI is pending.

| Check                | Verdict                  | Evidence                                                                                                                             |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Ledger integrity     | Pass                     | Installed ledger checker passes; 127 entries including setup, no removed cases or attempts.                                          |
| Case coverage        | Pass within M1           | TC-014–TC-126 all have actual passing functional runs. TC-122 mutation acceptance passes under D-50.                                 |
| Automation           | Pass                     | Every M1 TC ID occurs in its mapped SQL or TypeScript test. Report links all 113 cases to source. No skipped, todo or focused tests. |
| Retesting            | Pass                     | Earlier failures remain and have passing retests; no status-only resolutions.                                                        |
| Escalations          | Pass                     | D-50 approved and verified. Earlier D-47 decision is retained as history; D-49 deferred assertions pass. No pending owner decision.  |
| Manual verification  | Not applicable within M1 | Browser flows, real Broadcast delivery and mobile layout are future milestone work.                                                  |
| Audit trail          | Pass                     | No retractions or removed attempts. TC-022 fixture regression and its successful retest are retained.                                |
| Attempt advisories   | Pass                     | No case has three consecutive failures; ledger checker reports no stuck-case advisory.                                               |
| Skill/process review | Notes below              | No skill edit needed; coverage and test isolation lessons retained.                                                                  |

## Product findings

The approved negative control detects unsafe bidding: removing both auction locks produces unique bid-number violations. The original functions are restored. A harness setup error and pool-cleanup timeout were corrected without weakening assertions or increasing timeouts. API, browser, production and load verification remain outside M1.

## Agent and skill improvement notes

- Reserve an app connection before the state read in each concurrent bidding attempt. Otherwise every read can queue before the first write, producing an artificially stale workload; preserve all specified assertions.
- Global public-room fixtures must call the transactional clean helper, even when they previously passed after a database reset.
- Allow Docker bind-mounted files to synchronize before executing newly written SQL. One partial read recovered without changing the complete file.
- Keep requirement coverage scoped to the implemented layer: local realtime stubs do not prove Supabase delivery, and SQL identity tests do not prove cookie authentication.

## Closure

Owner checkpoints are resolved. Restored-suite verification passes (363 pgTAP assertions, 37 unit tests, 19 integration tests in 9.70 seconds, lint and typecheck). Updated PR CI remains before merge. T-18 has not started.
