import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { PublicRoomCard } from "@/components/lobby/PublicRoomCard";
import { SandboxCard } from "@/components/lobby/SandboxCard";
import { OfferNotices } from "@/components/lobby/OfferNotices";
import {
  BenchmarkHeadline,
  LobbyIntro,
  LobbyTeaser,
} from "@/components/lobby/LobbyContent";
import { Lobby } from "@/components/lobby/Lobby";
import { BenchResult } from "@/domain/schemas";
import { fillCopy, lobbyCopy as copy, sandboxCopy } from "@/domain/copy";
import { auction } from "../fixtures/auction";
import { request } from "@/client/api";
import type { FeedHandlers } from "@/client/feed/AuctionFeed";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, FeedHandlers>(),
  stops: new Map<string, ReturnType<typeof vi.fn>>(),
  refresh: vi.fn(),
}));
vi.mock("@/client/feed/createFeed", () => ({
  createFeed: () => ({
    subscribe: (id: string, handlers: FeedHandlers) => {
      mocks.handlers.set(id, handlers);
      const stop = vi.fn();
      mocks.stops.set(id, stop);
      return stop;
    },
    refresh: mocks.refresh,
  }),
}));
vi.mock("@/client/hooks/useMe", () => ({ useMe: () => null }));
vi.mock("@/client/api", async (original) => ({
  ...(await original<typeof import("@/client/api")>()),
  request: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.handlers.clear();
  mocks.stops.clear();
});
const now = Date.parse(auction.server_now);
const publicAuction = { ...auction, kind: "public" as const };
test("TC-197: lobby intro, teaser and all public-card copy states", () => {
  const intro = render(
    <>
      <LobbyIntro />
      <LobbyTeaser />
    </>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    copy.headline,
  );
  expect(screen.getByText(copy.intro)).toBeTruthy();
  for (const principle of copy.principles)
    expect(screen.getByText(principle)).toBeTruthy();
  intro.unmount();
  const view = render(
    <PublicRoomCard auction={null} now={now} viewerId={null} />,
  );
  expect(screen.getByRole("status").textContent).toBe(copy.loading);
  expect(screen.getByText(copy.public)).toBeTruthy();
  view.rerender(
    <PublicRoomCard auction={publicAuction} now={now} viewerId={null} />,
  );
  expect(screen.getByText(copy.live)).toBeTruthy();
  expect(screen.getByText(copy.noBids)).toBeTruthy();
  expect(screen.getByText(copy.starting)).toBeTruthy();
  expect(screen.getByText("Closes in 0:30")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: copy.enter }).getAttribute("href"),
  ).toBe(`/a/${auction.id}`);
  const led = {
    ...publicAuction,
    current_price: 1000,
    bid_count: 1,
    leader: { id: auction.id, display_name: "Leader", is_bot: false },
  };
  view.rerender(<PublicRoomCard auction={led} now={now} viewerId={null} />);
  expect(screen.getByText(copy.current)).toBeTruthy();
  expect(screen.getByText("1 bids · Leader: Leader")).toBeTruthy();
  view.rerender(
    <PublicRoomCard auction={led} now={now} viewerId={auction.id} />,
  );
  expect(screen.getByText("1 bids · You are leading")).toBeTruthy();
  view.rerender(
    <PublicRoomCard
      auction={publicAuction}
      now={now + 30000}
      viewerId={null}
    />,
  );
  expect(screen.getByText(copy.closing)).toBeTruthy();
  view.rerender(
    <PublicRoomCard
      auction={{
        ...publicAuction,
        status: "scheduled",
        starts_at: new Date(now + 60000).toISOString(),
      }}
      now={now}
      viewerId={null}
    />,
  );
  expect(screen.getByText(copy.next)).toBeTruthy();
  expect(screen.getByText("Opens in 1:00")).toBeTruthy();
  view.rerender(
    <PublicRoomCard auction={null} now={now} viewerId={null} error />,
  );
  expect(screen.getByRole("status").textContent).toBe(copy.error);
});
test("TC-198: sandbox states have exact copy and presentation without a start action remains disabled", () => {
  const view = render(<SandboxCard now={now} />);
  expect(screen.getByText(sandboxCopy.body)).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: sandboxCopy.start })
      .hasAttribute("disabled"),
  ).toBe(true);
  for (const [state, text] of [
    ["creating", sandboxCopy.starting],
    ["capacity", sandboxCopy.capacity],
    ["rate", fillCopy(sandboxCopy.rate, { n: 2 })],
    ["readonly", sandboxCopy.readonly],
    ["error", sandboxCopy.error],
  ] as const) {
    view.rerender(<SandboxCard now={now} state={state} retryMinutes={2} />);
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  }
  for (const [status, text] of [
    ["live", "Closes in 0:30"],
    ["closed", sandboxCopy.payment],
    ["settled", sandboxCopy.finished],
  ] as const) {
    view.rerender(<SandboxCard now={now} auction={{ ...auction, status }} />);
    expect(
      screen.getByText(
        fillCopy(sandboxCopy.lotStatus, { lot: 1, status: text }),
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: sandboxCopy.return })
        .getAttribute("href"),
    ).toBe(`/a/${auction.id}`);
  }
  view.rerender(<SandboxCard now={now + 30000} auction={auction} />);
  expect(screen.getByText("Lot 1 · Closing…")).toBeTruthy();
});
// Shape-only fixture, never a reported or committed benchmark result.
const result = {
  schema: 1,
  date: "2026-10-18",
  commit: "fixture",
  runner: { os: "Linux", cpus: 4, cpu_model: "Fixture", memory_gb: 16 },
  config: {
    vus: 500,
    duration_s: 60,
    db_pool_max: 20,
    postgres: "17",
    auction: {
      duration_s: 45,
      snipe_window_s: 10,
      extend_by_s: 12,
      max_extensions: 20,
    },
  },
  requests: { bids: 100, replays: 10, rps: 2 },
  outcomes: {
    accepted: 50,
    BID_TOO_LOW: 50,
    ALREADY_LEADING: 0,
    AUCTION_CLOSED: 0,
    RATE_LIMITED: 0,
    OTHER: 0,
  },
  unexpected_error_rate: 0,
  latency_ms: { p50: 10, p90: 20, p95: 25, p99: 50, max: 100 },
  auction: {
    final_price: 1000,
    bid_count: 50,
    extension_count: 0,
    status: "closed",
  },
  invariants: [{ id: "INV-01", check: "fixture", violations: 0 }],
  thresholds: {
    p95_ms: 250,
    p99_ms: 600,
    unexpected_error_rate: 0.01,
    passed: true,
  },
};
test("TC-199: both offer notices and strict benchmark empty/full copy", () => {
  const offer = {
    auction_id: auction.id,
    lot_no: 1,
    title: auction.title,
    amount: 1000,
    deadline: auction.ends_at,
  };
  const view = render(
    <OfferNotices now={now} offers={[{ ...offer, rank: 1 }]} />,
  );
  expect(
    screen.getByText("You won Lot 1 for $10.00. Pay within 0:30."),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: copy.auctionLink }).getAttribute("href"),
  ).toBe(`/a/${auction.id}`);
  view.rerender(<OfferNotices now={now} offers={[{ ...offer, rank: 2 }]} />);
  expect(
    screen.getByText("Second-chance offer on Lot 1: $10.00. Ends in 0:30."),
  ).toBeTruthy();
  view.rerender(
    <BenchmarkHeadline
      result={BenchResult.parse({ schema: 1, empty: true })}
    />,
  );
  expect(screen.getByText(copy.emptyBenchmark)).toBeTruthy();
  view.rerender(<BenchmarkHeadline result={BenchResult.parse(result)} />);
  expect(
    screen.getByText(
      "Last benchmark: 50 accepted bids from 500 concurrent bidders in 60 s. 1 winner. 0 invalid bids. p95 25 ms.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(fillCopy(copy.measured, { date: result.date })),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: copy.results })).toBeTruthy();
  expect(
    BenchResult.safeParse({
      ...result,
      runner: { ...result.runner, extra: true },
    }).success,
  ).toBe(false);
});
test("TC-200: terminal public snapshot refetches list, changes subscription and keeps sandbox feed", async () => {
  const sandbox = {
    ...auction,
    id: "00000000-0000-4000-8000-000000000002",
    kind: "sandbox" as const,
  };
  const next = {
    ...publicAuction,
    id: "00000000-0000-4000-8000-000000000003",
    status: "scheduled" as const,
  };
  vi.mocked(request).mockResolvedValue({ public: next, sandbox });
  render(<Lobby initial={{ public: publicAuction, sandbox }} />);
  expect(mocks.handlers.has(sandbox.id)).toBe(true);
  await act(async () => {
    mocks.handlers.get(publicAuction.id)?.onEvent({
      kind: "snapshot",
      state: {
        ...publicAuction,
        status: "settled",
        next_public_auction_id: next.id,
      },
      receivedAt: performance.timeOrigin + performance.now(),
      rttMs: 10,
    });
    await Promise.resolve();
  });
  expect(request).toHaveBeenCalledWith("/api/auctions", expect.anything());
  expect(mocks.stops.get(publicAuction.id)).toHaveBeenCalledOnce();
  expect(mocks.handlers.has(next.id)).toBe(true);
});
test("TC-197: list failures retry every three seconds", async () => {
  vi.useFakeTimers();
  vi.mocked(request)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ public: publicAuction, sandbox: null });
  render(<Lobby initial={null} />);
  expect(screen.getByText(copy.error)).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2999);
  });
  expect(request).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByText(copy.live)).toBeTruthy();
});
