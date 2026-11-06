# Catalogue & Ledger review

## Before browser verification

Direct surfaces: lobby public/sandbox cards, compact lot plate, price/countdown/fuse, quick/custom bids, own rejected requests, sandbox experiments, receipt/lifecycle, responsive shell.

Adjacent surfaces: profile edit/theme toggle, feed refresh and outbid announcements, extension banner, payment and successor navigation. SQL rules, API contracts, idempotency and the global test clock must remain unchanged.

| Route / role         | Action                                   | Expected                                                                                                |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Lobby / guest        | Inspect desktop/mobile in light/dark     | Actual public state; three truthful bot personalities; empty benchmark hidden; no invented statistics   |
| Own room / bidder    | Inspect 1280×800; place/reject bid       | Quick buttons, price and countdown in viewport; server results shown; rejected row disappears on reload |
| Own room / mobile    | Scroll; open custom amount; use keyboard | Sticky controls remain usable; safe-area clearance; no obscured ledger; visible focus; ≥44px controls   |
| Sandbox / owner      | Race and replay on real public API       | Actual accepted/rejected responses; same-id replay; no public-room experiment panel                     |
| Result / winner      | Observe natural close and payment        | Known receipt fields only; correct current lifecycle step; payment behavior retained                    |
| All changed surfaces | Inspect console/network and axe          | No runtime/hydration errors; zero serious/critical axe results; no production requests                  |

## Deliberate differences from mockups

- Existing PRD typography, four-digit catalogue plates, full approved text and monetary cents remain; mockups' large display sizes, shortened mobile copy and two-digit lots are illustrative.
- No presence/viewer count, server-sync badge, test-count claims, replay feature or invented benchmark metrics.
- No invented lock waits or millisecond arrival differences in rejected rows/experiment output. Display only API facts; rejected rows have no accepted `placed_at` timestamp.
- Sniper personality includes its occasional opening bid, as required by TRD §12.1.
- Receipt omits total distinct bidders and close-trigger identity; neither exists in the response. Winning bid details require its actual history row; runner-up details require a returned rank-2 offer. No inferred missing data.
- `/how-it-works` layout and two-transaction timeline remain T-44 references; no content implemented here.
- Empty/missing benchmark hides the lobby band per D-61, overriding the mockup placeholder.

## Verification

Local Chromium screenshots inspected at 1280×800 and 390×844, light/dark. Real replay returned the same bid ID, payment reached Settled, and page-error logs were empty. Expanded mobile custom controls and rejected ledger were inspected after scrolling; no horizontal overflow. Visual review found and corrected desktop toggle visibility and mobile content clearance. PR remains unmerged for owner browser review. TC-236's earlier transient Closing-frame follow-up remains open.

The lobby does not add the mockup’s three-row bid preview because the lobby list contract returns summaries, not bid rows; live bid history remains in the room. Existing full approved hero/teaser copy is retained instead of mockup code snippets and abbreviated mobile text. Theme/profile/navigation controls remain available on mobile.

## Evidence

- [Desktop room](evidence/T-38a-room.png)
- [Expanded mobile controls and rejected row](evidence/T-38a-mobile-expanded.png)
- [Receipt, dark](evidence/T-38a-receipt-dark.png)
- [Sandbox replay, dark](evidence/T-38a-sandbox-dark.png)
- [Lobby](evidence/T-38a-lobby.png)

Axe checks cover live room, receipt and sandbox in light/dark; mobile controls are at least 44×44. Token contrast samples: muted light/ground 4.95:1, warn light/surface 5.37:1, ok light/ground 4.91:1, muted dark/surface 5.70:1, warn dark/surface 7.19:1, strip muted 8.91:1, stamp 5.37:1, primary light 7.53:1 and primary dark 7.88:1. No reduced-motion fuse transition.

Local static checks pass: lint, typecheck, 176 unit tests; database suite and 49 integration/concurrency tests pass. Compiler/lint feedback during development corrected callback bodies, a test error-code spelling, Testing Library options and Markdown formatting; no runtime assertions or timeouts weakened.

Full local E2E: 27/28 passed. TC-202’s legacy total-row assertion was corrected against D-66: exactly two accepted rows remain, with the rejected row visible only to its sender. Focused TC-202 retest passed. Full CI is the final regression gate; do not merge before owner browser approval.

QA ledger structural checks pass. The external checker reports a historical `—` identifier collision (5→1 attempts) already present at HEAD; an independent ordered comparison confirms every attempt prefix in all 238 prior cases is unchanged, with 12 new cases appended. No history was removed.

## Owner review fixes (2026-11-06)

Owner browser feedback supersedes the original typography/navigation departures above: larger desktop price/countdown and lobby heading, mobile one-row Menu header, content-height public card, filled sandbox action, numbered principles and bot-strip personalities are now required. F1–F7 and D1–D4 are tracked by D-70–D-72 and TC-249–TC-254. TC-236 is now a manual pass confirmed by the owner.

Verification plan: inspect desktop room price/countdown on the same row and quick buttons within 1280×800; inspect 375×812 collapsed dock ≤140px with price/countdown above it; open menu by keyboard and check theme/links; race/replay and observe factual run context and anchored rejection after newer bids. Preserve session-only rejects, server bid timestamps, rate-limit copy and public-room isolation. No API/SQL changes.

Local Chromium review confirmed F1–F7 and D1–D4 surfaces: 1280×800 desktop price/countdown, 375×812 mobile public/sandbox first load, Menu navigation, lobby hierarchy and real race output. No page errors. A real race also returned B accepted / A rejected; origins preserve the actual outcome, and the approved A-accepted/B-rejected explanation is conditional on that API result. In-app browser runtime was unavailable (missing plugin module); this review used standalone local Chromium.

New screenshots: [desktop](evidence/T-38a-review-room.png), [mobile](evidence/T-38a-review-mobile.png), [lobby](evidence/T-38a-review-lobby.png), [sandbox race](evidence/T-38a-review-race.png). Bot details now follow the bidding area so personalities cannot push the mobile countdown behind the dock.

Revision validation: lint/typecheck, 180 unit tests and production build pass. Full local E2E ran once: 21 passed, TC-205 failed only on a visual line break, 10 isolated tests blocked by project dependency. After normalizing whitespace (same time bounds), focused TC-205 passed and all 10 remaining isolated tests passed. Focused catalogue checks and axe light/dark passed. QA ledger retains all 250 previous case histories; external sentinel-ID collision remains unchanged. Final CI pending.

## Round 2 (2026-11-06)

Owner confirmed previous layout, origin, short-ID, run-snapshot, closed-controls and price-flash fixes. R1 supersedes the one-order explanation: D-70 and §9.3 now use actual winner/loser letters for exactly one acceptance and one 4xx. R2 extends TC-253 to ledger animation: the mount-time highest bid number excludes existing/older rows from flash. Verification checks both race orders, no animation after reload, and only the newly received ledger row animating after a bid. No layout, API or SQL changes.

Round-2 validation: 15 affected unit tests and two targeted E2E tests passed; final lint/typecheck, all 182 unit tests and all 33 E2E tests passed on the first full run. The browser test observes actual CSS animation-start events and running animations after reload; only the new row flashes after the next bid. Production build passes. Historical QA attempts remain intact; the external checker’s pre-existing exploratory sentinel collision is unchanged. CI pending.
