# M4 QA review

Verdict: **local QA complete; T-36 PR CI pending**. T-37 has not started.

| Check                  | Verdict and evidence                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger integrity       | Pass: ledger integrity checker succeeds; all attempts retained. No ClickUp/Slack under repository override.                                         |
| Designed-case coverage | All 17 cases TC-211–TC-227 have entries and passing local attempts.                                                                                 |
| Automation             | TC-211–TC-224 map to token, API-write, scheduler and runner tests; TC-225/226 map to component/E2E checks. TC-227 is the live browser case.         |
| Retesting              | Failed assertions/static checks have explicit causes and subsequent real passing runs; no status-only resolution.                                   |
| Escalations            | No owner questions or pending decisions.                                                                                                            |
| Manual review          | TC-227 passed through Chrome/mobile and native Brave; hidden note inspected while its native tab was inactive.                                      |
| Audit trail            | No n/a cases, deleted attempts, skipped requirements, weakened assertions or increased timeouts.                                                    |
| Attempt advisories     | M4 failures were fixture/strict-lint issues and resolved. Legacy cumulative advisories remain in the ledger; none blocks M4.                        |
| Scope                  | No runtime dependencies, SQL rules, external services or production traffic added by T-35/T-36. Hosted deployment/load evidence remains later work. |

## Agent improvement notes

- Validate typed fixture restoration before passing values back to SQL.
- Compare ISO instants, not serialization differences, and read the documented response schema before asserting fields.
- Keep asynchronous lifecycle checks after awaited work; helper functions avoid incorrect static narrowing of mutable closure flags.
- Require repeated bot bids in pacing tests; a single timestamp cannot verify spacing.
- Do not treat a controlled browser's visibility emulation as real hidden-tab evidence. Native browser state plus persisted bid counts and the hidden DOM message verified the actual behavior.

No QA skill changes were necessary. Final closure requires green T-36 CI and an updated progress record.
