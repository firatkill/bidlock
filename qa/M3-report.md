# M3 QA report — UI and real-time

Status: **complete**. T-26–T-33 are implemented and verified. All 41 M3 cases are resolved; the approved D-56 CI correction passes PR CI. Stopped before T-34.

## Evidence

- Local: 143 unit tests with coverage gate, 14 Playwright tests, lint, typecheck, guards and production build pass. T-32 also passed 363 pgTAP assertions and 44 concurrency/integration tests.
- Playwright uses 90-second test and 3-second expect limits; four-worker parallel tests precede one-worker isolated tests. Public-room visitors and shared rate-limit checks are isolated.
- E2E-09 enforces the unchanged 180 KiB transfer budget; the initial failure was fixed by loading the name dialog on Edit. Name save/focus regressions pass.
- A-08 verified locally. A-10: next start serves the standalone build with a warning; absent Turbopack manifest follows approved D-33 fallback.
- [T-32 CI](https://github.com/firatkill/bidlock/actions/runs/39624426166) passed. [T-33 CI](https://github.com/firatkill/bidlock/actions/runs/39626318945) failed: documented workflow lacks required build-time environment variables. Database tooling, pgTAP and integration jobs passed.
- [Final T-33 CI](https://github.com/firatkill/bidlock/actions/runs/39630388760) passes all six jobs after D-56. Earlier failed CI remains part of the audit trail.
- Live Chrome/Brave review: independent guest bids synchronized, correct outbid/history state, readable 360px controls, natural countdown through server closure, no Chrome console errors. Test clock and viewport restored; QA tabs closed. See [browser plan](M3-browser-plan.md).

## Resolved

41 cases resolved. Complete append-only attempts: [ledger](test-results.json).

| Case   | Title                                                                 | Current result                                                                       |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TC-170 | Shell identity and navigation                                         | Passed; evidence in ledger                                                           |
| TC-171 | Name dialog validation and save                                       | Passed; evidence in ledger                                                           |
| TC-172 | Theme persistence and nonce                                           | Passed; evidence in ledger                                                           |
| TC-209 | Browser error reporting contains only a confirmed ID                  | Passed; evidence in ledger                                                           |
| TC-210 | Client transport validates responses and renews missing sessions once | Passed; evidence in ledger                                                           |
| TC-173 | Shell read-only and error states                                      | Passed; evidence in ledger                                                           |
| TC-174 | Shell visual and keyboard review                                      | Passed; evidence in ledger                                                           |
| TC-175 | Integer money formatting                                              | Passed; evidence in ledger                                                           |
| TC-176 | Dollar input acceptance and rejection                                 | Passed; evidence in ledger                                                           |
| TC-177 | Clock samples and countdown                                           | Passed; evidence in ledger                                                           |
| TC-180 | Live announcement throttling                                          | Passed; evidence in ledger                                                           |
| TC-178 | Snapshot and change ordering                                          | Passed; evidence in ledger                                                           |
| TC-179 | Bid reconciliation and extensions                                     | Passed; evidence in ledger                                                           |
| TC-181 | Polling snapshots and ETags                                           | Passed; evidence in ledger                                                           |
| TC-182 | Polling failure and recovery                                          | Passed; evidence in ledger                                                           |
| TC-183 | Polling visibility and terminal behavior                              | Passed; evidence in ledger                                                           |
| TC-184 | Lot and price states                                                  | Passed; evidence in ledger                                                           |
| TC-185 | Countdown conditions                                                  | Passed; evidence in ledger                                                           |
| TC-186 | Extension banner lifecycle                                            | Passed; evidence in ledger                                                           |
| TC-187 | Connection and load states                                            | Passed; evidence in ledger                                                           |
| TC-188 | Quick and custom bidding                                              | Passed; evidence in ledger                                                           |
| TC-190 | Bid failure copy and retry identity                                   | Passed; evidence in ledger                                                           |
| TC-191 | Stale minimum and rate countdown                                      | Passed; evidence in ledger                                                           |
| TC-192 | Bid panel state gates                                                 | Passed; evidence in ledger                                                           |
| TC-189 | Bid keyboard shortcuts                                                | Passed; evidence in ledger                                                           |
| TC-193 | Bid history paging and labels                                         | Passed; evidence in ledger                                                           |
| TC-194 | Broadcast subscription and validation                                 | Passed; evidence in ledger                                                           |
| TC-195 | Broadcast fallback and safety refresh                                 | Passed; evidence in ledger                                                           |
| TC-196 | Lazy broadcast module loading                                         | Passed; evidence in ledger                                                           |
| TC-197 | Public room lobby states                                              | Passed; evidence in ledger                                                           |
| TC-198 | Sandbox card states                                                   | Passed; evidence in ledger                                                           |
| TC-199 | Offer notices and benchmark content                                   | Passed; evidence in ledger                                                           |
| TC-200 | Lobby feed handoff                                                    | Passed; evidence in ledger                                                           |
| TC-203 | Automated accessibility and keyboard                                  | Passed; evidence in ledger                                                           |
| TC-201 | HTTP browser-context contract                                         | Passed; evidence in ledger                                                           |
| TC-206 | Production initial script budget                                      | Passed; evidence in ledger                                                           |
| TC-202 | Two bidders stay synchronized                                         | Passed; evidence in ledger                                                           |
| TC-204 | Mobile overflow reduced motion and polling transport                  | Passed; evidence in ledger                                                           |
| TC-205 | Rate-limited and scheduled browser states                             | Passed; evidence in ledger                                                           |
| TC-207 | CI build and polling E2E gate                                         | Passed; [CI evidence](https://github.com/firatkill/bidlock/actions/runs/39630388760) |
| TC-208 | Live two-browser countdown and mobile review                          | Passed; evidence in ledger                                                           |

## Pending decision

None. D-56 is approved and verified; no outstanding owner questions.

## Manual test required

No outstanding local manual cases. TC-174 shell and TC-208 two-browser/countdown/mobile review completed. Hosted Supabase Broadcast remains unverified; the local review uses polling. The transient Closing frame was not captured visually; its copy/behavior has deterministic unit coverage. Winner/payment UI remains scheduled for M4.

## Regressions and audit trail

No unresolved product regressions or retracted cases. Deferred name-dialog loading required DOM tests to preload module transformation during setup and await module arrival and assert focus on the visible Edit control; all validation and save assertions remain.

## Root causes and advisory review

- T-27 shared feed contract and T-30 newest-100 history behavior were corrected with owner approval (D-54/D-55).
- T-32 test syntax/formatting, future typed links and recursive callback lint findings were fixed and retested.
- T-33 harness peer mismatch resolved with explicit development-only playwright-core at the runner version; fixture callback naming and HTTP request format were corrected against the specs.
- Initial bundle budget failure was a product payload issue, resolved without relaxing the limit. A dependency-triggered run remeasured the old build once; focused isolated runs now use --no-deps.
- TC-171/172 encountered delayed unit loading and follow-on failures during a heavily loaded local run. Module transformation is now preloaded in unit setup; focused and full retests pass without increased timeouts. The browser regression still exercises cold deferred loading.
- D-56 corrects the documented CI environment gap; both build configurations and all 14 browser tests pass locally. [PR CI](https://github.com/firatkill/bidlock/actions/runs/39630388760) passes all six jobs.

## Acceptance coverage

Coverage is scoped to M3 portions of FR/NFR/user stories. Later payment, bots, deployment and load-test requirements are not claimed complete.

| Reference | Cases                                  | Verification |
| --------- | -------------------------------------- | ------------ |
| D-19      | TC-196                                 | Verified     |
| D-30      | TC-200                                 | Verified     |
| D-53      | TC-209                                 | Verified     |
| FR-07     | TC-179                                 | Verified     |
| FR-11     | TC-199                                 | Verified     |
| FR-20     | TC-201                                 | Verified     |
| FR-22     | TC-171                                 | Verified     |
| FR-24     | TC-210                                 | Verified     |
| FR-36     | TC-173                                 | Verified     |
| FR-37     | TC-191, TC-205                         | Verified     |
| FR-40     | TC-177, TC-185, TC-208                 | Verified     |
| FR-41     | TC-177                                 | Verified     |
| FR-45     | TC-194, TC-208                         | Verified     |
| FR-46     | TC-181, TC-183, TC-196, TC-204         | Verified     |
| FR-47     | TC-178, TC-179, TC-181, TC-193         | Verified     |
| FR-48     | TC-182, TC-183, TC-194, TC-195         | Verified     |
| FR-51     | TC-210, TC-201                         | Verified     |
| FR-52     | TC-201                                 | Verified     |
| FR-60     | TC-197, TC-198, TC-199, TC-200         | Verified     |
| FR-61     | TC-184                                 | Verified     |
| FR-62     | TC-184                                 | Verified     |
| FR-63     | TC-176, TC-188, TC-190, TC-191, TC-202 | Verified     |
| FR-64     | TC-185, TC-192                         | Verified     |
| FR-65     | TC-186                                 | Verified     |
| FR-67     | TC-187, TC-192, TC-205                 | Verified     |
| FR-68     | TC-170, TC-171                         | Verified     |
| FR-71     | TC-189                                 | Verified     |
| FR-72     | TC-170, TC-172                         | Verified     |
| FR-73     | TC-170, TC-209, TC-173                 | Verified     |
| FR-80     | TC-209                                 | Verified     |
| FR-85     | TC-209, TC-201                         | Verified     |
| FR-86     | TC-172                                 | Verified     |
| FR-92     | TC-207                                 | Verified     |
| NFR-15    | TC-206                                 | Verified     |
| NFR-20    | TC-174, TC-203, TC-208                 | Verified     |
| NFR-21    | TC-180                                 | Verified     |
| NFR-22    | TC-174, TC-203                         | Verified     |
| NFR-23    | TC-204                                 | Verified     |
| NFR-41    | TC-175, TC-176, TC-188                 | Verified     |
| US-01     | TC-197                                 | Verified     |
| US-02     | TC-202                                 | Verified     |
| US-03     | TC-198                                 | Verified     |
| US-04     | TC-202                                 | Verified     |
| US-05     | TC-190                                 | Verified     |

## Limits

No production traffic, hosted Realtime delivery, load testing, deployment or real benchmark figures were used. Benchmark JSON remains the specified empty marker. The diagram tool reports an older optional Playwright peer; diagram generation is deferred to T-44. CI passed on task commit `effabbb`; M3 closes at this review.
