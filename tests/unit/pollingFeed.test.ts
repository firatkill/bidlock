import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PollingFeed } from "@/client/feed/PollingFeed";
import { auction, bid } from "../fixtures/auction";
import type { FeedEvent, FeedStatus } from "@/domain/feed";

let doc: EventTarget & { visibilityState: string };
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let stop: (() => void) | undefined;
let events: FeedEvent[];
let statuses: FeedStatus[];
const json = (value: unknown, etag = '"v1"') =>
  new Response(JSON.stringify(value), { headers: { etag } });
function start() {
  const feed = new PollingFeed(1000);
  stop = feed.subscribe(auction.id, {
    onEvent: (event) => {
      events.push(event);
    },
    onStatus: (status) => {
      statuses.push(status);
    },
  });
  return feed;
}
const flush = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("document", doc);
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  events = [];
  statuses = [];
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("TC-181: polling reuses ETags, ignores 304, fetches all 50-row gap pages", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ ...auction, bid_count: 51 }))
    .mockResolvedValueOnce(
      json({
        bids: Array.from({ length: 50 }, (_, i) => bid(i + 1)),
        next_cursor: null,
      }),
    )
    .mockResolvedValueOnce(json({ bids: [bid(51)], next_cursor: null }))
    .mockResolvedValue(new Response(null, { status: 304 }));
  const feed = start();
  await flush();
  expect(events.map((event) => event.kind)).toEqual([
    "snapshot",
    "bids",
    "bids",
  ]);
  expect(fetchMock.mock.calls[1]?.[0]).toContain("after=0&limit=50");
  expect(fetchMock.mock.calls[2]?.[0]).toContain("after=50&limit=50");
  await vi.advanceTimersByTimeAsync(1000);
  expect(
    new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get("if-none-match"),
  ).toBe('"v1"');
  expect(events).toHaveLength(3);
  expect(statuses.at(-1)).toBe("live");
  feed.refresh();
  await flush();
  expect(
    new Headers(fetchMock.mock.calls[4]?.[1]?.headers).has("if-none-match"),
  ).toBe(false);
});
test("TC-182: two failures reconnect, backoff caps at ten seconds and success recovers", async () => {
  fetchMock.mockRejectedValue(new TypeError("offline"));
  start();
  await flush();
  expect(statuses).toEqual(["connecting"]);
  await vi.advanceTimersByTimeAsync(1999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(statuses.at(-1)).toBe("reconnecting");
  await vi.advanceTimersByTimeAsync(4000);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(8000);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(9999);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  fetchMock.mockImplementation(() => Promise.resolve(json(auction)));
  await vi.advanceTimersByTimeAsync(1);
  expect(statuses.at(-1)).toBe("live");
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
test("TC-182: 5xx uses the same retry path and malformed payloads never emit", async () => {
  fetchMock
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "INTERNAL", message: "failed" },
          request_id: auction.id,
        }),
        { status: 500 },
      ),
    )
    .mockResolvedValueOnce(json({ ...auction, unexpected: true }))
    .mockImplementation(() => Promise.resolve(json(auction)));
  const feed = start();
  await flush();
  feed.refresh();
  await flush();
  expect(statuses.at(-1)).toBe("reconnecting");
  expect(events).toEqual([]);
  await vi.advanceTimersByTimeAsync(4000);
  expect(statuses.at(-1)).toBe("live");
  expect(events).toHaveLength(1);
});
test("TC-183: hidden tabs pause, visibility fetches immediately, unsubscribe prevents late events", async () => {
  fetchMock.mockImplementation(() => Promise.resolve(json(auction)));
  start();
  await flush();
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  stop?.();
  await vi.advanceTimersByTimeAsync(20000);
  doc.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
test("TC-183: private terminal polling stops at ten seconds", async () => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(json({ ...auction, status: "unsold" })),
  );
  start();
  await flush();
  await vi.advanceTimersByTimeAsync(9000);
  expect(fetchMock).toHaveBeenCalledTimes(10);
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetchMock).toHaveBeenCalledTimes(10);
});
test("TC-183: public terminal polling continues every five seconds until next id", async () => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(json({ ...auction, kind: "public", status: "settled" })),
  );
  start();
  await flush();
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      json({
        ...auction,
        kind: "public",
        status: "settled",
        next_public_auction_id: auction.id,
      }),
    ),
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetchMock).toHaveBeenCalledTimes(5);
});
test("TC-183: unsubscribe aborts an in-flight snapshot and suppresses delivery", async () => {
  let resolve: ((response: Response) => void) | undefined;
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  start();
  const signal = fetchMock.mock.calls[0]?.[1]?.signal;
  stop?.();
  expect(signal?.aborted).toBe(true);
  resolve?.(json(auction));
  await flush();
  expect(events).toEqual([]);
  expect(statuses).toEqual(["connecting"]);
  expect(vi.getTimerCount()).toBe(0);
});
