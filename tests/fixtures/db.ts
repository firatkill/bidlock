import postgres from "postgres";
function toSafeInt(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new Error(`int8 out of safe range: ${value}`);
  return n;
}
export function createSql(url: string, max = 10): postgres.Sql {
  return postgres(url, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    connection: { application_name: "bidlock-tests" },
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: toSafeInt,
      },
    },
    transform: { undefined: null },
  });
}
export const adminSql = (): postgres.Sql =>
  createSql(
    process.env.DATABASE_URL_ADMIN ??
      "postgres://postgres:postgres@localhost:54329/bidlock_test",
  );
export const appSql = (): postgres.Sql =>
  createSql(
    process.env.DATABASE_URL ??
      "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
  );
