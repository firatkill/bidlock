import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import {
  BotRunner,
  startBotLoops,
  type RunnerView,
} from "@/client/bots/BotRunner";
import { request, fetchSnapshot, ApiError } from "@/client/api";
import { ClockSync } from "@/domain/clock";
import { sandboxCopy } from "@/domain/copy";
import type { AuctionState } from "@/domain/schemas";
import { auction } from "../fixtures/auction";
vi.mock("@/client/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/client/api")>()),
  request: vi.fn(),
  fetchSnapshot: vi.fn(),
  localNow: () => Date.now(),
}));
const start = Date.parse(auction.starts_at);
const owner = crypto.randomUUID(),
  sid = crypto.randomUUID();
const tokens = {
  auction_id: auction.id,
  bot_seed: 42,
  expires_at: new Date(start + 900000).toISOString(),
  bots: ["cautious", "steady", "sniper"].map((persona, index) => ({
    id: crypto.randomUUID(),
    persona,
    display_name: persona + " bot",
    token: `token-${String(index)}`,
  })),
};
let room: AuctionState;
let view: RunnerView;
let dispose: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  room = {
    ...auction,
    kind: "sandbox",
    ends_at: new Date(start + 120000).toISOString(),
    sandbox: { id: sid, owner_id: owner, expires_at: tokens.expires_at },
  };
  view = { bots: [], hidden: false, error: false };
  vi.mocked(request).mockImplementation((path) =>
    Promise.resolve(path === "/api/bot-tokens" ? tokens : {}),
  );
  vi.mocked(fetchSnapshot).mockImplementation(() =>
    Promise.resolve({
      state: room,
      receivedAt: Date.now(),
      rttMs: 0,
      etag: null,
    }),
  );
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
async function launch() {
  const runner = startBotLoops({
    sandboxId: sid,
    auctionId: room.id,
    now: () => Date.now(),
    room: () => room,
    snapshot: (value) => {
      room = value.state;
    },
    view: (value) => {
      view = value;
    },
  });
  dispose = runner.stop;
  await vi.advanceTimersByTimeAsync(0);
  return runner;
}
const bids = () =>
  vi.mocked(request).mock.calls.filter(([path]) => path.endsWith("/bids"));
test("TC-222: runner fetches tokens once and sends independently keyed bot bids", async () => {
  await launch();
  expect(view.bots).toHaveLength(3);
  await vi.advanceTimersByTimeAsync(15000);
  expect(
    vi
      .mocked(request)
      .mock.calls.filter(([path]) => path === "/api/bot-tokens"),
  ).toHaveLength(1);
  expect(bids().length).toBeGreaterThan(0);
  const keys: string[] = [];
  for (const [, , init] of bids()) {
    expect(new Headers(init?.headers).get("authorization")).toMatch(
      /^Bot token-[012]$/,
    );
    if (typeof init?.body !== "string")
      throw new Error("Expected JSON request body");
    const body = JSON.parse(init.body) as {
      amount: number;
      idempotency_key: string;
    };
    expect(Number.isSafeInteger(body.amount)).toBe(true);
    expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    keys.push(body.idempotency_key);
  }
  expect(new Set(keys).size).toBe(keys.length);
});
test("TC-222: token failure renders exact copy", async () => {
  vi.mocked(request).mockRejectedValue(new Error("Offline"));
  render(
    <BotRunner
      auction={room}
      clock={new ClockSync()}
      onSnapshot={() => undefined}
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("alert").textContent).toBe(sandboxCopy.tokenError);
});
test("TC-223: hidden tabs pause, visible tabs need a fresh snapshot, and unmount cancels", async () => {
  await launch();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(10000);
  expect(bids()).toHaveLength(0);
  expect(view.hidden).toBe(true);
  expect(view.bots.every((bot) => bot.status === "paused")).toBe(true);
  vi.mocked(fetchSnapshot).mockRejectedValue(new Error("Offline"));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(bids()).toHaveLength(0);
  vi.mocked(fetchSnapshot).mockResolvedValue({
    state: room,
    receivedAt: Date.now(),
    rttMs: 0,
    etag: null,
  });
  await vi.advanceTimersByTimeAsync(10000);
  expect(bids().length).toBeGreaterThan(0);
  dispose?.();
  const count = bids().length;
  await vi.advanceTimersByTimeAsync(10000);
  expect(bids()).toHaveLength(count);
  expect(vi.getTimerCount()).toBe(0);
});
test("TC-223: token expiry and terminal snapshots cancel every loop", async () => {
  const runner = await launch();
  room = { ...room, status: "settled" };
  runner.sync();
  await vi.advanceTimersByTimeAsync(10000);
  expect(bids()).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  room = { ...room, status: "live" };
  vi.setSystemTime(Date.parse(tokens.expires_at));
  await launch();
  await vi.advanceTimersByTimeAsync(10000);
  expect(bids()).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});
test("TC-224: rate limits defer bids and low bids have no immediate retry", async () => {
  const attempts: { at: number; token: string }[] = [];
  vi.mocked(request).mockImplementation((path, _schema, init) => {
    if (path === "/api/bot-tokens") return Promise.resolve(tokens);
    const token = new Headers(init?.headers).get("authorization") ?? "";
    attempts.push({ at: Date.now(), token });
    throw new ApiError(429, {
      error: {
        code: "RATE_LIMITED",
        message: "RATE_LIMITED",
        details: { retry_after_ms: 10000 },
      },
      request_id: crypto.randomUUID(),
    });
  });
  await launch();
  await vi.advanceTimersByTimeAsync(30000);
  for (const token of ["Bot token-0", "Bot token-1", "Bot token-2"]) {
    const times = attempts.filter((a) => a.token === token).map((a) => a.at);
    for (let i = 1; i < times.length; i++)
      expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        10000,
      );
  }
  expect(attempts.length).toBeGreaterThan(1);
  dispose?.();
  vi.mocked(request).mockClear();
  vi.mocked(request).mockImplementation((path) => {
    if (path === "/api/bot-tokens") return Promise.resolve(tokens);
    throw new ApiError(409, {
      error: { code: "BID_TOO_LOW", message: "BID_TOO_LOW" },
      request_id: crypto.randomUUID(),
    });
  });
  await launch();
  await vi.advanceTimersByTimeAsync(1000);
  const count = bids().length;
  await vi.advanceTimersByTimeAsync(999);
  expect(bids()).toHaveLength(count);
});
test("TC-224: closed bid response switches to delayed bot payment", async () => {
  const steady = tokens.bots[1];
  if (!steady) throw new Error("Missing steady bot");
  vi.mocked(request).mockImplementation((path, _schema, init) => {
    if (path === "/api/bot-tokens") return Promise.resolve(tokens);
    if (path.endsWith("/bids")) {
      room = {
        ...room,
        status: "closed",
        offer: {
          rank: 1,
          bidder_id: steady.id,
          display_name: steady.display_name,
          is_bot: true,
          amount: 1000,
          status: "open",
          opened_at: new Date(Date.now()).toISOString(),
          deadline: new Date(Date.now() + 180000).toISOString(),
        },
      };
      throw new ApiError(409, {
        error: { code: "AUCTION_CLOSED", message: "AUCTION_CLOSED" },
        request_id: crypto.randomUUID(),
      });
    }
    expect(new Headers(init?.headers).get("authorization")).toBe("Bot token-1");
    room = { ...room, status: "settled" };
    return Promise.resolve({});
  });
  await launch();
  await vi.advanceTimersByTimeAsync(20000);
  expect(
    vi.mocked(request).mock.calls.filter(([path]) => path.endsWith("/pay")),
  ).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
test("TC-224: a closed response prevents further bids while snapshot refresh is offline", async () => {
  vi.mocked(request).mockImplementation((path) => {
    if (path === "/api/bot-tokens") return Promise.resolve(tokens);
    throw new ApiError(409, {
      error: { code: "AUCTION_CLOSED", message: "AUCTION_CLOSED" },
      request_id: crypto.randomUUID(),
    });
  });
  vi.mocked(fetchSnapshot).mockRejectedValue(new Error("Offline"));
  await launch();
  await vi.advanceTimersByTimeAsync(30000);
  const headers = bids().map(([, , init]) =>
    new Headers(init?.headers).get("authorization"),
  );
  expect(headers.length).toBeGreaterThan(0);
  expect(new Set(headers).size).toBe(headers.length);
});
