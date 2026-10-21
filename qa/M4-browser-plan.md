# M4 live browser plan

Direct surfaces: lobby sandbox creation, owner-only sandbox room, TTL header and bot strip. Adjacent surfaces: shared lobby card, bid panel/history, polling feed, identity and theme. Preserve integer money, API-only bots, one sandbox per owner, server-authoritative bidding and the 180 KiB public-room budget.

| Route / role              | Action                                                | Expected                                                                                                 |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`, local guest          | Start a sandbox                                       | Pending button, navigation to own room, expiry header, three persona chips and exact note                |
| `/a/:id`, sandbox owner   | Observe bids and place a human bid                    | BOT history rows and corresponding leader; accepted human bid updates leader; no relevant console errors |
| `/a/:id`, owner, 360px    | Inspect header, chips, note, history and controls     | Readable layout, wrapping chips, no overlap or horizontal overflow                                       |
| `/a/:id`, owner           | Move own tab to background, inspect its state, return | Bots paused and background note while hidden; resume only after a fresh snapshot                         |
| `/`, same owner           | Return to lobby                                       | Active sandbox card links to own room                                                                    |
| `/a/:id`, unrelated guest | Inspect API authorization (automated layer)           | 404; token issuer and bid binding remain owner-only                                                      |

Environment: local production polling build, test database on port 54329; own Chrome tab only. No hosted services or production traffic. Start with a clean local test database after automated checks finish. Close own tabs and stop own server after review.

The seeded browser flow uses the isolated project because it visits the shared public lobby, as AGENTS.md requires. It passed three consecutive local runs. The test explicitly induces a bot counterbid before checking same-bot timestamp spacing, avoiding a vacuous single-bid assertion.

## Observed result

All planned M4 live checks passed. Chrome verified desktop/mobile layout and accepted human bids; 360px viewport had no horizontal overflow. Native Brave verified background pause: five bids remained unchanged while hidden, then rose to seven after resuming, followed by the human bid. The exact paused paragraph was present in the native DOM inspector while its sandbox tab was inactive. The lobby returned to the owned sandbox.

Controlled Chrome continued reporting `visible` even after native tab switching, so no hidden-state claim relies on it. Chrome console had no warnings/errors. Brave reported a missing `/favicon.ico` (404); no M4 API failure was observed. Favicon artwork is not part of this milestone. The previous DevTools dock position and viewport were restored, own QA tabs closed, and own local server stopped.

The mobile control check used a fresh owned local SQL fixture after the first Chrome auction finished; both original sandbox creations were performed through the UI. No production data or service was used.

[Mobile acceptance screenshot](evidence/M4-mobile.jpg)
