import { fetchBidsAfter, fetchSnapshot, localNow } from "@/client/api";
import type { AuctionState } from "@/domain/schemas";
import type { AuctionFeed, FeedHandlers } from "./AuctionFeed";

export class PollingFeed implements AuctionFeed {
  private stop: (() => void) | undefined;
  private requestRefresh: (() => void) | undefined;
  constructor(private readonly intervalMs: number) {}
  subscribe(auctionId: string, handlers: FeedHandlers): () => void {
    this.stop?.();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let etag: string | null = null;
    let lastBidNo = 0;
    let failures = 0;
    let running = false;
    let forced = false;
    let state: AuctionState | null = null;
    let terminalAt: number | null = null;
    const clear = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const visible = () => document.visibilityState !== "hidden";
    const stopped = () => controller.signal.aborted;
    const terminal = () =>
      state?.status === "settled" || state?.status === "unsold";
    const waitingForNext = () =>
      terminal() && state?.kind === "public" && !state.next_public_auction_id;
    const expired = () =>
      terminalAt !== null &&
      !waitingForNext() &&
      localNow() - terminalAt >= 10000;
    const schedule = () => {
      clear();
      if (stopped() || !visible() || expired()) return;
      let delay =
        failures > 0
          ? Math.min(this.intervalMs * 2 ** failures, 10000)
          : waitingForNext()
            ? 5000
            : this.intervalMs;
      if (terminalAt !== null && !waitingForNext())
        delay = Math.min(delay, Math.max(0, 10000 - (localNow() - terminalAt)));
      timer = setTimeout(() => {
        void poll();
      }, delay);
    };
    const poll = async () => {
      if (stopped() || !visible() || expired() || running) return;
      running = true;
      clear();
      try {
        const requestEtag = forced ? null : etag;
        forced = false;
        const snapshot = await fetchSnapshot(
          auctionId,
          requestEtag,
          controller.signal,
        );
        if (stopped()) return;
        if (snapshot) {
          state = snapshot.state;
          etag = snapshot.etag;
          if (terminal() && terminalAt === null)
            terminalAt = snapshot.receivedAt;
          handlers.onEvent({
            kind: "snapshot",
            state,
            receivedAt: snapshot.receivedAt,
            rttMs: snapshot.rttMs,
          });
        }
        if (state && state.bid_count > lastBidNo) {
          let fullPage = true;
          while (fullPage && !stopped()) {
            const page = await fetchBidsAfter(
              auctionId,
              lastBidNo,
              controller.signal,
            );
            if (stopped()) return;
            handlers.onEvent({ kind: "bids", bids: page.bids });
            const next = Math.max(
              lastBidNo,
              ...page.bids.map((bid) => bid.bid_no),
            );
            fullPage = page.bids.length === 50 && next > lastBidNo;
            lastBidNo = next;
          }
        }
        failures = 0;
        handlers.onStatus("live");
      } catch {
        if (!stopped()) {
          failures++;
          if (failures >= 2) handlers.onStatus("reconnecting");
        }
      } finally {
        running = false;
        if (forced && !stopped() && visible()) void poll();
        else schedule();
      }
    };
    const refresh = () => {
      forced = true;
      void poll();
    };
    const visibility = () => {
      if (visible()) refresh();
      else clear();
    };
    this.requestRefresh = refresh;
    document.addEventListener("visibilitychange", visibility);
    handlers.onStatus("connecting");
    void poll();
    const stop = () => {
      controller.abort();
      clear();
      document.removeEventListener("visibilitychange", visibility);
      if (this.stop === stop) {
        this.requestRefresh = undefined;
        this.stop = undefined;
      }
    };
    this.stop = stop;
    return stop;
  }
  refresh(): void {
    this.requestRefresh?.();
  }
}
