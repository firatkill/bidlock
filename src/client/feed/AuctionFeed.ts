import type { FeedEvent, FeedStatus } from "@/domain/feed";
export { AuctionChangeSchema } from "@/domain/feed";
export type { AuctionChange, FeedEvent, FeedStatus } from "@/domain/feed";
export interface FeedHandlers {
  onEvent(event: FeedEvent): void;
  onStatus(status: FeedStatus): void;
}
export interface AuctionFeed {
  subscribe(auctionId: string, handlers: FeedHandlers): () => void;
  refresh(): void;
}
