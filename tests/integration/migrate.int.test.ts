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
import { resetDatabase } from "../../scripts/db/reset";
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
  await resetDatabase({ url: scratchUrl, environment: "test" });
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
test("TC-011: reset CLI clears only the named scratch schema and skips absent foundation", async () => {
  await run("migrate.ts", ["--dir", directory]);
  expect(
    await run("reset.ts", ["--db", "bidlock_migrate_test", "--no-pgtap"]),
  ).toContain("Reset bidlock_migrate_test");
  expect(
    counts.parse(
      await scratch`select count(*)::integer as n from public.bidlock_migrations`,
    )[0]?.n,
  ).toBe(0);
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
