import { z } from "zod";
import { AuctionState, BidItem, Id, Iso } from "./schemas";

/** TRD §8.1: every Broadcast boundary validates the complete v1 payload. */
export const AuctionChangeSchema = AuctionState.pick({
  version: true,
  status: true,
  payment_state: true,
  current_price: true,
  leader: true,
  bid_count: true,
  ends_at: true,
  extension_count: true,
})
  .extend({
    v: z.literal(1),
    auction_id: Id,
    bid: BidItem.nullable(),
    sent_at: Iso,
  })
  .strict();
export type AuctionChange = z.infer<typeof AuctionChangeSchema>;
export type FeedStatus = "connecting" | "live" | "reconnecting";
export type FeedEvent =
  | {
      kind: "snapshot";
      state: AuctionState;
      receivedAt: number;
      rttMs: number | null;
    }
  | { kind: "change"; change: AuctionChange; receivedAt: number }
  | { kind: "bids"; bids: BidItem[] };
