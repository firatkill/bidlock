import { z } from "zod";
import { Id } from "@/domain/schemas";
import type { AuctionFeed, FeedHandlers } from "./AuctionFeed";
import { PollingFeed } from "./PollingFeed";
const configSchema = z
  .object({
    mode: z.enum(["polling", "broadcast"]),
    interval: z.coerce.number().int().positive(),
    url: z.url().optional(),
    key: z.string().min(1).optional(),
  })
  .strict();
class LazyBroadcastFeed implements AuctionFeed {
  private feed: AuctionFeed | null = null;
  private stop: (() => void) | undefined;
  constructor(
    private readonly url: string,
    private readonly key: string,
  ) {}
  subscribe(id: string, handlers: FeedHandlers): () => void {
    this.stop?.();
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    handlers.onStatus("connecting");
    void import("./SupabaseBroadcastFeed")
      .then(({ SupabaseBroadcastFeed }) => {
        if (stopped) return;
        this.feed ??= new SupabaseBroadcastFeed(this.url, this.key);
        unsubscribe = this.feed.subscribe(id, handlers);
      })
      .catch(() => {
        if (stopped) return;
        this.feed = new PollingFeed(2000);
        unsubscribe = this.feed.subscribe(id, handlers);
      });
    const stop = () => {
      stopped = true;
      unsubscribe?.();
    };
    this.stop = stop;
    return stop;
  }
  refresh(): void {
    this.feed?.refresh();
  }
}
export function createFeed(auctionId: string): AuctionFeed {
  Id.parse(auctionId);
  const config = configSchema.parse({
    mode: process.env.NEXT_PUBLIC_FEED ?? "polling",
    interval: process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "1000",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  });
  return config.mode === "broadcast" && config.url && config.key
    ? new LazyBroadcastFeed(config.url, config.key)
    : new PollingFeed(config.interval);
}
