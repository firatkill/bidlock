import { afterAll, expect, test } from "vitest";
import { z } from "zod";
import { SubmitBidResult } from "@/domain/schemas";
import { adminSql, createSql, makeAuction, makeBidders } from "../fixtures/db";
const admin = adminSql();
const app = createSql(
  process.env.DATABASE_URL ??
    "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
  20,
);
afterAll(async () => {
  await Promise.all([app.end(), admin.end()]);
});
const rows = z.array(z.object({ result: SubmitBidResult }).strict()).length(1);
async function submit(a: string, b: string, key: string, ip: string) {
  const r = rows.parse(
    await app`select bidlock.submit_bid(${b},null,${a},1000,${key},${ip}) as result`,
  )[0];
  if (!r || r.result.kind !== "bid") throw new Error("Expected bid result");
  return r.result.result;
}
test("TC-278: composed bid transactions serialize a shared-IP auction", async () => {
  const bidders = await makeBidders(20);
  const auction = await makeAuction({ duration_s: 600, snipe_window_s: 0 });
  const ip = crypto.randomUUID();
  const results = await Promise.all(
    bidders.map((b) => submit(auction, b, crypto.randomUUID(), ip)),
  );
  expect(results.filter((r) => r.outcome === "accepted")).toHaveLength(1);
  expect(results.filter((r) => r.error_code === "BID_TOO_LOW")).toHaveLength(
    19,
  );
});
test("TC-278: composed concurrent replay writes one bid and retains all rate hits", async () => {
  const [bidder] = await makeBidders(1);
  if (!bidder) throw new Error("Missing bidder");
  const auction = await makeAuction({ duration_s: 600, snipe_window_s: 0 });
  const key = crypto.randomUUID(),
    ip = crypto.randomUUID();
  const results = await Promise.all(
    Array.from({ length: 3 }, () => submit(auction, bidder, key, ip)),
  );
  expect(results.every((r) => r.outcome === "accepted")).toBe(true);
  expect(results.filter((r) => r.replayed)).toHaveLength(2);
  expect(new Set(results.map((r) => r.bid_id)).size).toBe(1);
  const counts = z
    .array(z.object({ hits: z.number() }).strict())
    .parse(
      await admin`select sum(hits)::integer hits from bidlock.rate_counters where bucket=${"bid_bidder_60s:" + bidder}`,
    );
  expect(counts[0]?.hits).toBe(3);
});
