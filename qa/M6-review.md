# M6 QA review

2026-11-07. [Milestone report](M6-report.md). Implementation ready for owner UI review; not merged and milestone not declared closed.

| Check             | Verdict and evidence                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger integrity  | Needs attention: external checker collides on historical exploratory `—` IDs. Independent keyed append-only comparison passed all282 prior cases; no deleted history. |
| Coverage          | T-44 original TC-272–275 and detailed TC-284–290 all logged. M6 load/build/verifier/report/workflow cases retained. TC-263 remains an accepted p95 gap, not a pass.   |
| Automation        | TC-284–289 covered by DOM, cache unit and E2E tests. TC-290 verified visually with stored screenshots.                                                                |
| Retesting         | Mobile overflow, SVG label clipping and stale-cache observations have actual passing retests. Final39-test E2E run passed.                                            |
| Escalation        | D-92 owner acceptance recorded in PRD/PROGRESS; no ClickUp/Slack per repository rules. D-93 resolves prior wording checkpoint.                                        |
| Manual checks     | 375px light/dark and1440px desktop inspected locally. Owner UI review/merge still required.                                                                           |
| Audit trail       | TC-277/TC-279 retraction reasons retained; failed load runs and all existing attempts preserved.                                                                      |
| Attempts advisory | Load-tuning failures explain D-92; thresholds/locks unchanged. Local lint/format iterations fixed without weakening checks.                                           |

## QA tooling improvements

Use `(tc_reference,title)` rather than the sentinel `—` alone for exploratory-entry identity in the plugin’s history comparison. This is a known external checker defect; no plugin files were changed. Test cache expiry semantics, not just a framework revalidate option. Normalize Mermaid styles before checking both theme rendering and label fit. Run formatter after ledger writes.

## Closure

Owner UI review and merge remain pending. NFR-10 stays an explicit accepted gap. The external ledger-checker collision remains a tooling limitation. Do not start T-45 or claim the load thresholds passed.
