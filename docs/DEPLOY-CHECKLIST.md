# T-45 / T-46 owner deployment checklist

T-45 remains **doing**; this preparation does not certify production. Follow the steps in order. Owner actions create external resources; agent follow-up verifies non-secret evidence and records acceptance. Never paste passwords, connection URLs containing passwords, signing secrets or salts into chat. Keep them in your password manager and enter them directly into your terminal or Vercel. No production credentials go into GitHub, tracked files, CI or an agent session.

Sources: OWNER-DECISIONS.md, plan T-45/T-46, TRD §5, §8.1–8.3, §16.3, §18.2–18.4 and §20 assumptions, PRD D-04/D-19/D-29. Frankfurt (`eu-central-1` / `fra1`) overrides the old US-region examples in TRD §18 (D-42). Production migrations below are **owner-only**, never agent or CI commands.

## 1. Owner — prepare accounts and local tools

- Use Supabase Free and Vercel Hobby. If the Supabase free project allowance is full, use another free account per OWNER-DECISIONS; do not upgrade. No paid add-ons, analytics or monitoring integrations.
- On your machine, install Node 24, the repository-pinned pnpm, PostgreSQL client (`psql`) and Git. Pull merged `main`, then run `pnpm install --frozen-lockfile`.
- Open a private terminal session without shell tracing or session recording. The commands below use Bash silent prompts to keep secrets out of command history. Start `bash`, then `set +x`. Scripts read exported environment variables, not `.env.local`.

## 2. Owner — create and configure Supabase

1. Create project **bidlock**, **Free**, AWS **Frankfurt (`eu-central-1`)**. Save the database administrator password in your password manager.
2. Database → Extensions: enable `pg_cron`. Confirm the database version is PostgreSQL 17 as specified; report a different version before proceeding.
3. Settings → API / Data API: exposed schemas stay `public` and `graphql_public`; never expose `bidlock` or grant browser roles access to it.
4. Realtime settings: allow public channels (disable the private-only restriction). Do not change to a fallback until the verification below fails and the owner approves the change.
5. In **Connect**, copy the Direct connection URI (host `db.<project-ref>.supabase.co`, port 5432, user `postgres`) and Shared Pooler **Transaction mode** URI (dashboard host, port 6543). Do not guess the host index. If your machine lacks IPv6, also copy Shared Pooler **Session mode** (port 5432, user `postgres.<project-ref>`). Use session mode for migrations in that case; do not buy IPv4.
6. Settings → API Keys: note the project URL and public anon/publishable key for browser Realtime. Do not use a service-role or secret key.

The [connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) documents custom pooler usernames as `<role>.<project-ref>` and the direct/session/transaction distinction. Availability still needs A-02 verification on this project.

## 3. Owner — apply migrations and production configuration

Generate a separate app-role password locally with `openssl rand -hex 32` and save it in your password manager. Do not reuse the administrator password. Construct URIs locally; percent-encode reserved characters in URI passwords. The hex app password needs no encoding.

In the private Bash session, paste the administrator **direct** URI (or **session pooler** URI when IPv6 is unavailable), with `sslmode=require`, into the silent prompt:

```bash
read -r -s -p 'Administrator direct/session URI: ' DATABASE_URL_ADMIN; printf '\n'
export DATABASE_URL_ADMIN
pnpm db:migrate --status
pnpm db:migrate
read -r -s -p 'Saved app-role password: ' BIDLOCK_SQL_APP_PASSWORD; printf '\n'
export BIDLOCK_SQL_APP_PASSWORD
pnpm db:env supabase
unset BIDLOCK_SQL_APP_PASSWORD
pnpm db:cron
pnpm db:cron
pnpm db:migrate --status
```

Stop on any error. `db:env supabase` is this repository's production apply-env command: it sets `settings.env=prod`, `realtime_mode=broadcast`, clears the test clock, assigns the password to `bidlock_app`, and revokes browser/service-role access to `bidlock`. Its production mode rejects local hosts; test/load modes reject remote hosts. Do not use `db:reset`, `db:env test`, `db:env load` or the transaction pooler here. Repeat `db:env supabase` after future migrations that add functions, as TRD §18.5 requires.

## 4. Owner — verify T-45 SQL acceptance (A-02 / A-03)

Construct the runtime URI from the dashboard's transaction pooler URI: username `bidlock_app.<project-ref>`, the separate app password, port 6543, database `postgres`, `sslmode=require`. Enter it silently:

```bash
read -r -s -p 'Runtime transaction pooler URI: ' DATABASE_URL; printf '\n'
export DATABASE_URL
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'select current_user'
psql "$DATABASE_URL_ADMIN" -X -v ON_ERROR_STOP=1 -c 'select jobname from cron.job order by jobname'
psql "$DATABASE_URL_ADMIN" -X -v ON_ERROR_STOP=1 -c "select count(*) from cron.job where jobname like 'bidlock-%'"
psql "$DATABASE_URL_ADMIN" -X -v ON_ERROR_STOP=1 -c 'select jobname, database, username, active from cron.job order by jobname'
psql "$DATABASE_URL_ADMIN" -X -v ON_ERROR_STOP=1 -c 'select env, realtime_mode, test_clock_offset_ms from bidlock.settings'
```

Expected: `bidlock_app`; exactly four named jobs (`bidlock-tick`, `bidlock-rate-gc`, `bidlock-cleanup`, `bidlock-cron-log-gc`) despite two installs; all active in database `postgres` as user `postgres`; settings `prod`, `broadcast`, `0`. After a minute, inspect `cron.job_run_details` for successful tick execution. The final migration status must show every migration applied (currently 0001–0014).

If A-02 fails, report the error without the URI: the specified fallback is runtime `postgres`, with reduced role-level isolation, and needs an owner decision plus PRD record before use. If A-03 fails, stop: upsert compatibility can use unschedule/reschedule; absence of pg_cron requires a separately approved protected tick endpoint/workflow. Neither fallback exists merely because it is described here.

## 5. Owner — verify browser Broadcast (A-01) and quotas (A-06)

In the Supabase SQL editor as `postgres`:

```sql
select pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'realtime' and p.proname = 'send';
```

Expect the payload/event/topic/private arguments described in TRD §8.1. In a disposable browser tab that permits module imports, open DevTools and run the following using **only the public** project URL and anon/publishable key. The pinned module matches package.json; the helper is for this manual console check, not an app dependency. If CSP blocks it, use a local disposable HTML page served on localhost, not the production site's CSP.

```js
const { createClient } =
  await import("https://esm.sh/@supabase/supabase-js@2.118.0");
const client = createClient(
  prompt("Public Supabase URL"),
  prompt("Public anon/publishable key"),
);
const channel = client
  .channel("auction:test", { config: { private: false } })
  .on("broadcast", { event: "auction_changed" }, console.log)
  .subscribe(console.log);
```

Wait for `SUBSCRIBED`, then run in the SQL editor:

```sql
select realtime.send('{"x":1}'::jsonb, 'auction_changed', 'auction:test', false);
```

Expect `{x: 1}` in the browser. Also test the trigger's security-definer context without leaving a permanent helper:

```sql
begin;
create function pg_temp.bidlock_realtime_probe()
returns void language plpgsql security definer
set search_path = bidlock, pg_temp as $$
begin
  perform realtime.send('{"x":2}'::jsonb, 'auction_changed', 'auction:test', false);
end;
$$;
revoke execute on function pg_temp.bidlock_realtime_probe() from public;
select pg_get_userbyid(proowner)
from pg_proc where oid = 'pg_temp.bidlock_realtime_probe()'::regprocedure;
select pg_temp.bidlock_realtime_probe();
commit;
```

Owner must be `postgres`; expect `{x: 2}` after commit. Disconnect with `await client.removeChannel(channel)`. Later, step 9 checks the real auction trigger and absence of `bidlock realtime publish failed` warnings.

If delivery fails: first check subscription/public-channel settings. D-29's order is public Broadcast → private Broadcast plus guarded RLS migration/client changes → Postgres Changes projection → polling at 2 s. Report results before implementing a fallback. New migration numbers must follow 0014; the plan's sample 0013 names are already occupied. Each fallback needs pgTAP coverage and a PRD §14 decision.

Open Supabase Pricing and Dashboard → Usage. Record dated database, Realtime concurrent-connection and message quotas and current usage for A-06. The [pricing page](https://supabase.com/pricing) lists 500 MB database and pausing after one week of inactivity; recheck at deployment. Do not claim that a healthy query proves A-05 or that cron prevents pausing.

## 6. Owner — create Vercel and enter environment variables

Import **firatkill/bidlock** into a **Hobby** project, framework Next.js, root `/`, production branch `main`, Node **24.x**, install `pnpm install --frozen-lockfile`, build `pnpm build`. Set function region **Frankfurt (`fra1`)**. Enable automatic system environment variables so `VERCEL_GIT_COMMIT_SHA` reaches the app. Leave Web Analytics and Speed Insights off.

Enter each variable separately with the specified scope. These are sources/instructions, not secret values. Production secrets must never be selected for Preview. Generate each independent secret with `openssl rand -hex 32` locally; store it directly in Vercel/password manager. Redeploy after changing build-time `NEXT_PUBLIC_*` variables.

| Variable                                         | Production source/configuration                                        | Preview source/configuration                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `APP_ENV`                                        | `production`                                                           | `production`                                                                             |
| `DEMO_MODE`                                      | `on`                                                                   | `off`                                                                                    |
| `DATABASE_URL`                                   | Step 4 runtime transaction-pooler URI                                  | Unreachable local placeholder URI, as explained below; never Supabase                    |
| `DB_POOL_MAX`                                    | `3`                                                                    | `1`                                                                                      |
| `SESSION_SECRET`                                 | Independently generated secret                                         | Separate disposable generated value, at least 32 characters                              |
| `BOT_TOKEN_SECRET`                               | Independently generated secret                                         | Separate disposable generated value, at least 32 characters                              |
| `IP_HASH_SALT`                                   | Independently generated secret                                         | Separate disposable generated value, at least 16 characters                              |
| `SESSION_SECRET_PREVIOUS`                        | Unset initially; previous session key only during an approved rotation | Unset                                                                                    |
| `APP_ORIGIN`                                     | `https://bidlock.firatkil.com`                                         | Exact HTTPS preview origin from Vercel, no path; comma-separated exact origins if needed |
| `TRUST_PROXY`                                    | `vercel`                                                               | `vercel`                                                                                 |
| `LOG_LEVEL`                                      | `info`                                                                 | `info`                                                                                   |
| `LOAD_DIAGNOSTICS`                               | `off`                                                                  | `off`                                                                                    |
| `NEXT_PUBLIC_FEED`                               | `broadcast`                                                            | `polling`                                                                                |
| `NEXT_PUBLIC_POLL_INTERVAL_MS`                   | `2000`                                                                 | `2000`                                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`                       | Project URL from Supabase Connect / API settings                       | Unset                                                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                  | Public anon/publishable key from API Keys                              | Unset                                                                                    |
| `NEXT_PUBLIC_REPO_URL`                           | `https://github.com/firatkill/bidlock`                                 | Same repository URL                                                                      |
| `NEXT_TELEMETRY_DISABLED`                        | `1`                                                                    | `1`                                                                                      |
| `VERCEL_GIT_COMMIT_SHA`                          | Vercel system variable; do not invent a SHA                            | Vercel system variable                                                                   |
| `GIT_SHA`                                        | Unset; only a non-Vercel version fallback                              | Unset                                                                                    |
| `DATABASE_URL_ADMIN`, `BIDLOCK_SQL_APP_PASSWORD` | Never set on Vercel                                                    | Never set                                                                                |
| `TEST_API_SECRET`, `BOT_SEED_OVERRIDE`           | Unset, not empty strings                                               | Unset, not empty strings                                                                 |

Preview clarification: TRD says no database is needed, but `src/server/env.ts` still requires a syntactically valid URL even with `DEMO_MODE=off`. Supply a non-secret placeholder using scheme `postgres`, dummy username/password `unused`, host `127.0.0.1`, port `1`, database `bidlock_preview_unused`. It points nowhere reachable on Vercel. This preserves the offline-page contract and prevents production access; `/api/health?db=1` returns HTTP 503 with `db:error`. Do not copy the production URL to make Preview health green. Before a preview domain exists, use the production origin as a syntactically valid placeholder for `APP_ORIGIN`; offline mode rejects mutations. Replace with the exact preview origin once assigned.

## 7. Owner — add domain and DNS

Add **bidlock.firatkil.com** under Vercel Project → Settings → Domains. At the DNS provider managing **firatkil.com**, add:

| Field       | Exact entry                                                              |
| ----------- | ------------------------------------------------------------------------ |
| Type        | `CNAME`                                                                  |
| Name / host | `bidlock` (FQDN `bidlock.firatkil.com`)                                  |
| Target      | Copy the exact CNAME destination shown by Vercel for this project/domain |
| TTL         | Provider default / automatic                                             |
| Proxy       | DNS only, if the provider offers proxying                                |

The literal target cannot be determined before the owner creates the project. Do not assume `cname.vercel-dns.com`: [Vercel documents unique per-project CNAME targets](https://vercel.com/docs/domains/working-with-domains/add-a-domain). Copy the shown target verbatim and report that **non-secret hostname** for agent verification. Add ownership-verification TXT records only if Vercel explicitly requests them. Wait for Valid Configuration and HTTPS certificate issuance.

## 8. Owner — GitHub workflows and keepalive

**No owner-created GitHub secrets are required** by `keepalive.yml`, `ci.yml` or `load.yml`. CI/load use local disposable databases. `load.yml` uses the action's default GitHub-provided `GITHUB_TOKEN` with workflow `contents:write` / `pull-requests:write`; no PAT, Supabase password, Vercel token or deploy hook is needed. The repository's allow-Actions-to-create-PRs setting was verified in T-43; preserve it. Vercel deploys via its Git integration.

Keepalive exactly follows TRD §16.3: public health URL, empty permissions, five-minute job timeout, bounded curl retries, `17 6 */3 * *` schedule and manual dispatch. **It has no secret gate: merging it into main enables scheduled requests immediately**, including before deployment is ready. An early failed run is expected until DNS/app/database are ready. The schedule is day-of-month based, not a precise 72-hour timer. Do not dispatch it during preparation.

After deployment, run once from Actions → keepalive → Run workflow → main, or:

```bash
gh workflow run keepalive.yml --ref main
gh run list --workflow keepalive.yml --limit 3
```

Open the resulting run and confirm green. Never dispatch load against production; load remains Compose-only.

## 9. Owner, then agent — acceptance and assumption evidence

Owner runs the T-45 acceptance from steps 3–5: all migrations applied, four cron jobs, browser test delivery and `current_user=bidlock_app`. Share only pass/fail summaries and sanitized errors, never connection strings or secrets.

Owner or agent after owner setup runs the plan's T-46 health acceptance (quote the URL in zsh):

```bash
curl -fsS 'https://bidlock.firatkil.com/api/health?db=1'
dig +short CNAME bidlock.firatkil.com
git rev-parse origin/main
```

Expect `db:ok`, a non-`dev` `version` equal to the **deployed Git SHA** shown by Vercel (normally current main), valid HTTPS and the configured CNAME. Confirm the keepalive dispatch is green. Open Preview: offline page, no Supabase connections, expected degraded health.

Owner manually opens production in two browsers on different networks, creates distinct bidder names and places ordinary bids. Each browser must see the other's bid within **1 second** through Broadcast; check Realtime subscription state and absence of publishing warnings. This is manual acceptance, never a scripted bid test or load run.

- **A-04:** owner/agent reads [Vercel limits](https://vercel.com/docs/limits), [Hobby plan](https://vercel.com/docs/plans/hobby) and [pricing](https://vercel.com/pricing) on deployment day. Record dated invocation, duration, CPU and bandwidth allowances and dashboard usage in README Deployment notes. No paid upgrade; report insufficiency before changing polling.
- **A-05:** owner records the deployment/keepalive start date; after **more than seven days**, checks the project is still active with only keepalive traffic. Cron activity is not proof. Review [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase) and pricing. If paused, restore via Dashboard and report; shortened keepalive requires a recorded decision. This delayed check cannot be completed on deployment day.
- **A-06:** agent records the owner's dated quota/usage evidence from step 5 in README; no assumed capacity approval.
- **A-12:** compare [Vercel request-header documentation](https://vercel.com/docs/headers/request-headers) with two-network runtime evidence. Owner inspects only salted IP keys in `bidlock.rate_counters` for `bid_ip_60s` immediately after the two manual bids, confirming distinct hashes (correlate by timing, never by raw IP); do not select/store raw IPs. The documentation must establish that client-supplied `x-forwarded-for` is overwritten. If a runtime spoofing check is needed, agree on a bounded manual check first; no scripted production bidding. If trust cannot be established, report the gap before adopting the specified `x-real-ip` fallback. Do not add raw-IP logging.

Agent records verified facts and unresolved assumptions in README, PROGRESS and QA results. Any fallback gets owner approval and a PRD decision before implementation. T-45/T-46 stay incomplete until their acceptance evidence is recorded; keep A-05's delayed observation explicitly open.

## 10. Owner — finish and reply

In the private terminal:

```bash
unset DATABASE_URL_ADMIN DATABASE_URL BIDLOCK_SQL_APP_PASSWORD
exit
```

Reply when owner steps are complete, with non-secret project/domain identifiers, the displayed DNS target, acceptance summaries, keepalive run link and any blocked assumption. The agent will verify the deployed state; it will not run production migrations or request secrets in chat.
