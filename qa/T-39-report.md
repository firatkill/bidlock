# T-39 app image and compose acceptance

M6 cases TC-255–TC-275 were designed before implementation; only T-39 TC-255–TC-259 were executed. T-40 has not started.

- Node: `node:24.22.2-bookworm-slim` in base and runner. k6: `grafana/k6:1.8.2`. Existing Postgres pin: `bidlock-postgres:17.11`, based on `postgres:17.11`. Tags verified through Docker Hub and successful pulls/builds.
- D-73 records exact image pins; D-74 records the owner-approved local smoke and safe app-only cleanup; D-75 extends D-56 with inline test/on build-only validation placeholders matching Compose runtime. Initial TRD build failure remains in the ledger.
- `bash tests/docker/app-image.sh` passed: app runs as `app`/1001, HEALTHCHECK becomes healthy, standalone/static/public/benchmark files present, migration leaves dev/test schema OIDs unchanged, private/local context excluded.
- Grep of runner `/app` found no build-placeholder secret markers or unused build DB marker; runner image environment and history contain no placeholder secrets. Runtime test auction endpoint also worked with Compose configuration.

Health response from the acceptance run:

```json
{
  "status": "ok",
  "db": "ok",
  "demo_mode": "on",
  "version": "dev",
  "server_now": "2026-11-06T21:34:43.579Z"
}
```

`VUS=5 DURATION=5s AUCTION_S=8 pnpm load:local` ran once. Build, reset of bidlock_load, app start and health succeeded; k6 exited 255 with missing `/load/bid-storm.js`, the expected T-40 boundary. Verify/report remain placeholders; no benchmark data was produced. Stopped/removed only app; shared pgdata retained. Temporarily stopped Rehearse was restarted.

Lint/typecheck and 182 unit tests pass. All 363 pgTAP assertions and 49 integration/concurrency tests pass after app cleanup and test DB reset. [PR #40](https://github.com/firatkill/bidlock/pull/40) passed all six [CI jobs](https://github.com/firatkill/bidlock/actions/runs/42298376606), including all 33 E2E tests across both projects. The first E2E setup was cancelled after browser dependency installation stalled; the second failed on transient Turbopack font resolution. The third attempt passed unchanged. No test assertions were weakened. Final evidence commit is gated on the same six checks before merge. The external QA ledger checker has an existing duplicate exploratory `—` lookup collision; independent ordered comparison confirms every prior attempt prefix is preserved.
