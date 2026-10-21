import { createClient } from "@supabase/supabase-js";
import { fetchBidsAfter, fetchSnapshot, localNow } from "@/client/api";
import {
  AuctionChangeSchema,
  type AuctionFeed,
  type FeedHandlers,
} from "./AuctionFeed";
import { PollingFeed } from "./PollingFeed";

export class SupabaseBroadcastFeed implements AuctionFeed {
  private stop: (() => void) | undefined;
  private refreshCurrent: (() => void) | undefined;
  private polling: PollingFeed | null = null;
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
  ) {}
  subscribe(auctionId: string, handlers: FeedHandlers): () => void {
    this.stop?.();
    if (this.polling) {
      this.stop = this.polling.subscribe(auctionId, handlers);
      return this.stop;
    }
    const client = createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const channel = client.channel(`auction:${auctionId}`, {
      config: { broadcast: { self: false }, private: false },
    });
    const controller = new AbortController();
    let stopped = false,
      live = false,
      failures = 0,
      running = false,
      queued = false,
      lastBidNo = 0;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let stopPolling: (() => void) | undefined;
    const inactive = () => stopped || this.polling !== null;
    const snapshot = async () => {
      if (inactive()) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        const result = await fetchSnapshot(auctionId, null, controller.signal);
        if (inactive() || !result) return;
        handlers.onEvent({
          kind: "snapshot",
          state: result.state,
          receivedAt: result.receivedAt,
          rttMs: result.rttMs,
        });
        if (result.state.bid_count > lastBidNo) {
          let full = true;
          while (full) {
            const page = await fetchBidsAfter(
              auctionId,
              lastBidNo,
              controller.signal,
            );
            if (inactive()) return;
            handlers.onEvent({ kind: "bids", bids: page.bids });
            const next = Math.max(
              lastBidNo,
              ...page.bids.map((bid) => bid.bid_no),
            );
            full = page.bids.length === 50 && next > lastBidNo;
            lastBidNo = next;
          }
        }
        if (live) handlers.onStatus("live");
      } catch {
        if (!inactive()) handlers.onStatus("reconnecting");
      } finally {
        running = false;
        if (queued) {
          queued = false;
          void snapshot();
        }
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void snapshot();
    };
    const safety = setInterval(() => {
      if (live && document.visibilityState !== "hidden") void snapshot();
    }, 15000);
    const detach = () => {
      clearTimeout(deadline);
      clearInterval(safety);
      controller.abort();
      document.removeEventListener("visibilitychange", visibility);
      void client.removeChannel(channel).catch(() => {});
    };
    const fallback = () => {
      if (inactive()) return;
      this.polling = new PollingFeed(2000);
      detach();
      stopPolling = this.polling.subscribe(auctionId, handlers);
    };
    const arm = () => {
      deadline ??= setTimeout(fallback, 10000);
    };
    this.refreshCurrent = () => {
      void snapshot();
    };
    document.addEventListener("visibilitychange", visibility);
    handlers.onStatus("connecting");
    arm();
    channel
      .on(
        "broadcast",
        { event: "auction_changed" },
        (message: { payload: unknown }) => {
          if (inactive()) return;
          const parsed = AuctionChangeSchema.safeParse(message.payload);
          if (parsed.success && parsed.data.auction_id === auctionId)
            handlers.onEvent({
              kind: "change",
              change: parsed.data,
              receivedAt: localNow(),
            });
          else void snapshot();
        },
      )
      .subscribe((status: string) => {
        if (inactive()) return;
        if (status === "SUBSCRIBED") {
          live = true;
          failures = 0;
          clearTimeout(deadline);
          deadline = undefined;
          handlers.onStatus("live");
          void snapshot();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          live = false;
          failures++;
          handlers.onStatus("reconnecting");
          arm();
          if (failures >= 3) fallback();
        }
      });
    const stop = () => {
      stopped = true;
      if (this.polling) stopPolling?.();
      else detach();
      if (this.stop === stop) this.refreshCurrent = undefined;
    };
    this.stop = stop;
    return stop;
  }
  refresh(): void {
    if (this.polling) this.polling.refresh();
    else this.refreshCurrent?.();
  }
}
