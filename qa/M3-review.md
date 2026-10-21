# M3 QA review

Verdict: **not ready to close**. D-56 is approved and verified locally; TC-207 still requires green PR CI. T-34 has not started.

| Check                  | Verdict and evidence                                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger integrity       | Pass: integrity checker succeeds; no removed cases or attempts. Owner checkpoint reference replaces ClickUp under AGENTS.md.                                                                                                                 |
| Designed-case coverage | All 41 M3 cases TC-170–TC-210 have ledger entries; 40 resolved, TC-207 awaiting CI.                                                                                                                                                          |
| Automation             | Automatable cases map to unit, integration or E2E tests. Fourteen E2E cases cover HTTP contracts, two bidders, accessibility, keyboard, mobile, rate limits, states, budget and deferred-name-dialog regression.                             |
| Retesting              | Failed cases retain failures followed by actual passing retests. TC-207 remains open until the corrected workflow passes CI.                                                                                                                 |
| Escalations            | D-56 owner question approved in conversation and recorded in PRD; no outstanding owner questions.                                                                                                                                            |
| Manual review          | TC-174 and TC-208 completed locally. Hosted Broadcast remains explicitly unverified. Natural countdown and closed controls were observed; transient Closing frame was not captured visually.                                                 |
| Audit trail            | No n/a cases, deletions, skipped tests, relaxed assertions or raised timeouts. Test request format corrected against TRD 10.6.                                                                                                               |
| Attempt advisories     | TC-188/197/199/200 have cumulative failures across implementation stages, all resolved. TC-206 failed twice on the same pre-optimization build, then passed after lazy dialog loading. No current unresolved three-consecutive-failure case. |
| Skill improvement      | See notes below; no skill files changed.                                                                                                                                                                                                     |

## Agent improvement notes

- Format new tests before full lint and keep static-check findings distinct from functional failures in the ledger.
- Read the exact HTTP contract alongside the E2E scenario before constructing requests; idempotency belongs in the body and initial success is 201.
- Playwright dependency projects can run their full test set during a filtered invocation. Use explicit project plus `--no-deps` for focused isolated checks.
- Await asynchronous dialog loading and test semantic focus restoration without relying on an obsolete DOM node.
- CI build configuration needs the same validation requirements as runtime configuration. The repository's approval checkpoint applies to correcting the workflow specification.

The milestone report is a current status report, not a completion certificate. Update this review after successful CI.
