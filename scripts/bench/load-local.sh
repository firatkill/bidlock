#!/usr/bin/env bash
set -euo pipefail
C="docker compose -f docker/compose.yml"
mkdir -p bench/out && chmod 777 bench/out          # the grafana/k6 image runs as a non-root user
$C build db migrate app
$C up -d db --wait                                  # db only: --wait is unreliable with one-shot services
$C run --rm migrate                                 # reset bidlock_load: drop schema, migrate, db/env/load.sql
$C up -d --no-deps app
for i in $(seq 1 60); do curl -fsS http://localhost:3000/api/health >/dev/null && break; sleep 2; done
curl -fsS http://localhost:3000/api/health >/dev/null
$C --profile load run --rm --no-deps k6             # service command runs load/bid-storm.js; VUS, DURATION, AUCTION_S pass through
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:54329/bidlock_load pnpm bench:verify
pnpm bench:report --no-commit
