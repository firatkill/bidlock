import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LotCard } from "@/components/room/LotCard";
import { PriceBlock } from "@/components/room/PriceBlock";
import { Countdown } from "@/components/room/Countdown";
import { ExtensionBanner } from "@/components/room/ExtensionBanner";
import { ConnectionBanner } from "@/components/room/ConnectionBanner";
import {
  AuctionLoadState,
  AuctionNotFound,
} from "@/components/room/AuctionLoadState";
import { ClockSync } from "@/domain/clock";
import { fillCopy, roomCopy as copy } from "@/domain/copy";
import { auction } from "../fixtures/auction";
import { ApiError, fetchSnapshot, localNow } from "@/client/api";
vi.mock("@/client/api", async (original) => {
  const actual = await original<typeof import("@/client/api")>();
  return { ...actual, fetchSnapshot: vi.fn() };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
function timers() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "performance",
    ],
  });
}
function clock() {
  const value = new ClockSync();
  value.addSample(localNow(), localNow(), auction.server_now);
  return value;
}
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

test("TC-184: lot and price copy covers empty, other, bot and viewer leaders", () => {
  const lot = render(<LotCard auction={auction} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    auction.title,
  );
  expect(screen.getByText(copy.noPhoto)).toBeTruthy();
  expect(lot.container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
    "1",
  );
  expect(screen.getByText("Starting price $10.00")).toBeTruthy();
  lot.unmount();
  const price = render(<PriceBlock auction={auction} />);
  expect(screen.getByText(copy.starting)).toBeTruthy();
  expect(screen.getByText("$10.00")).toBeTruthy();
  expect(screen.getByText(copy.firstBid)).toBeTruthy();
  expect(
    screen.getByText(
      fillCopy(copy.meta, { count: 0, minimum: "$10.00", increment: "$1.00" }),
    ),
  ).toBeTruthy();
  const led = {
    ...auction,
    current_price: 1200,
    bid_count: 2,
    leader: { id: auction.id, display_name: "Steady bot", is_bot: true },
  };
  price.rerender(<PriceBlock auction={led} />);
  expect(screen.getByText(copy.current)).toBeTruthy();
  expect(screen.getByText("$12.00")).toBeTruthy();
  expect(
    screen.getByText(fillCopy(copy.leader, { name: "Steady bot" })),
  ).toBeTruthy();
  expect(screen.getByText(copy.bot)).toBeTruthy();
  price.rerender(
    <PriceBlock
      auction={{ ...led, leader: { ...led.leader, is_bot: false } }}
      isLeader
    />,
  );
  expect(screen.getByText(copy.leading).className).toContain("text-accent");
  expect(screen.queryByText(copy.bot)).toBeNull();
});
test("TC-185: countdown uses server time, warning, soft-close, cap and Closing states", async () => {
  timers();
  const sync = clock();
  const end = (seconds: number) =>
    new Date(Date.parse(auction.server_now) + seconds * 1000).toISOString();
  const view = render(
    <Countdown auction={{ ...auction, ends_at: end(61) }} clock={sync} />,
  );
  expect(screen.getByText("Closes in 1:01").className).not.toContain(
    "text-warn",
  );
  await advance(1000);
  expect(screen.getByText("Closes in 1:00").className).toContain("text-warn");
  view.rerender(
    <Countdown auction={{ ...auction, ends_at: end(11) }} clock={sync} />,
  );
  expect(screen.getByText(copy.softClose)).toBeTruthy();
  view.rerender(
    <Countdown
      auction={{ ...auction, ends_at: end(11), extension_count: 20 }}
      clock={sync}
    />,
  );
  expect(screen.getByText(copy.cap)).toBeTruthy();
  expect(screen.queryByText(copy.softClose)).toBeNull();
  await advance(10000);
  expect(screen.getByText(copy.closing)).toBeTruthy();
  expect(screen.getByText(copy.waiting)).toBeTruthy();
  view.rerender(
    <Countdown
      auction={{ ...auction, status: "scheduled", starts_at: end(71) }}
      clock={sync}
    />,
  );
  expect(screen.getByText("Opens in 1:00")).toBeTruthy();
  view.rerender(
    <Countdown auction={{ ...auction, status: "settled" }} clock={sync} />,
  );
  expect(view.container.textContent).toBe("");
});
test("TC-186: newest extension replaces the banner and lasts five seconds", async () => {
  timers();
  const view = render(<ExtensionBanner extension={null} max={20} />);
  expect(view.container.textContent).toBe("");
  view.rerender(
    <ExtensionBanner
      extension={{ n: 1, durationMs: 30000, at: localNow() }}
      max={20}
    />,
  );
  expect(
    screen.getByText(fillCopy(copy.extension, { time: "0:30" })),
  ).toBeTruthy();
  expect(screen.getByText("Extension 1 of 20")).toBeTruthy();
  expect(view.container.querySelector('[aria-live="polite"]')).toBeTruthy();
  await advance(4000);
  view.rerender(
    <ExtensionBanner
      extension={{ n: 2, durationMs: 30000, at: localNow() }}
      max={20}
    />,
  );
  expect(screen.queryByText("Extension 1 of 20")).toBeNull();
  await advance(4999);
  expect(screen.getByText("Extension 2 of 20")).toBeTruthy();
  await advance(1);
  expect(view.container.textContent).toBe("");
});
test("TC-187: reconnect copy and two-second recovery notification", async () => {
  timers();
  const view = render(<ConnectionBanner status="connecting" />);
  view.rerender(<ConnectionBanner status="live" />);
  expect(screen.queryByText(copy.recovered)).toBeNull();
  view.rerender(<ConnectionBanner status="reconnecting" />);
  expect(screen.getByText(copy.reconnecting)).toBeTruthy();
  view.rerender(<ConnectionBanner status="live" />);
  expect(screen.getByText(copy.recovered)).toBeTruthy();
  await advance(1999);
  expect(screen.getByText(copy.recovered)).toBeTruthy();
  await advance(1);
  expect(screen.queryByText(copy.recovered)).toBeNull();
});
test("TC-187: not-found and initial loading have exact accessible copy", () => {
  const view = render(<AuctionNotFound />);
  expect(screen.getByRole("heading").textContent).toBe(copy.notFound);
  expect(screen.getByText(copy.deleted)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: copy.lobby }).getAttribute("href"),
  ).toBe("/");
  view.unmount();
  vi.mocked(fetchSnapshot).mockReturnValue(new Promise(() => {}));
  render(<AuctionLoadState auctionId={auction.id} />);
  expect(screen.getByRole("status").textContent).toBe(copy.loadingAuction);
});
test("TC-187: failed initial load retries every three seconds and a 404 stops retries", async () => {
  timers();
  vi.mocked(fetchSnapshot)
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockRejectedValueOnce(
      new ApiError(404, {
        error: { code: "NOT_FOUND", message: "missing" },
        request_id: auction.id,
      }),
    );
  render(<AuctionLoadState auctionId={auction.id} initialError />);
  expect(screen.getByText(copy.loadError)).toBeTruthy();
  await advance(2999);
  expect(fetchSnapshot).not.toHaveBeenCalled();
  await advance(1);
  expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  await advance(3000);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("heading").textContent).toBe(copy.notFound);
  await advance(3000);
  expect(fetchSnapshot).toHaveBeenCalledTimes(2);
});
