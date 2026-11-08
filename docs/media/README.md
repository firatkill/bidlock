# Demo recording

`demo.gif`: 25 seconds, 1,200 × 683 pixels, 10 fps, looping; 3,102,717 bytes.

Recorded on 2026-11-08 from a local `pnpm build` / `pnpm start --port 3108` production build, using the dev database `bidlock` on local port 54329. `APP_ENV=test`, database `settings.env=test`, polling feed; two independent Playwright Chromium contexts at 720 × 820, named Alex and Sam. No browser chrome is captured. FFmpeg 8.0 combines their viewport videos side by side and encodes a 96-colour GIF. No new dependency was added.

Flow: lobby (0 s), room (about 3 s), Alex bids $10 (about 5 s), Sam outbids at $11 (about 7 s), Alex's late $12 bid extends the close (about 10 s), Alex wins (about 15 s), simulated payment (about 18 s). The remaining time holds the paid receipt.

Only the existing local `/api/test/auctions` and `/api/test/clock` facilities seed the auction and advance time. The recording resets the clock in `finally`; the database offset was verified as zero afterward. D-99 authorizes this local recording. Production received no scripted requests or bids.

Reviewer: view the GIF in the rendered README on the PR branch before merging. This polling recording does not establish production Broadcast acceptance.
