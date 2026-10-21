import { z } from "zod";
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

export const BidResultRow = z
  .object({
    outcome: z.enum(["accepted", "rejected"]),
    error_code: z.string().nullable(),
    replayed: z.boolean(),
    auction_id: z.uuid().nullable(),
    bid_id: z.uuid().nullable(),
    bid_no: z.number().int().nullable(),
    amount: z.number().int().nullable(),
    placed_at: z.date().nullable(),
    status: z.string().nullable(),
    current_price: z.number().int().nullable(),
    leader_bidder_id: z.uuid().nullable(),
    min_next_bid: z.number().int().nullable(),
    max_bid: z.number().int().nullable(),
    ends_at: z.date().nullable(),
    extended: z.boolean().nullable(),
    extension_count: z.number().int().nullable(),
    version: z.number().int().nullable(),
    server_now: z.date(),
  })
  .strict();
export async function makeBidders(n: number): Promise<string[]> {
  const sql = appSql();
  const row = z
    .object({
      result: z
        .object({
          outcome: z.literal("accepted"),
          bidder_id: z.uuid(),
          display_name: z.string(),
        })
        .strict(),
    })
    .strict();
  try {
    return await Promise.all(
      Array.from({ length: n }, async () => {
        const rows = z
          .array(row)
          .length(1)
          .parse(
            await sql`select bidlock.create_bidder(${crypto.randomUUID().replaceAll("-", "")}) as result`,
          );
        const id = rows[0]?.result.bidder_id;
        if (!id) throw new Error("Missing created bidder");
        return id;
      }),
    );
  } finally {
    await sql.end();
  }
}
export async function makeAuction(
  opts: {
    duration_s?: number;
    starting_price?: number;
    snipe_window_s?: number;
    extend_by_s?: number;
    max_extensions?: number;
    payment_window_s?: number;
    starts_in_s?: number;
  } = {},
): Promise<string> {
  const sql = appSql();
  try {
    const rows = z
      .array(z.object({ id: z.uuid() }).strict())
      .length(1)
      .parse(
        await sql`select bidlock.create_test_auction(${opts.duration_s ?? 120},${opts.starting_price ?? 1000},${opts.snipe_window_s ?? 10},${opts.extend_by_s ?? 30},${opts.max_extensions ?? 20},${opts.payment_window_s ?? 180},${opts.starts_in_s ?? 0},${"Integration " + crypto.randomUUID()}) as id`,
      );
    const id = rows[0]?.id;
    if (!id) throw new Error("Missing created auction");
    return id;
  } finally {
    await sql.end();
  }
}
export function withNow<T>(
  sql: postgres.Sql,
  iso: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
) {
  return sql.begin(async (tx) => {
    await tx`select set_config('bidlock.now_override',${iso},true)`;
    return fn(tx);
  });
}
