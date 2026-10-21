import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { adminConnection, assertLocal, databaseUrl, runIfMain } from "./common";

const environmentName = z.enum(["test", "load", "supabase", "supabase-cron"]);
export type EnvironmentName = z.infer<typeof environmentName>;
export function assertEnvironmentHost(
  name: EnvironmentName,
  url: string,
): void {
  if (name === "test" || name === "load") {
    assertLocal(url);
    return;
  }
  if (["localhost", "127.0.0.1", "db"].includes(new URL(url).hostname))
    throw new Error("Refusing supabase environment on a local host");
}
export function prepareEnvironmentSql(
  text: string,
  variables: Record<string, string | undefined>,
  noPgtap = false,
): string {
  const source = noPgtap
    ? text
        .split("\n")
        .filter(
          (line) => !/^\s*create extension if not exists pgtap\b/i.test(line),
        )
        .join("\n")
    : text;
  return source.replace(/:'([a-z_]+)'/g, (_match: string, name: string) => {
    const key = "BIDLOCK_SQL_" + name.toUpperCase();
    const value = variables[key];
    if (value === undefined)
      throw new Error(`Missing environment variable ${key}`);
    // E-literals remain safe regardless of standard_conforming_strings.
    return "E'" + value.replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
  });
}
interface ApplyOptions {
  url: string;
  name: EnvironmentName;
  noPgtap?: boolean;
  directory?: string;
  variables?: Record<string, string | undefined>;
}
export async function applyEnvironment({
  url,
  name,
  noPgtap = false,
  directory = "db/env",
  variables = process.env,
}: ApplyOptions): Promise<void> {
  environmentName.parse(name);
  assertEnvironmentHost(name, url);
  const text = prepareEnvironmentSql(
    await readFile(resolve(directory, `${name}.sql`), "utf8"),
    variables,
    noPgtap,
  );
  const sql = adminConnection(url);
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
    });
  } catch {
    throw new Error(`Environment SQL failed for ${name}`);
  } finally {
    await sql.end();
  }
}
runIfMain(import.meta.url, async () => {
  const { values, positionals } = parseArgs({
    options: { "no-pgtap": { type: "boolean" } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1)
    throw new Error(
      "Usage: db:env <test|load|supabase|supabase-cron> [--no-pgtap]",
    );
  const name = environmentName.parse(positionals[0]);
  await applyEnvironment({
    url: databaseUrl(),
    name,
    noPgtap: values["no-pgtap"] ?? false,
  });
  process.stdout.write(`Applied environment ${name}.\n`);
});
