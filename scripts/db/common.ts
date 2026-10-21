import postgres from "postgres";
import { z } from "zod";
import { pathToFileURL } from "node:url";

export const DEFAULT_ADMIN_URL =
  "postgres://postgres:postgres@localhost:54329/bidlock_test";
const urlSchema = z
  .url()
  .refine(
    (value) => /^(postgres|postgresql):\/\//.test(value),
    "Expected a PostgreSQL URL",
  );
export function databaseUrl(
  database?: string,
  source = process.env.DATABASE_URL_ADMIN,
): string {
  const url = new URL(urlSchema.parse(source ?? DEFAULT_ADMIN_URL));
  if (database !== undefined)
    url.pathname =
      "/" +
      z
        .string()
        .regex(/^[a-z][a-z0-9_]*$/)
        .parse(database);
  return url.toString();
}
export function assertLocal(url: string): void {
  if (
    !["localhost", "127.0.0.1", "db"].includes(
      new URL(urlSchema.parse(url)).hostname,
    )
  )
    throw new Error("Refusing non-local database host");
}
export function adminConnection(url: string) {
  return postgres(urlSchema.parse(url), {
    max: 1,
    prepare: false,
    idle_timeout: 0,
    max_lifetime: 0,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: "bidlock-db-tools" },
  });
}
export function runIfMain(
  moduleUrl: string,
  action: () => Promise<void>,
): void {
  const entry = process.argv[1];
  if (entry === undefined || moduleUrl !== pathToFileURL(entry).href) return;
  void action().catch((error: unknown) => {
    process.stderr.write(
      (error instanceof Error ? error.message : "Database command failed") +
        "\n",
    );
    process.exitCode = 1;
  });
}
