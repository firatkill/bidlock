# syntax=docker/dockerfile:1.7
FROM node:24.22.2-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Used by the compose "migrate" service.
FROM deps AS tools
COPY . .
CMD ["pnpm", "tsx", "scripts/db/reset.ts", "--env", "load", "--no-pgtap"]

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_FEED=polling
ARG NEXT_PUBLIC_POLL_INTERVAL_MS=1000
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_REPO_URL=https://github.com/firatkill/bidlock
ENV NEXT_PUBLIC_FEED=$NEXT_PUBLIC_FEED NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_REPO_URL=$NEXT_PUBLIC_REPO_URL
# D-75: non-secret validation placeholders scoped to this command only.
RUN APP_ENV=test DEMO_MODE=on \
    DATABASE_URL=postgres://unused:unused@127.0.0.1:1/bidlock_build_unused \
    DB_POOL_MAX=1 \
    SESSION_SECRET=t39-build-only-session-0123456789abcdef \
    BOT_TOKEN_SECRET=t39-build-only-bot-0123456789abcdef0123 \
    IP_HASH_SALT=t39-build-only-salt-0123456789 \
    TEST_API_SECRET=t39-build-only-test-api \
    APP_ORIGIN=http://app:3000 TRUST_PROXY=none pnpm build

FROM node:24.22.2-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r -g 1001 app && useradd -r -u 1001 -g app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
