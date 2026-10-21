#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DATABASE_URL_ADMIN:-postgres://postgres:postgres@localhost:54329/bidlock_test}"
if command -v pg_prove >/dev/null 2>&1; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f db/tests/helpers/00_helpers.sql
  pg_prove --dbname "$DB_URL" --ext .sql --verbose --failures db/tests/*.test.sql
else
  docker compose -f docker/compose.yml exec -T db bash -c \
    "psql -U postgres -d bidlock_test -v ON_ERROR_STOP=1 -q -f /bidlock/db/tests/helpers/00_helpers.sql && \
     pg_prove -U postgres -d bidlock_test --ext .sql --verbose --failures /bidlock/db/tests/*.test.sql"
fi
