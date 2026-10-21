# M2 — API, identity and rate limits QA report

Date: 2026-10-21. Scope: T-18–T-25. Sources: [test cases](test-cases.md), [append-only results](test-results.json), PRD and TRD. All 43 M2 cases have automated coverage. Final verification and CI are recorded below.

## Resolved cases

| Case   | Requirement    | Title                                                                       | Automation                                                                      |
| ------ | -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| TC-127 | NFR-41; NFR-42 | Database function wrappers parse all app-callable results                   | [repo.int.test.ts](../tests/integration/repo.int.test.ts)                       |
| TC-128 | NFR-41; FR-51  | SQL integer and response boundaries reject unsafe or unexpected values      | [repo.int.test.ts](../tests/integration/repo.int.test.ts)                       |
| TC-129 | FR-36; FR-51   | Demo gates precede Origin and parsing                                       | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-130 | FR-85          | Mutating Origin validation                                                  | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-131 | FR-51          | JSON media type and body limit                                              | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-132 | FR-51          | Params and query boundaries                                                 | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-133 | FR-81          | Request ids and structured request log                                      | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-134 | FR-51          | Errors map to documented envelope                                           | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-135 | FR-20          | Signed session round trip                                                   | [session.test.ts](../tests/unit/session.test.ts)                                |
| TC-136 | FR-20          | Session rejects tampering and malformed fields                              | [session.test.ts](../tests/unit/session.test.ts)                                |
| TC-137 | FR-20; D-35    | Session time bounds                                                         | [session.test.ts](../tests/unit/session.test.ts)                                |
| TC-138 | FR-20          | Session rotation and sliding renewal                                        | [session.test.ts](../tests/unit/session.test.ts)                                |
| TC-139 | FR-22          | Name normalization                                                          | [names.test.ts](../tests/unit/names.test.ts)                                    |
| TC-140 | FR-22          | Name length and character validation                                        | [names.test.ts](../tests/unit/names.test.ts)                                    |
| TC-141 | FR-22          | Human names cannot impersonate bots                                         | [names.test.ts](../tests/unit/names.test.ts)                                    |
| TC-142 | FR-22          | Profanity normalization                                                     | [names.test.ts](../tests/unit/names.test.ts)                                    |
| TC-143 | FR-20; FR-21   | Guest creation and cookie attributes                                        | [api-me.int.test.ts](../tests/integration/api-me.int.test.ts)                   |
| TC-144 | FR-24          | Deleted guest recovery                                                      | [api-me.int.test.ts](../tests/integration/api-me.int.test.ts)                   |
| TC-145 | FR-22; FR-50   | Rename authenticated guest                                                  | [api-me.int.test.ts](../tests/integration/api-me.int.test.ts)                   |
| TC-146 | FR-25          | Guest creation limit maps to HTTP                                           | [api-me.int.test.ts](../tests/integration/api-me.int.test.ts)                   |
| TC-147 | FR-37          | Proxy trust and XFF selection                                               | [ip.test.ts](../tests/unit/ip.test.ts)                                          |
| TC-148 | FR-37          | IPv6 privacy prefix                                                         | [ip.test.ts](../tests/unit/ip.test.ts)                                          |
| TC-149 | FR-37; NFR-30  | Salted IP hash shape                                                        | [ip.test.ts](../tests/unit/ip.test.ts)                                          |
| TC-150 | FR-46; FR-50   | State response and conditional ETag                                         | [api-read.int.test.ts](../tests/integration/api-read.int.test.ts)               |
| TC-151 | FR-50          | State not-found and sandbox visibility                                      | [api-read.int.test.ts](../tests/integration/api-read.int.test.ts)               |
| TC-152 | FR-50          | Bid pagination                                                              | [api-read.int.test.ts](../tests/integration/api-read.int.test.ts)               |
| TC-153 | FR-50          | Lobby response                                                              | [api-read.int.test.ts](../tests/integration/api-read.int.test.ts)               |
| TC-154 | FR-04; FR-50   | Accepted bid and replay HTTP mapping                                        | [api-write.int.test.ts](../tests/integration/api-write.int.test.ts)             |
| TC-155 | FR-50; FR-51   | Bid rejection details                                                       | [api-write.int.test.ts](../tests/integration/api-write.int.test.ts)             |
| TC-156 | FR-04          | Idempotency mismatch HTTP mapping                                           | [api-write.int.test.ts](../tests/integration/api-write.int.test.ts)             |
| TC-157 | FR-37          | Bid rate-limit HTTP mapping                                                 | [api-write.int.test.ts](../tests/integration/api-write.int.test.ts)             |
| TC-158 | FR-11          | Payment success and rejection                                               | [api-write.int.test.ts](../tests/integration/api-write.int.test.ts)             |
| TC-159 | FR-20; FR-50   | Mutation authentication                                                     | [api-write.int.test.ts](../tests/integration/api-write.int.test.ts)             |
| TC-160 | FR-52; D-40    | Disabled test routes are indistinguishable from unknown paths               | [api-test-routes.int.test.ts](../tests/integration/api-test-routes.int.test.ts) |
| TC-161 | FR-52          | Authorized test support                                                     | [api-test-routes.int.test.ts](../tests/integration/api-test-routes.int.test.ts) |
| TC-162 | FR-82          | Health success and failure                                                  | [api-test-routes.int.test.ts](../tests/integration/api-test-routes.int.test.ts) |
| TC-163 | FR-52          | Static test-route guard                                                     | [guards.test.ts](../tests/unit/guards.test.ts)                                  |
| TC-164 | FR-86; FR-87   | Nonce CSP construction                                                      | [csp.test.ts](../tests/unit/csp.test.ts)                                        |
| TC-165 | FR-86          | CSP forwarded on request and response                                       | [csp.test.ts](../tests/unit/csp.test.ts)                                        |
| TC-166 | FR-36          | Off mode page rewrite                                                       | [csp.test.ts](../tests/unit/csp.test.ts)                                        |
| TC-167 | FR-86; FR-87   | Production build nonce application                                          | [csp.mjs](../tests/acceptance/csp.mjs)                                          |
| TC-168 | FR-20; FR-51   | Session route authentication checks signatures and existing bidder identity | [http.test.ts](../tests/unit/http.test.ts)                                      |
| TC-169 | FR-37; FR-51   | Rate-limited HTTP responses round Retry-After up to seconds                 | [ip.test.ts](../tests/unit/ip.test.ts)                                          |

## Pending decision

None. D-51 approved moving prerequisite session/IP helpers to the first tasks that needed them, with dedicated acceptance still performed in T-20/T-21. D-52 disables Next's automatic agent-rule edits; no product behavior changed.

## Manual test required

None within M2. Local Next cookie acceptance ran in T-20. T-25's production HTML/header check and Chromium console check are reproducible with `node tests/acceptance/csp.mjs` against a production server on localhost:3100. These checks do not replace later two-browser realtime, countdown/closing, mobile or accessibility review.

## Requirement coverage

- Verified at the M2 layer: database result boundaries; guest identity and recovery (FR-20–FR-22, FR-24–FR-25); IP hashing and rate responses (FR-37); read privacy/pagination (FR-46); bid/payment HTTP mapping (FR-04, FR-11); request IDs, health and Origin protection (FR-81, FR-82, FR-85); test-route secrecy (FR-52); CSP construction/forwarding and offline rewrite (FR-36, FR-86).
- Partially verified across the whole product: FR-50/FR-51 contracts are verified for implemented routes; sandbox creation and bot-token HTTP endpoints remain T-34. Bot credentials deliberately return 401 until then. FR-36's read-only banner and the full UI remain M3. FR-80 logging is verified for the implemented wrapper; future endpoints remain subject to the same checks. FR-87's current JSX escapes content; future user-facing UI and the permitted state-machine SVG still need their own checks.
- Not yet verified by M2: browser auction/payment flows, real Supabase Broadcast, production cron and hosting, mobile/keyboard/screen-reader behavior, bundle budgets and load/benchmark claims. These are planned later; no overall product acceptance claim is made.
- Every M2 case has its PRD reference and TRD test/section reference in the case design. Direct route-handler integration is the plan's M2 acceptance layer; Playwright E2E-01 remains T-33.

## Regressions and audit trail

No unresolved M2 regression and no retractions. All failed attempts remain in the ledger with passing retests. Corrections covered generic Zod result typing, strict lint, a signed-timestamp template conversion, a rate fixture using outdated column names, a narrow test-secret literal type, the installed Next matcher-helper name and a callback lint requirement. The final suite also exposed a 1 ms host/container clock difference: the test now compares database-clock readings, preserving the SQL clock contract without relaxing timeouts.

## Root cause groups

TC-127/TC-128 shared the repository-result generic typing issue. TC-129–TC-134 shared the initial HTTP test/lint cleanup. Both groups are resolved; no remaining shared failure. Other corrections were isolated fixture or tooling issues.

## Verification limits and compatibility

- All traffic was local. No hosted resources, keys, DNS or production data were changed; no load run occurred. OWNER-DECISIONS keeps k6 in CI for M6.
- Next 16.4.2 recognizes `src/proxy.ts`. The production build renders pages dynamically. Next serves the standalone build through `pnpm start` despite its warning, and nine framework/hydration scripts carry the matching nonce; Chromium reported no CSP or runtime errors.
- `.next/app-build-manifest.json` is absent. T-33 must use E2E-09 for NFR-15 as already allowed by A-10/D-33. The theme script and full shell belong to T-26.
- Only static guard rule 1 is implemented in T-24; later guard rules remain tied to their owning tasks.

## Final verification

Local final checks pass: 74 unit tests, 363 pgTAP assertions, 43 integration tests (9.83 seconds), lint, typecheck, static guards and production build. The local Chromium nonce acceptance passes. T-25 PR CI pending. T-18–T-24 PR CI passed before each local owner-authored merge. See [progress](../docs/PROGRESS.md) for commit and CI links.
