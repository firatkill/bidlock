import { describe, expect, it } from "vitest";
import { AuctionChangeSchema, type FeedEvent } from "@/domain/feed";
import { reduce, type RoomState } from "@/domain/reconcile";
import type { AuctionState, BidItem } from "@/domain/schemas";

const id = "00000000-0000-4000-8000-000000000001";
const at = "2026-01-01T00:00:00.000Z";
const ends = "2026-01-01T00:00:30.000Z";
const auction: AuctionState = {
  id,
  lot_no: 1,
  kind: "test",
  title: "Test lot",
  status: "live",
  payment_state: null,
  starting_price: 1000,
  current_price: null,
  min_next_bid: 1000,
  max_bid: 11000,
  increment: 100,
  bid_count: 0,
  leader: null,
  starts_at: at,
  ends_at: ends,
  original_ends_at: ends,
  closed_at: null,
  settled_at: null,
  snipe_window_s: 10,
  extend_by_s: 30,
  max_extensions: 20,
  extension_count: 0,
  last_extension: null,
  offer: null,
  expired_offers: [],
  sandbox: null,
  next_public_auction_id: null,
  version: 1,
  server_now: at,
};
function room(value: AuctionState | null = auction): RoomState {
  return {
    auction: value,
    bids: [],
    lastBidNo: 0,
    pendingRefetch: false,
    pendingBidsAfter: null,
    lastExtension: null,
  };
}
function bid(n: number): BidItem {
  return {
    id,
    bid_no: n,
    bidder_id: id,
    display_name: "Bidder",
    is_bot: false,
    amount: 1000,
    placed_at: at,
    extended: false,
  };
}
function change(
  overrides: Partial<Extract<FeedEvent, { kind: "change" }>["change"]> = {},
): FeedEvent {
  return {
    kind: "change",
    receivedAt: 12345,
    change: {
      v: 1,
      auction_id: id,
      version: 2,
      status: "live",
      payment_state: null,
      current_price: 1000,
      leader: { id, display_name: "Bidder", is_bot: false },
      bid_count: 1,
      ends_at: ends,
      extension_count: 0,
      bid: bid(1),
      sent_at: at,
      ...overrides,
    },
  };
}
function snapshot(state: AuctionState): FeedEvent {
  return { kind: "snapshot", state, receivedAt: 12345, rttMs: 50 };
}
describe("UT-04 reconciler (FR-47)", () => {
  it("TC-178: snapshots seed state, refresh equal versions and reject stale versions", () => {
    const seeded = reduce(room(null), snapshot(auction));
    expect(seeded.auction).toEqual(auction);
    const pending = { ...seeded, pendingRefetch: true };
    const refreshed = reduce(
      pending,
      snapshot({ ...auction, server_now: ends, bid_count: 2 }),
    );
    expect(refreshed.auction?.server_now).toBe(ends);
    expect(refreshed.pendingRefetch).toBe(false);
    expect(refreshed.pendingBidsAfter).toBe(0);
    const newer = room({ ...auction, version: 3 });
    expect(reduce(newer, snapshot(auction))).toBe(newer);
    expect(reduce(newer, change())).toBe(newer);
    expect(reduce(room(), change({ version: 1 }))).toEqual(room());
  });
  it("TC-178: sequential changes recompute display values; gaps and settlement request snapshots", () => {
    const next = reduce(room(), change({ current_price: 5000 }));
    expect(next.auction).toMatchObject({
      current_price: 5000,
      increment: 200,
      min_next_bid: 5200,
      max_bid: 25200,
      version: 2,
    });
    expect(next.pendingRefetch).toBe(false);
    expect(next.bids).toEqual([bid(1)]);
    expect(next.lastBidNo).toBe(1);
    const gap = reduce(next, change({ version: 4, bid: bid(3), bid_count: 3 }));
    expect(gap).toMatchObject({
      pendingRefetch: true,
      pendingBidsAfter: 1,
      lastBidNo: 1,
    });
    expect(gap.auction?.version).toBe(4);
    expect(
      reduce(next, change({ version: 3, status: "closed", bid: null }))
        .pendingRefetch,
    ).toBe(true);
    expect(
      reduce(
        next,
        change({ version: 3, payment_state: "awaiting_payment", bid: null }),
      ).pendingRefetch,
    ).toBe(true);
    expect(reduce(room(null), change()).pendingRefetch).toBe(true);
    const emptyPrice = reduce(
      room(),
      change({ current_price: null, bid: null }),
    );
    expect(emptyPrice.auction?.min_next_bid).toBe(1000);
  });
  it("TC-179: bid gaps request history, dedupe by bid_no, sort and cap at 100", () => {
    const gap = reduce(room(), change({ bid: bid(3), bid_count: 3 }));
    expect(gap.pendingBidsAfter).toBe(0);
    expect(gap.bids).toEqual([]);
    const filled = reduce(gap, {
      kind: "bids",
      bids: [bid(2), bid(1), bid(3), bid(2)],
    });
    expect(filled.bids.map((b) => b.bid_no)).toEqual([3, 2, 1]);
    expect(filled.lastBidNo).toBe(3);
    expect(filled.pendingBidsAfter).toBeNull();
    const many = reduce(filled, {
      kind: "bids",
      bids: Array.from({ length: 120 }, (_, i) => bid(i + 1)),
    });
    expect(many.bids).toHaveLength(100);
    expect(many.bids[0]?.bid_no).toBe(120);
    expect(many.bids[99]?.bid_no).toBe(21);
    expect(reduce(many, { kind: "bids", bids: [] }).lastBidNo).toBe(120);
    expect(reduce(room(), { kind: "bids", bids: [] }).lastBidNo).toBe(0);
  });
  it("TC-179: detects 30-second extensions from changes and snapshots using receipt time", () => {
    const extended = reduce(
      room(),
      change({ extension_count: 1, bid: { ...bid(1), extended: true } }),
    );
    expect(extended.lastExtension).toEqual({
      n: 1,
      durationMs: 30000,
      at: 12345,
    });
    expect(
      reduce(extended, change({ version: 3, bid: bid(2), extension_count: 1 }))
        .lastExtension,
    ).toEqual(extended.lastExtension);
    const updated = {
      ...auction,
      version: 3,
      extension_count: 2,
      last_extension: {
        n: 2,
        bid_id: id,
        old_ends_at: at,
        new_ends_at: ends,
        at,
      },
    };
    expect(reduce(extended, snapshot(updated)).lastExtension).toEqual({
      n: 2,
      durationMs: 30000,
      at: 12345,
    });
    expect(reduce(room(), snapshot(auction)).lastExtension).toBeNull();
  });
  it("TC-178: Broadcast schema rejects unknown versions, extra keys and malformed nested bids", () => {
    const event = change();
    if (event.kind !== "change") throw new Error("fixture must be a change");
    expect(AuctionChangeSchema.safeParse(event.change).success).toBe(true);
    for (const invalid of [
      { ...event.change, v: 2 },
      { ...event.change, extra: true },
      { ...event.change, bid: { ...bid(1), extra: true } },
    ]) {
      expect(AuctionChangeSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
