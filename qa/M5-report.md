# M5 QA report — Settlement

Status: T-37 merged with green CI; T-38 local automated verification passed; final PR CI pending. One visual subcheck remains unverified. T-39 has not started.

## Resolved

| Case   | Behavior                                         | Evidence                               |
| ------ | ------------------------------------------------ | -------------------------------------- |
| TC-228 | Winner payment                                   | E2E-04 and live Chrome payment         |
| TC-229 | Runner-up at own highest bid; winner strike      | E2E-04 and live runner-up payment      |
| TC-230 | All closed-state viewer copy                     | Settlement DOM matrix                  |
| TC-231 | Pending payment, errors, retry and rate limits   | Payment DOM tests; owner-approved D-57 |
| TC-232 | Lobby notices and refreshed strikes              | Lobby DOM and settlement E2E           |
| TC-233 | Once-per-offer announcement and public successor | Settlement DOM and E2E-06              |
| TC-234 | Late bid extension                               | E2E-05 focused pass                    |
| TC-235 | Public room, benchmark and successor navigation  | E2E-06 focused pass                    |

T-37 passed 167 unit tests, 17 browser tests, production polling build, lint, typecheck, guards and [all six CI jobs](https://github.com/firatkill/bidlock/actions/runs/39929845587). T-38's focused tests, 167 unit tests, lint, typecheck and ledger integrity pass. Its first full browser run passed 18/19; the sandbox profile-load timing failure passed unchanged on focused retest. The second full run failed the overly narrow scheduled countdown expectation; 8 parallel tests passed and 10 isolated tests did not run. After owner approval D-58, both focused commands passed (10 and 11 tests including dependencies), lint/typecheck and 167 unit tests passed, and the final full E2E run passed all 19 tests across both projects. PR CI pending.

## Pending decision

None. TC-205 is resolved by owner-approved D-58 (2026-11-06): scheduled countdown is present, at most 1:00 and within 3 seconds of server remaining time, with disabled controls and unchanged timeouts. D-57 records approved payment error copy. No runtime dependency or external service was added.

## Manual test required

TC-236 is **partially verified**. Desktop and 360px mobile settlement panels, actual simulated winner/runner payments, amounts, bid history and empty browser error logs were observed. [Mobile evidence](evidence/M5-mobile.jpg) and [live review notes](M5-browser-plan.md).

The transient “Closing…” frame was not captured during two natural countdown-to-winner observations. It remains an owner/manual follow-up in docs/PROGRESS.md. Deterministic DOM coverage passes, but that does not replace live visual evidence. No claim of complete manual sign-off is made.

## Regressions and audit trail

No confirmed unresolved product regression. Existing shell/history unit cases failed under heavy host load and passed unchanged after environment recovery, then passed the full suite. Every attempt remains in the ledger. New test fixes addressed strict async lint, an existing mock missing profile refresh, and the required Node JSON import attribute. No assertions or timeouts were weakened; no cases were retracted.

## Root causes and advisory review

Synthetic server-clock jumps retain older lowest-RTT samples by the documented clock algorithm. The live fixture was reloaded after its jump; E2E-05 reloads after the jump and before bidding, retaining exact 0:29/0:30 countdown assertions. No production clock behavior changed. Legacy cumulative failure advisories remain visible; affected cases passed a real retest. Bound Vitest worker count under host pressure; preserve Playwright's four parallel workers and subsequent isolated project.

## Acceptance coverage

| Reference           | Cases                  | Result                                                                    |
| ------------------- | ---------------------- | ------------------------------------------------------------------------- |
| FR-11, FR-15, US-07 | TC-228, TC-231, TC-232 | Automated and live payment verified                                       |
| FR-12, FR-13, US-08 | TC-229, TC-232         | Automated and live runner payment verified                                |
| FR-09, FR-14, FR-66 | TC-230, TC-236         | State/copy matrix verified; transient closing visual subcheck outstanding |
| FR-31, NFR-21       | TC-233, TC-235         | Successor and announcement DOM/E2E checks verified                        |
| FR-07, FR-65, US-06 | TC-234                 | Focused extension flow verified                                           |
| FR-30               | TC-235                 | Public-room entry and bid response verified                               |
| NFR-20              | TC-236                 | 360px layout verified; no horizontal overflow                             |

## Limits

Local polling only. Hosted Broadcast, production deployment and load benchmarks remain later work. No production traffic or fabricated benchmark values. Global test clock, viewport and QA tabs/server were restored after live review. The project-wide PDF remains an end-of-project deliverable.

Final CI review: initial run passed five functional/build jobs; static checks found two final document-formatting differences. Corrected both and passed ESLint plus tracked-file Prettier verification. Unfiltered local Prettier also finds unrelated ignored owner `.codex-prompts` artifacts, retained unchanged. Failure/retest evidence is recorded in the ledger. Final CI is tracked on [PR #38](https://github.com/firatkill/bidlock/pull/38).
