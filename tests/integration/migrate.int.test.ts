import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  adminConnection,
  assertLocal,
  databaseUrl,
  DEFAULT_ADMIN_URL,
} from "../../scripts/db/common";
import {
  applyEnvironment,
  assertEnvironmentHost,
  prepareEnvironmentSql,
} from "../../scripts/db/apply-env";

const execute = promisify(execFile);
const source = databaseUrl();
assertLocal(source);
const scratchUrl = databaseUrl("bidlock_migrate_test", source);
const maintenance = adminConnection(databaseUrl("postgres", source));
const scratch = adminConnection(scratchUrl);
let created = false;
let directory = "";
const first =
  "create schema bidlock; create table bidlock.probe (id integer primary key);\n";
const counts = z.array(z.object({ n: z.number().int() }).strict()).length(1);
async function run(
  script: string,
  args: string[] = [],
  url = scratchUrl,
): Promise<string> {
  const result = await execute(
    process.execPath,
    ["--import", "tsx", resolve("scripts/db", script), ...args],
    { env: { ...process.env, DATABASE_URL_ADMIN: url }, timeout: 20_000 },
  );
  return result.stdout;
}
beforeAll(async () => {
  const lock = z
    .array(z.object({ locked: z.boolean() }).strict())
    .length(1)
    .parse(await maintenance`select pg_try_advisory_lock(7272702) as locked`);
  if (!lock[0]?.locked)
    throw new Error("Another migration-test run owns the scratch database");
  // Never drop a pre-existing database: this suite cleans up only what it created.
  await maintenance`create database bidlock_migrate_test`;
  created = true;
});
beforeEach(async () => {
  // Runner fixtures must start empty regardless of application migrations.
  await scratch`drop schema if exists bidlock cascade`;
  await scratch`drop schema if exists bidlock_test cascade`;
  await scratch`drop table if exists public.bidlock_migrations`;
  directory = await mkdtemp(resolve(".git", "migration-tests-"));
  await writeFile(resolve(directory, "0001_probe.sql"), first);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});
afterAll(async () => {
  await scratch.end();
  try {
    if (created) await maintenance`drop database bidlock_migrate_test`;
  } finally {
    await maintenance.end();
  }
});

test("TC-009: apply twice is a no-op and changed checksum is rejected", async () => {
  expect(await run("migrate.ts", ["--dir", directory])).toContain(
    "applied 0001_probe.sql",
  );
  expect(await run("migrate.ts", ["--dir", directory])).toContain(
    "No pending migrations",
  );
  expect(
    counts.parse(
      await scratch`select count(*)::integer as n from public.bidlock_migrations`,
    )[0]?.n,
  ).toBe(1);
  await writeFile(resolve(directory, "0001_probe.sql"), first + "-- changed\n");
  await expect(run("migrate.ts", ["--dir", directory])).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining(
      "checksum mismatch for 0001_probe.sql",
    ) as unknown,
  });
});
test("TC-009: concurrent runners serialize on the advisory lock", async () => {
  const results = await Promise.all([
    run("migrate.ts", ["--dir", directory]),
    run("migrate.ts", ["--dir", directory]),
  ]);
  expect(
    results.filter((text) => text.includes("applied 0001_probe.sql")),
  ).toHaveLength(1);
  expect(
    counts.parse(
      await scratch`select count(*)::integer as n from public.bidlock_migrations`,
    )[0]?.n,
  ).toBe(1);
});
test("TC-010: status and dry-run report without applying schema", async () => {
  expect(await run("migrate.ts", ["--dir", directory, "--status"])).toContain(
    "0001_probe.sql\tpending",
  );
  expect(await run("migrate.ts", ["--dir", directory, "--dry-run"])).toContain(
    "pending 0001_probe.sql",
  );
  const rows = z
    .array(z.object({ table_name: z.string().nullable() }).strict())
    .parse(
      await scratch`select to_regclass('bidlock.probe')::text as table_name`,
    );
  expect(rows[0]?.table_name).toBeNull();
  await run("migrate.ts", ["--dir", directory]);
  expect(await run("migrate.ts", ["--dir", directory, "--status"])).toContain(
    "0001_probe.sql\tapplied",
  );
});
test("TC-011: default and --db targets; unsafe reset rejected before connecting", async () => {
  vi.stubEnv("DATABASE_URL_ADMIN", undefined);
  expect(databaseUrl()).toBe(DEFAULT_ADMIN_URL);
  expect(new URL(databaseUrl("bidlock")).pathname).toBe("/bidlock");
  expect(new URL(databaseUrl("bidlock_migrate_test", source)).pathname).toBe(
    "/bidlock_migrate_test",
  );
  await expect(
    run("reset.ts", [], "postgres://x@example.com/db"),
  ).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining("Refusing non-local") as unknown,
  });
});
test("TC-011: reset CLI replaces scratch fixtures with application migrations", async () => {
  await run("migrate.ts", ["--dir", directory]);
  expect(
    await run("reset.ts", ["--db", "bidlock_migrate_test", "--no-pgtap"]),
  ).toContain("Reset bidlock_migrate_test");
  const rows = z
    .array(
      z
        .object({
          probe: z.string().nullable(),
          settings: z.string().nullable(),
        })
        .strict(),
    )
    .parse(
      await scratch`select to_regclass('bidlock.probe')::text as probe, to_regclass('bidlock.settings')::text as settings`,
    );
  expect(rows).toEqual([{ probe: null, settings: "bidlock.settings" }]);
  expect(await run("migrate.ts")).toContain("No pending migrations");
});
test("TC-012: environment host restrictions and missing substitutions", async () => {
  expect(() => {
    assertEnvironmentHost("test", "postgres://x@example.com/db");
  }).toThrow("non-local");
  expect(() => {
    assertEnvironmentHost("load", "postgres://x@example.com/db");
  }).toThrow("non-local");
  await expect(run("apply-env.ts", ["supabase"])).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining("Refusing supabase") as unknown,
  });
  expect(() => prepareEnvironmentSql("select :'app_password';", {})).toThrow(
    "Missing environment variable BIDLOCK_SQL_APP_PASSWORD",
  );
});
test("TC-012: no-pgtap stripping and safely quoted substitution execute", async () => {
  await run("migrate.ts", ["--dir", directory]);
  // If not stripped, this deliberately conflicting extension definition fails on every image.
  const fixture =
    "create extension if not exists pgtap schema nonexistent_schema;\ncreate table bidlock.env_probe (value text); insert into bidlock.env_probe values (:'app_password');\n";
  await writeFile(resolve(directory, "test.sql"), fixture);
  const value = "placeholder'\\value";
  expect(
    prepareEnvironmentSql(fixture, { BIDLOCK_SQL_APP_PASSWORD: value }, true),
  ).not.toContain("create extension");
  await applyEnvironment({
    url: scratchUrl,
    name: "test",
    noPgtap: true,
    directory,
    variables: { BIDLOCK_SQL_APP_PASSWORD: value },
  });
  const rows = z
    .array(z.object({ value: z.string() }).strict())
    .parse(await scratch`select value from bidlock.env_probe`);
  expect(rows).toEqual([{ value }]);
});
test("TC-013: a failing migration rolls back both DDL and ledger entry", async () => {
  await writeFile(
    resolve(directory, "0001_probe.sql"),
    first + "select missing_column from bidlock.probe;\n",
  );
  await expect(run("migrate.ts", ["--dir", directory])).rejects.toMatchObject({
    code: 1,
  });
  const rows = z
    .array(z.object({ table_name: z.string().nullable() }).strict())
    .parse(
      await scratch`select to_regclass('bidlock.probe')::text as table_name`,
    );
  expect(rows[0]?.table_name).toBeNull();
  expect(
    counts.parse(
      await scratch`select count(*)::integer as n from public.bidlock_migrations`,
    )[0]?.n,
  ).toBe(0);
});

test("TC-126: staged environment setup defers only absent rate limits", async () => {
  await run("reset.ts", ["--db", "bidlock_migrate_test", "--no-pgtap"]);
  // Keep the absent-table stage covered even after migration 0008 exists.
  await scratch`drop table if exists bidlock.rate_limits cascade`;
  await applyEnvironment({ url: scratchUrl, name: "test", noPgtap: true });
  await applyEnvironment({ url: scratchUrl, name: "load", noPgtap: true });
  const state = z
    .array(z.object({ env: z.string(), login: z.boolean() }).strict())
    .parse(
      await scratch`select s.env, r.rolcanlogin as login from bidlock.settings s cross join pg_roles r where r.rolname = 'bidlock_app'`,
    );
  expect(state).toEqual([{ env: "test", login: true }]);
  // A transaction-local fixture keeps this test independent of later migrations.
  await scratch.begin(async (tx) => {
    await tx`drop table if exists bidlock.rate_limits cascade`;
    await tx`create table bidlock.rate_limits (name text primary key, max_hits integer)`;
    await tx`insert into bidlock.rate_limits values ('bid_ip_60s', 200), ('bidder_create_ip_3600s', 20), ('sandbox_ip_3600s', 5), ('bidder_1s', 3)`;
    const { readFile } = await import("node:fs/promises");
    const limits = z.array(
      z.object({ name: z.string(), max_hits: z.number().int() }).strict(),
    );
    await tx.unsafe(
      prepareEnvironmentSql(
        await readFile("db/env/test.sql", "utf8"),
        {},
        true,
      ),
    );
    expect(
      limits.parse(
        await tx`select name, max_hits from bidlock.rate_limits order by name collate "C"`,
      ),
    ).toEqual([
      { name: "bid_ip_60s", max_hits: 10000 },
      { name: "bidder_1s", max_hits: 3 },
      { name: "bidder_create_ip_3600s", max_hits: 10000 },
      { name: "sandbox_ip_3600s", max_hits: 10000 },
    ]);
    await tx.unsafe(
      prepareEnvironmentSql(
        await readFile("db/env/load.sql", "utf8"),
        {},
        true,
      ),
    );
    expect(
      limits.parse(
        await tx`select name, max_hits from bidlock.rate_limits order by name collate "C"`,
      ),
    ).toEqual([
      { name: "bid_ip_60s", max_hits: 1000000 },
      { name: "bidder_1s", max_hits: 3 },
      { name: "bidder_create_ip_3600s", max_hits: 1000000 },
      { name: "sandbox_ip_3600s", max_hits: 10000 },
    ]);
  });
});
