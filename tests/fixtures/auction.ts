import type { AuctionState, BidItem } from "@/domain/schemas";
const id = "00000000-0000-4000-8000-000000000001";
const at = "2026-01-01T00:00:00.000Z";
const ends = "2026-01-01T00:00:30.000Z";
export const auction: AuctionState = {
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
export function bid(n: number): BidItem {
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
