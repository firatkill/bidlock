# M0 — Setup QA report

Date: 2026-10-21. Scope: T-01–T-04. Local acceptance and final T-04 PR checks passed. M0 is complete.

## Resolved

Source: [case design](test-cases.md) and [append-only results](test-results.json). All 13 M0 cases have passing results. The separate repository-setup ledger entry also passed.

| TC     | Behavior                                      | Evidence                                          |
| ------ | --------------------------------------------- | ------------------------------------------------- |
| TC-001 | Strict toolchain and server-only test alias   | Passing attempts in ledger; automation map below. |
| TC-002 | Static CI                                     | Passing attempts in ledger; automation map below. |
| TC-003 | Required environment and secret validation    | Passing attempts in ledger; automation map below. |
| TC-004 | Production test-variable refusal              | Passing attempts in ledger; automation map below. |
| TC-005 | Origin allowlist and cache                    | Passing attempts in ledger; automation map below. |
| TC-006 | Structured redacted logs                      | Passing attempts in ledger; automation map below. |
| TC-007 | Error status mapping                          | Passing attempts in ledger; automation map below. |
| TC-008 | Postgres and pgTAP availability               | Passing attempts in ledger; automation map below. |
| TC-009 | Repeatable migration with checksum protection | Passing attempts in ledger; automation map below. |
| TC-010 | Status and dry-run                            | Passing attempts in ledger; automation map below. |
| TC-011 | Reset host and database safety                | Passing attempts in ledger; automation map below. |
| TC-012 | Environment SQL safety and substitutions      | Passing attempts in ledger; automation map below. |
| TC-013 | Migration transaction rollback                | Passing attempts in ledger; automation map below. |

## Automation and acceptance coverage

- TC-001: `tests/unit/smoke.test.ts` and the T-01 acceptance commands (frozen install, lint, typecheck, unit, guards, build).
- TC-002: `.github/workflows/ci.yml` static job, verified on each task PR.
- TC-003–TC-005: `tests/unit/env.test.ts` (TRD §5, T-02 acceptance).
- TC-006: `tests/unit/log.test.ts` (FR-80 / TRD §14).
- TC-007: `tests/unit/errors.test.ts` (UT-09 status map and copy keys). HTTP/DB result-to-error mapping and actual UI copy are later-task work, not claimed verified here.
- TC-008: CI database-tooling assertions and local T-03 commands (FR-90 infrastructure, A-07).
- TC-009–TC-013: `tests/integration/migrate.int.test.ts` (D-05/D-22/D-34, TRD §6.1, T-04 acceptance).

All M0 acceptance areas were exercised locally. PRD FR-51, FR-52, FR-85, FR-88, FR-90 and FR-96 are only partially implemented at this milestone: API/authentication, test routes, runtime database privileges, auction SQL and later CI jobs remain in the plan. No whole-product correctness claim is made.

Final local verification: 17 unit tests and eight migration integration tests pass; lint, typecheck, guard skeleton, production build, migration status/dry-run, default test reset and explicit dev reset pass. The container has PostgreSQL 17.11, pgTAP 1.3.4 and pg_prove. There were no other clients on the project databases before integration testing; the scratch database was created and removed by the suite.

## Pending decision

None. GitHub and isolated local database operations were approved (D-44/D-45). Frankfurt and CI-only load execution remain the owner's existing decisions.

## Manual test required

None within M0. Realtime in two browsers, countdown/closing, mobile layout, accessibility and production performance belong to later milestones.

## Regressions and audit trail

No regressions or retractions. Failure histories are retained: shared package-cache permissions, Docker credential-helper stalling, and strict-lint findings. Successful retests follow each resolved failure. No tests were weakened, skipped or deleted.

## Root cause groups

`integration-test-lint`: TC-009, TC-011 and TC-012 shared strict typing/callback lint findings. All passed after narrowing matcher values and using block callback bodies.

## Verification limits

- No auction SQL functions exist yet; DB-01–DB-15 and INT-01/INT-02 have not run. pgTAP availability is verified, not auction correctness.
- No API or auction flow exists yet; Playwright and browser QA have not run.
- The guard command is the T-01 skeleton, not the final security guard implementation.
- `db:tick`/`db:ticker` are implemented but cannot exercise `bidlock.tick()` until T-12.
- Production environment/cron SQL is committed from the TRD but has not been applied. No Supabase/Vercel/DNS resources were created.
- No load tests were run and no benchmark numbers were generated.
- Node 22 clean-clone release verification remains a T-48 requirement; M0 was tested on Node 24.

## CI evidence

All four task PRs passed before merge. [Final T-04 CI](https://github.com/firatkill/bidlock/actions/runs/39565265815) passed both static checks and the database-tooling/integration job on `b2b1c27`.
