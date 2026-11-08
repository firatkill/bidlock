# Changelog

## v1.0.0 — prepared, not released

- Live timed auctions with SQL-enforced bidding, idempotency, capped anti-sniping extensions and exactly one winner.
- Simulated payment windows, runner-up offers, public rooms and browser-owned sandbox bots.
- Broadcast updates in production, polling fallback, synchronized countdowns and accessible responsive layouts.
- pgTAP, concurrency, unit, Playwright and CI load verification; published benchmark retains the accepted D-92 p95 gap and `thresholds.passed=false`.
- README architecture, exact benchmark table, dated deployment evidence and local two-bidder demo GIF (D-99).
- Production mobile Lighthouse on 2026-11-08 after `da57813`: Performance 100, Accessibility 100, Best Practices 100.

Tagging and GitHub publication await owner approval after the README PR is reviewed and merged. A-05 remains open until after 2026-11-15; other unverified release gates are listed in the [release checklist](docs/IMPLEMENTATION_PLAN.md#release-checklist-v100).
