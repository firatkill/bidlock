import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { z } from "zod";
import {
  adminSql,
  createSql,
  makeAuction,
  makeBidders,
  BidResultRow,
} from "../fixtures/db";
import { incrementFor, minNextBid } from "../../src/domain/increments";

test("TC-122 INT-01: 500 parallel bids from 200 bidders keep every invariant", async () => {
  const app = createSql(
    process.env.DATABASE_URL ??
      "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
    50,
  );
  const admin = adminSql();
  try {
    const bidders = await makeBidders(200);
    const auctionId = await makeAuction({
      duration_s: 600,
      starting_price: 1000,
      snipe_window_s: 0,
    });
    const stateSchema = z
      .array(
        z
          .object({
            starting_price: z.number().int(),
            current_price: z.number().int().nullable(),
          })
          .strict(),
      )
      .length(1);
    type Call = { bidder: string; key: string; amount: number };
    const results: Array<{ call: Call; row: z.infer<typeof BidResultRow> }> =
      [];
    await Promise.all(
      Array.from({ length: 500 }, async (_, i) => {
        const connection = await app.reserve();
        try {
          const bidder = bidders[i % 200];
          if (!bidder) throw new Error("Missing bidder fixture");
          const state = stateSchema.parse(
            await admin`select starting_price,current_price from bidlock.auctions where id=${auctionId}`,
          )[0];
          if (!state) throw new Error("Missing auction state");
          const amount =
            minNextBid(state.starting_price, state.current_price) +
            incrementFor(state.current_price ?? state.starting_price) *
              Math.floor(Math.random() * 3);
          const call = { bidder, key: crypto.randomUUID(), amount };
          const row = z
            .array(BidResultRow)
            .length(1)
            .parse(
              await connection`select * from bidlock.place_bid(${auctionId},${bidder},${amount},${call.key})`,
            )[0];
          if (!row) throw new Error("Missing bid result");
          results.push({ call, row });
        } finally {
          connection.release();
        }
      }),
    );
    expect(results).toHaveLength(500);
    for (const { row } of results)
      expect(row.outcome === "accepted" ? "accepted" : row.error_code).toMatch(
        /^(accepted|BID_TOO_LOW|ALREADY_LEADING)$/,
      );
    const accepted = results.filter(({ row }) => row.outcome === "accepted");
    expect(accepted.length).toBeGreaterThanOrEqual(20);
    const state = z
      .array(
        z
          .object({
            bid_count: z.number().int(),
            leader_bidder_id: z.uuid(),
            current_price: z.number().int(),
          })
          .strict(),
      )
      .length(1)
      .parse(
        await admin`select bid_count,leader_bidder_id,current_price from bidlock.auctions where id=${auctionId}`,
      )[0];
    if (!state) throw new Error("Missing final state");
    const bids = z
      .array(
        z
          .object({
            bid_no: z.number().int(),
            bidder_id: z.uuid(),
            amount: z.number().int(),
          })
          .strict(),
      )
      .parse(
        await admin`select bid_no,bidder_id,amount from bidlock.bids where auction_id=${auctionId} order by bid_no`,
      );
    expect(state.bid_count).toBe(accepted.length);
    expect(bids).toHaveLength(accepted.length);
    expect(state.leader_bidder_id).toBe(bids.at(-1)?.bidder_id);
    expect(state.current_price).toBe(
      Math.max(...accepted.map(({ call }) => call.amount)),
    );
    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const previous = bids[i - 1];
      if (!bid) throw new Error("Missing bid row");
      expect(bid.bid_no).toBe(i + 1);
      expect(bid.amount).toBeGreaterThanOrEqual(
        previous ? previous.amount + incrementFor(previous.amount) : 1000,
      );
      if (previous) expect(bid.bidder_id).not.toBe(previous.bidder_id);
    }
    // Fisher-Yates sample without replacement; replay both accepted and rejected outcomes.
    const shuffled = [...results];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const x = shuffled[i];
      const y = shuffled[j];
      if (x && y) {
        shuffled[i] = y;
        shuffled[j] = x;
      }
    }
    await Promise.all(
      shuffled.slice(0, 60).map(async ({ call, row: original }, i) => {
        const amount = call.amount + (i < 50 ? 0 : 1);
        const replay = z
          .array(BidResultRow)
          .length(1)
          .parse(
            await app`select * from bidlock.place_bid(${auctionId},${call.bidder},${amount},${call.key})`,
          )[0];
        if (!replay) throw new Error("Missing replay");
        if (i < 50) expect(replay).toEqual({ ...original, replayed: true });
        else expect(replay.error_code).toBe("IDEMPOTENCY_MISMATCH");
      }),
    );
    const counts = z
      .array(z.object({ n: z.number().int() }).strict())
      .length(1)
      .parse(
        await admin`select count(*)::integer as n from bidlock.bid_requests where auction_id=${auctionId}`,
      );
    expect(counts[0]?.n).toBe(
      new Set(results.map(({ call }) => call.bidder + ":" + call.key)).size,
    );
    const checks = z
      .array(
        z
          .object({
            id: z.string(),
            check: z.string(),
            violations: z.number().int(),
          })
          .strict(),
      )
      .parse(
        await admin.unsafe(await readFile("db/verify/invariants.sql", "utf8"), [
          auctionId,
        ]),
      );
    expect(checks.length).toBeGreaterThanOrEqual(16);
    expect(checks.filter(({ violations }) => violations !== 0)).toEqual([]);
  } finally {
    await Promise.all([app.end(), admin.end()]);
  }
});
