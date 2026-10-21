// src/server/db.ts
import "server-only";
import postgres from "postgres";
import { env } from "./env";

function toSafeInt(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new Error(`int8 out of safe range: ${value}`);
  return n;
}

declare global {
  var __bidlockSql: postgres.Sql | undefined;
}

export const sql: postgres.Sql =
  globalThis.__bidlockSql ??
  (globalThis.__bidlockSql = postgres(env().DATABASE_URL, {
    prepare: false, // required by Supavisor transaction mode, see below
    max: env().DB_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    connection: { application_name: "bidlock-app" },
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: toSafeInt,
      },
    },
    transform: { undefined: null },
  }));
