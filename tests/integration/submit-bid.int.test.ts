import { afterAll, expect, test } from "vitest";
import { z } from "zod";
import { PrepareBidResult } from "@/domain/schemas";
import {
  adminSql,
  createSql,
  makeAuction,
  makeBidders,
  BidResultRow,
} from "../fixtures/db";
const admin = adminSql();
const app = createSql(
  process.env.DATABASE_URL ??
    "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
  20,
);
afterAll(async () => {
  await Promise.all([app.end(), admin.end()]);
});
const rows = z.array(z.object({ result: PrepareBidResult }).strict()).length(1);
async function submit(a: string, b: string, key: string, ip: string) {
  const r = rows.parse(
    await app`select bidlock.prepare_bid(${b},null,${ip}) as result`,
  )[0];
  if (!r || r.result.kind !== "ready") throw new Error("Expected bid result");
  const result = z
    .array(BidResultRow)
    .length(1)
    .parse(
      await app`select * from bidlock.place_bid(${a},${r.result.bidder_id},1000,${key})`,
    )[0];
  if (!result) throw new Error("Missing bid result");
  return result;
}
test("TC-282: two-call bid transactions serialize a shared-IP auction", async () => {
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
test("TC-282: two-call concurrent replay writes one bid and retains all rate hits", async () => {
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

test("TC-282: rate counter is unlocked while the bid waits for its auction", async () => {
  const [bidder] = await makeBidders(1);
  if (!bidder) throw new Error("Missing bidder");
  const auction = await makeAuction({ duration_s: 600, snipe_window_s: 0 });
  const ip = crypto.randomUUID();
  let bid: Promise<unknown> | undefined;
  try {
    await admin.begin(async (tx) => {
      await tx`select id from bidlock.auctions where id=${auction} for update`;
      const prepared = rows.parse(
        await app`select bidlock.prepare_bid(${bidder},null,${ip}) as result`,
      )[0];
      expect(prepared?.result.kind).toBe("ready");
      bid =
        app`select * from bidlock.place_bid(${auction},${bidder},1000,${crypto.randomUUID()})`.then(
          (r) => r,
        );
      // NOWAIT fails immediately if preparation retained the rate-counter lock.
      const counter =
        await tx`select hits from bidlock.rate_counters where bucket=${"bid_ip_60s:" + ip} for update nowait`;
      expect(counter).toHaveLength(1);
    });
  } finally {
    await bid;
  }
});
