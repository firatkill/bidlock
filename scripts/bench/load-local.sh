#!/usr/bin/env bash
set -euo pipefail
C="docker compose -f docker/compose.yml"
mkdir -p bench/out && chmod 777 bench/out          # the grafana/k6 image runs as a non-root user
# Never report stale inputs if this run fails before producing artifacts.
rm -f bench/out/k6-summary.json bench/out/verify.json bench/out/result.json bench/out/SUMMARY.md
$C build db migrate app
$C up -d db --wait                                  # db only: --wait is unreliable with one-shot services
$C run --rm migrate                                 # reset bidlock_load: drop schema, migrate, db/env/load.sql
$C up -d --no-deps app
for i in $(seq 1 60); do curl -fsS http://localhost:3000/api/health >/dev/null && break; sleep 2; done
curl -fsS http://localhost:3000/api/health >/dev/null
k6_status=0
$C --profile load run --rm --no-deps k6 || k6_status=$?
k6_outcome=failure
if [ "$k6_status" -eq 0 ]; then k6_outcome=success; fi
verify_status=0
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:54329/bidlock_load pnpm bench:verify || verify_status=$?
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:54329/bidlock_load pnpm bench:report --no-commit --k6-outcome "$k6_outcome"
if [ "$k6_status" -ne 0 ]; then exit "$k6_status"; fi
exit "$verify_status"
