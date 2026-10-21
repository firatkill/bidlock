import { parseArgs } from "node:util";
import { z } from "zod";
import { adminConnection, assertLocal, databaseUrl, runIfMain } from "./common";
import { migrate } from "./migrate";
import { applyEnvironment } from "./apply-env";

interface ResetOptions {
  url: string;
  environment: "test" | "load";
  noPgtap?: boolean;
}
export async function resetDatabase({
  url,
  environment,
  noPgtap = false,
}: ResetOptions): Promise<void> {
  assertLocal(url);
  const sql = adminConnection(url);
  try {
    await sql.begin(async (tx) => {
      await tx`drop schema if exists bidlock cascade`;
      await tx`drop schema if exists bidlock_test cascade`;
      await tx`drop table if exists public.bidlock_migrations`;
    });
    await migrate({ url });
    const rows = z
      .array(z.object({ exists: z.boolean() }).strict())
      .length(1)
      .parse(
        await sql`select to_regclass('bidlock.settings') is not null as exists`,
      );
    if (!rows[0]?.exists) {
      process.stderr.write(
        "Warning: bidlock.settings does not exist; skipping environment SQL until foundation migrations are available.\n",
      );
      return;
    }
    await applyEnvironment({ url, name: environment, noPgtap });
  } finally {
    await sql.end();
  }
}
runIfMain(import.meta.url, async () => {
  const { values } = parseArgs({
    options: {
      env: { type: "string", multiple: true },
      db: { type: "string" },
      "no-pgtap": { type: "boolean" },
    },
    strict: true,
  });
  const environment = z
    .enum(["test", "load"])
    .parse(values.env?.at(-1) ?? "test");
  const url = databaseUrl(values.db);
  await resetDatabase({
    url,
    environment,
    noPgtap: values["no-pgtap"] ?? false,
  });
  process.stdout.write(`Reset ${new URL(url).pathname.slice(1)}.\n`);
});
