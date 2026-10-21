import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { adminConnection, databaseUrl, runIfMain } from "./common";

interface MigrationOptions {
  url: string;
  directory?: string;
  mode?: "apply" | "status" | "dry-run";
}
export async function migrate({
  url,
  directory = "db/migrations",
  mode = "apply",
}: MigrationOptions): Promise<string[]> {
  const names = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  const files = await Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(resolve(directory, name));
      return {
        name,
        text: bytes.toString("utf8"),
        checksum: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  const sql = adminConnection(url);
  try {
    await sql`select pg_advisory_lock(7272701)`;
    await sql`create table if not exists public.bidlock_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())`;
    const recorded = z
      .array(z.object({ version: z.string(), checksum: z.string() }).strict())
      .parse(
        await sql`select version, checksum from public.bidlock_migrations`,
      );
    for (const file of files) {
      const prior = recorded.find((row) => row.version === file.name);
      if (prior && prior.checksum !== file.checksum)
        throw new Error(`checksum mismatch for ${file.name}`);
    }
    const lines: string[] = [];
    for (const file of files) {
      const applied = recorded.some((row) => row.version === file.name);
      if (mode === "status") {
        lines.push(`${file.name}\t${applied ? "applied" : "pending"}`);
        continue;
      }
      if (applied) continue;
      if (mode === "dry-run") {
        lines.push(`pending ${file.name}`);
        continue;
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(file.text);
        await tx`insert into public.bidlock_migrations (version, checksum) values (${file.name}, ${file.checksum})`;
      });
      lines.push(`applied ${file.name}`);
    }
    return lines;
  } finally {
    try {
      await sql`select pg_advisory_unlock(7272701)`;
    } finally {
      await sql.end();
    }
  }
}
runIfMain(import.meta.url, async () => {
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      status: { type: "boolean" },
      "dry-run": { type: "boolean" },
    },
    strict: true,
  });
  if (values.status && values["dry-run"])
    throw new Error("Use only one of --status and --dry-run");
  const lines = await migrate({
    url: databaseUrl(),
    directory: values.dir ?? "db/migrations",
    mode: values.status ? "status" : values["dry-run"] ? "dry-run" : "apply",
  });
  process.stdout.write(
    lines.join("\n") + (lines.length ? "\n" : "No pending migrations.\n"),
  );
});
