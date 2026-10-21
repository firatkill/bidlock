import type { FeedEvent } from "./feed";
import { incrementFor, maxBid, minNextBid } from "./increments";
import type { AuctionState, BidItem } from "./schemas";

export interface RoomState {
  auction: AuctionState | null;
  bids: BidItem[];
  lastBidNo: number;
  pendingRefetch: boolean;
  pendingBidsAfter: number | null;
  lastExtension: { n: number; durationMs: number; at: number } | null;
}

export function reduce(state: RoomState, event: FeedEvent): RoomState {
  if (event.kind === "bids") {
    const bids = new Map(state.bids.map((bid) => [bid.bid_no, bid]));
    for (const bid of event.bids) {
      if (!bids.has(bid.bid_no)) bids.set(bid.bid_no, bid);
    }
    const sorted = [...bids.values()]
      .sort((a, b) => b.bid_no - a.bid_no)
      .slice(0, 100);
    return {
      ...state,
      bids: sorted,
      lastBidNo: Math.max(state.lastBidNo, sorted[0]?.bid_no ?? 0),
      pendingBidsAfter: null,
    };
  }
  if (event.kind === "snapshot") {
    if (state.auction && event.state.version < state.auction.version)
      return state;
    const auction = event.state;
    const extension = auction.last_extension;
    return {
      ...state,
      auction,
      pendingRefetch: false,
      pendingBidsAfter:
        auction.bid_count > state.lastBidNo ? state.lastBidNo : null,
      lastExtension:
        extension &&
        auction.extension_count > (state.auction?.extension_count ?? 0)
          ? {
              n: auction.extension_count,
              durationMs:
                Date.parse(auction.ends_at) - Date.parse(extension.at),
              at: event.receivedAt,
            }
          : state.lastExtension,
    };
  }
  const held = state.auction;
  if (!held) return { ...state, pendingRefetch: true };
  const change = event.change;
  if (change.version <= held.version) return state;
  const versionGap = change.version > held.version + 1;
  const { bid } = change;
  const auction = {
    ...held,
    version: change.version,
    status: change.status,
    payment_state: change.payment_state,
    current_price: change.current_price,
    leader: change.leader,
    bid_count: change.bid_count,
    ends_at: change.ends_at,
    extension_count: change.extension_count,
    increment: incrementFor(change.current_price ?? held.starting_price),
    min_next_bid: minNextBid(held.starting_price, change.current_price),
    max_bid: maxBid(held.starting_price, change.current_price),
  };
  const next: RoomState = {
    ...state,
    auction,
    pendingRefetch:
      state.pendingRefetch ||
      versionGap ||
      change.status !== held.status ||
      change.payment_state !== held.payment_state,
    pendingBidsAfter:
      versionGap || (bid && bid.bid_no > state.lastBidNo + 1)
        ? state.lastBidNo
        : state.pendingBidsAfter,
  };
  if (!versionGap && bid?.bid_no === state.lastBidNo + 1) {
    next.bids = [bid, ...state.bids].slice(0, 100);
    next.lastBidNo = bid.bid_no;
  }
  if (change.extension_count > held.extension_count && bid) {
    next.lastExtension = {
      n: change.extension_count,
      durationMs: Date.parse(change.ends_at) - Date.parse(bid.placed_at),
      at: event.receivedAt,
    };
  }
  return next;
}
