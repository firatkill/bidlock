import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SupabaseBroadcastFeed } from "@/client/feed/SupabaseBroadcastFeed";
import { fetchSnapshot, fetchBidsAfter } from "@/client/api";
import { auction, bid } from "../fixtures/auction";
import type { FeedEvent } from "@/domain/feed";
const mocks = vi.hoisted(() => ({
  status: undefined as ((status: string) => void) | undefined,
  payload: undefined as ((message: { payload: unknown }) => void) | undefined,
  client: vi.fn(),
  channel: vi.fn(),
  remove: vi.fn(() => Promise.resolve("ok")),
  fallback: vi.fn(),
  fallbackSubscribe: vi.fn(),
  fallbackStop: vi.fn(),
  fallbackRefresh: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mocks.client(...args);
    const channel = {
      on: (
        _event: string,
        _filter: unknown,
        callback: (message: { payload: unknown }) => void,
      ) => {
        mocks.payload = callback;
        return channel;
      },
      subscribe: (callback: (status: string) => void) => {
        mocks.status = callback;
        return channel;
      },
    };
    return {
      channel: (...options: unknown[]) => {
        mocks.channel(...options);
        return channel;
      },
      removeChannel: mocks.remove,
    };
  },
}));
vi.mock("@/client/api", () => ({
  fetchSnapshot: vi.fn(),
  fetchBidsAfter: vi.fn(),
  localNow: () => performance.timeOrigin + performance.now(),
}));
vi.mock("@/client/feed/PollingFeed", () => ({
  PollingFeed: class {
    constructor(interval: number) {
      mocks.fallback(interval);
    }
    subscribe(...args: unknown[]) {
      mocks.fallbackSubscribe(...args);
      return mocks.fallbackStop;
    }
    refresh() {
      mocks.fallbackRefresh();
    }
  },
}));
let documentState: EventTarget & { visibilityState: string };
let stop: (() => void) | undefined;
const events: FeedEvent[] = [];
const status = vi.fn();
const flush = () => vi.advanceTimersByTimeAsync(0);
function start() {
  const feed = new SupabaseBroadcastFeed(
    "https://example.supabase.co",
    "public-key",
  );
  stop = feed.subscribe(auction.id, {
    onEvent: (event) => {
      events.push(event);
    },
    onStatus: status,
  });
  return feed;
}
beforeEach(() => {
  vi.clearAllMocks();
  events.length = 0;
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "performance",
    ],
  });
  documentState = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  vi.stubGlobal("document", documentState);
  vi.mocked(fetchSnapshot).mockResolvedValue({
    state: auction,
    etag: "v1",
    receivedAt: 1000,
    rttMs: 20,
  });
  vi.mocked(fetchBidsAfter).mockResolvedValue({ bids: [], next_cursor: null });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("TC-194: public subscription, reconnect snapshot and strict payload validation", async () => {
  start();
  expect(mocks.client).toHaveBeenCalledWith(
    "https://example.supabase.co",
    "public-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect(mocks.channel).toHaveBeenCalledWith(`auction:${auction.id}`, {
    config: { broadcast: { self: false }, private: false },
  });
  mocks.status?.("SUBSCRIBED");
  await flush();
  expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  mocks.status?.("CHANNEL_ERROR");
  mocks.status?.("SUBSCRIBED");
  await flush();
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  const payload = {
    v: 1,
    auction_id: auction.id,
    version: 2,
    status: "live",
    payment_state: null,
    current_price: 1000,
    leader: { id: auction.id, display_name: "Bidder", is_bot: false },
    bid_count: 1,
    ends_at: auction.ends_at,
    extension_count: 0,
    bid: bid(1),
    sent_at: auction.server_now,
  };
  mocks.payload?.({ payload });
  expect(events.at(-1)?.kind).toBe("change");
  for (const invalid of [
    { ...payload, v: 2 },
    { ...payload, unknown: true },
    { ...payload, bid: { ...bid(1), unknown: true } },
  ]) {
    mocks.payload?.({ payload: invalid });
    await flush();
  }
  expect(fetchSnapshot).toHaveBeenCalledTimes(5);
});
test("TC-195: three channel failures permanently switch to polling at 2000 ms", async () => {
  const feed = start();
  for (const error of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])
    mocks.status?.(error);
  expect(mocks.fallback).toHaveBeenCalledExactlyOnceWith(2000);
  expect(mocks.remove).toHaveBeenCalledOnce();
  mocks.status?.("SUBSCRIBED");
  await flush();
  expect(fetchSnapshot).not.toHaveBeenCalled();
  feed.refresh();
  expect(mocks.fallbackRefresh).toHaveBeenCalledOnce();
  stop?.();
  expect(mocks.fallbackStop).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
test.each([false, true])(
  "TC-195: initial/reconnect timeout falls back after ten seconds (reconnect=%s)",
  async (reconnect) => {
    start();
    if (reconnect) {
      mocks.status?.("SUBSCRIBED");
      await flush();
      mocks.status?.("CHANNEL_ERROR");
    }
    await vi.advanceTimersByTimeAsync(9999);
    expect(mocks.fallback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.fallback).toHaveBeenCalledExactlyOnceWith(2000);
  },
);
test("TC-195: live safety poll, visible refresh, recovery cancels fallback and unsubscribe cleans up", async () => {
  start();
  mocks.status?.("SUBSCRIBED");
  await flush();
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  documentState.visibilityState = "hidden";
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  documentState.visibilityState = "visible";
  documentState.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  mocks.status?.("CHANNEL_ERROR");
  await vi.advanceTimersByTimeAsync(9000);
  mocks.status?.("SUBSCRIBED");
  await flush();
  await vi.advanceTimersByTimeAsync(1000);
  expect(mocks.fallback).not.toHaveBeenCalled();
  stop?.();
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
