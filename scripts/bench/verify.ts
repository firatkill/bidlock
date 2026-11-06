import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { adminConnection, runIfMain } from "../db/common";

const count = z.number().int().nonnegative();
const status = z.enum(["scheduled", "live", "closed", "settled", "unsold"]);
// k6 owns the extensible summary envelope; setup_data is our fixed setup contract.
export const Summary = z
  .object({
    setup_data: z
      .object({
        auctionId: z.uuid(),
        cookies: z.array(z.string()),
        startedAt: count,
      })
      .strict(),
  })
  .catchall(z.unknown());
export const VerifyEnv = z
  .object({
    DATABASE_URL_ADMIN: z
      .url()
      .refine(
        (value) =>
          ["postgres:", "postgresql:"].includes(new URL(value).protocol),
        "Expected a PostgreSQL URL",
      ),
    BENCH_MIN_BIDS: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(count)
      .default(100),
  })
  .strict();
export const Checks = z
  .array(
    z
      .object({
        id: z.string().min(1),
        check: z.string().min(1),
        violations: count,
      })
      .strict(),
  )
  .min(1);
export const Auction = z
  .object({
    auction_id: z.uuid(),
    status,
    final_price: count.nullable(),
    bid_count: count,
    extension_count: count,
  })
  .strict();
export const Verification = Auction.extend({ checks: Checks }).strict();
export type VerificationResult = z.infer<typeof Verification>;

export function verificationExitCode(
  result: VerificationResult,
  minimum: number,
): 0 | 1 {
  return result.status === "live" ||
    result.bid_count < minimum ||
    result.checks.some(({ violations }) => violations > 0)
    ? 1
    : 0;
}

export async function pollAuction(
  read: () => Promise<z.infer<typeof Auction>>,
) {
  const deadline = performance.now() + 120_000;
  let auction = await read();
  while (auction.status === "live" && performance.now() < deadline) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(2000, deadline - performance.now())),
    );
    auction = await read();
  }
  return auction;
}

runIfMain(import.meta.url, async () => {
  // Do not print validation inputs (the summary contains session cookies).
  const env = VerifyEnv.safeParse({
    DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN,
    BENCH_MIN_BIDS: process.env.BENCH_MIN_BIDS,
  });
  if (!env.success) throw new Error("Invalid verifier environment");
  const summary = Summary.safeParse(
    JSON.parse(await readFile("bench/out/k6-summary.json", "utf8")) as unknown,
  );
  if (!summary.success) throw new Error("Invalid k6 summary");
  const auctionId = summary.data.setup_data.auctionId;
  const sql = adminConnection(env.data.DATABASE_URL_ADMIN);
  try {
    const auction = await pollAuction(async () => {
      z.array(z.object({ closed: count }).strict())
        .length(1)
        .parse(await sql`select bidlock.close_due_auctions() as closed`);
      const [row] = z
        .array(
          Auction.extend({
            final_price: z
              .string()
              .regex(/^\d+$/)
              .transform(Number)
              .pipe(count)
              .nullable(),
          }).strict(),
        )
        .length(1)
        .parse(
          await sql`select id as auction_id, status,
          current_price::text as final_price, bid_count, extension_count
          from bidlock.auctions where id = ${auctionId}`,
        );
      if (!row) throw new Error("Missing benchmark auction");
      return row;
    });
    const text = await readFile("db/verify/invariants.sql", "utf8");
    const checks = Checks.parse(await sql.unsafe(text, [auctionId]));
    const result = Verification.parse({ ...auction, checks });
    await mkdir("bench/out", { recursive: true });
    await writeFile(
      "bench/out/verify.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    process.exitCode = verificationExitCode(result, env.data.BENCH_MIN_BIDS);
  } finally {
    await sql.end();
  }
});
