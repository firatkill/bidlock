import { z } from "zod";
import { Id } from "@/domain/schemas";
import type { AuctionFeed } from "./AuctionFeed";
import { PollingFeed } from "./PollingFeed";

/** Broadcast selection is added in T-31; polling is the local/CI transport. */
export function createFeed(auctionId: string): AuctionFeed {
  Id.parse(auctionId);
  const configured = z.coerce
    .number()
    .int()
    .positive()
    .parse(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "1000");
  return new PollingFeed(configured);
}
