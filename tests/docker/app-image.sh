#!/usr/bin/env bash
# TC-255–TC-258: local-only T-39 acceptance; never removes the shared pgdata volume.
set -euo pipefail
cd "$(dirname "$0")/../.."
compose=(docker compose -f docker/compose.yml)
cleanup() {
  "${compose[@]}" stop app
  "${compose[@]}" rm -f app
}
trap cleanup EXIT
"${compose[@]}" build db migrate app
# D-75 / TC-258: no build placeholder secret in copied standalone output or runner config.
image=$("${compose[@]}" images -q app | head -n 1)
# Compose has not created an app container yet; use its configured build image name.
if test -z "$image"; then image=bidlock-app; fi
docker run --rm --entrypoint sh "$image" -c 'grep -R -F -l "t39-build-only-" /app > /tmp/placeholder-matches; status=$?; test "$status" = 1'
test -z "$(docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" | grep -F 't39-build-only-' || true)"
"${compose[@]}" up -d db --wait
# TC-257: explicit db-only startup cannot launch app/migrate/k6.
test "$("${compose[@]}" ps --services --status running)" = db
schema_ids() {
  for database in bidlock bidlock_test; do
    "${compose[@]}" exec -T db psql -U postgres -d "$database" -tAc "select oid from pg_namespace where nspname = 'bidlock'"
  done
}
before=$(schema_ids)
"${compose[@]}" run --rm migrate
# TC-256: reset uses DATABASE_URL_ADMIN=.../bidlock_load and leaves dev/test alone.
test "$before" = "$(schema_ids)"
test "$("${compose[@]}" exec -T db psql -U postgres -d bidlock_load -tAc "select env from bidlock.settings")" = test
# TC-258: actual tools filesystem excludes local/private data, retains benchmarks.
"${compose[@]}" run --rm --no-deps --entrypoint sh migrate -c 'test ! -e .git && test ! -e .env.local && test ! -e .codex-prompts && test ! -e bench/out && test ! -e playwright-report && test ! -e test-results && test -f bench/results/latest.json'
"${compose[@]}" up -d --no-deps app
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3000/api/health > /tmp/bidlock-t39-health.json; then break; fi
  sleep 2
done
cat /tmp/bidlock-t39-health.json
grep -q '"db":"ok"' /tmp/bidlock-t39-health.json
test "$("${compose[@]}" exec -T app id -un)" = app
test "$("${compose[@]}" exec -T app id -u)" = 1001
container=$("${compose[@]}" ps -q app)
for i in $(seq 1 60); do
  if test "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = healthy; then break; fi
  sleep 2
done
test "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = healthy
"${compose[@]}" exec -T app sh -c 'test -f server.js && test -d .next/static && test -d public && test -f bench/results/latest.json'
printf '\nTC-255–TC-258 passed: healthy standalone app, uid 1001, isolated migration, clean context.\n'
