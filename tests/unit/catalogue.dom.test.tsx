import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Countdown } from "@/components/room/Countdown";
import { ResultPanel } from "@/components/room/ResultPanel";
import { SandboxCard } from "@/components/lobby/SandboxCard";
import { BenchmarkHeadline } from "@/components/lobby/LobbyContent";
import { PriceBlock } from "@/components/room/PriceBlock";
import { ClockSync } from "@/domain/clock";
import { sandboxCopy } from "@/domain/copy";
import { auction, bid } from "../fixtures/auction";
import type { AuctionState } from "@/domain/schemas";
afterEach(cleanup);
test("TC-244 receipt omits unknown data and lifecycle follows payment state", () => {
  const state: AuctionState = {
    ...auction,
    status: "closed",
    payment_state: "awaiting_payment",
    bid_count: 1,
  };
  const view = render(
    <ResultPanel
      auction={state}
      viewerId={null}
      clock={new ClockSync()}
      bids={[bid(1)]}
    />,
  );
  expect(
    view.container.querySelector('[aria-current="step"]')?.textContent,
  ).toBe("Payment window");
  expect(screen.getByText("Winning bid")).toBeTruthy();
  expect(screen.queryByText("Runner-up")).toBeNull();
  expect(screen.queryByText("Closed by")).toBeNull();
  expect(screen.queryByText("Bids · bidders")).toBeNull();
  for (const [status, payment_state, label] of [
    ["closed", "offered_to_runner_up", "Payment window"],
    ["settled", "paid", "Settled"],
    ["unsold", "expired", "Unsold"],
  ] as const) {
    view.rerender(
      <ResultPanel
        auction={{ ...state, status, payment_state }}
        viewerId={null}
        clock={new ClockSync()}
      />,
    );
    expect(
      view.container.querySelectorAll('[aria-current="step"]'),
    ).toHaveLength(1);
    expect(
      view.container.querySelector('[aria-current="step"]')?.textContent,
    ).toBe(label);
    expect(screen.queryByText("Winning bid")).toBeNull();
  }
});
test("TC-245 fuse uses remaining over total and singular/plural metadata", () => {
  const state = {
    ...auction,
    starts_at: "2026-01-01T00:00:00Z",
    ends_at: "2026-01-01T00:02:00Z",
    server_now: "2026-01-01T00:01:00Z",
  };
  const view = render(<Countdown auction={state} clock={new ClockSync()} />);
  const fuse = view.container.querySelector("progress");
  expect(fuse?.value).toBe(0.5);
  expect(fuse?.getAttribute("aria-hidden")).toBe("true");
  expect(fuse?.classList.contains("fuse-warn")).toBe(true);
  view.unmount();
  const price = render(<PriceBlock auction={{ ...auction, bid_count: 1 }} />);
  expect(
    screen.getByText("1 bid · Next minimum $10.00 · Steps of $1.00"),
  ).toBeTruthy();
  price.rerender(<PriceBlock auction={{ ...auction, bid_count: 2 }} />);
  expect(
    screen.getByText("2 bids · Next minimum $10.00 · Steps of $1.00"),
  ).toBeTruthy();
});
test("TC-247 empty benchmark is absent and all bot personalities are shown", () => {
  const view = render(
    <BenchmarkHeadline result={{ schema: 1, empty: true }} />,
  );
  expect(view.container.childElementCount).toBe(0);
  view.unmount();
  render(<SandboxCard now={0} />);
  for (const text of sandboxCopy.personalities)
    expect(screen.getByText(text)).toBeTruthy();
});

test("TC-253 price flashes only on a price change after mount", () => {
  const view = render(<PriceBlock auction={auction} />);
  expect(view.container.querySelector(".price-flash")).toBeNull();
  view.rerender(<PriceBlock auction={{ ...auction, bid_count: 2 }} />);
  expect(view.container.querySelector(".price-flash")).toBeNull();
  view.rerender(<PriceBlock auction={{ ...auction, current_price: 1200 }} />);
  expect(view.container.querySelector(".price-flash")?.textContent).toBe(
    "$12.00",
  );
});

test("TC-250 rejected rows stay at their arrival anchor below later bids", async () => {
  const { BidHistory } = await import("@/components/room/BidHistory");
  const view = render(
    <BidHistory
      auctionId={auction.id}
      bids={[bid(5), bid(4), bid(3)]}
      viewerId={null}
      extendBySeconds={30}
      onBids={() => {}}
      rejected={[
        {
          key: "rejected-b",
          amount: 1000,
          anchor: 4,
          origin: "Race B",
          sameAs: 4,
          explanation: "Already leading.",
        },
      ]}
    />,
  );
  const rows = screen.getAllByRole("listitem");
  expect(rows[0]?.textContent).toContain("#5");
  expect(rows[1]?.textContent).toContain("Race B · same amount as #4");
  expect(rows[2]?.textContent).toContain("#4");
  view.rerender(
    <BidHistory
      auctionId={auction.id}
      bids={[bid(6), bid(5), bid(4), bid(3)]}
      viewerId={null}
      extendBySeconds={30}
      onBids={() => {}}
      rejected={[
        {
          key: "rejected-b",
          amount: 1000,
          anchor: 4,
          origin: "Race B",
          sameAs: 4,
          explanation: "Already leading.",
        },
      ]}
    />,
  );
  expect(screen.getAllByRole("listitem")[2]?.textContent).toContain(
    "Race B · same amount as #4",
  );
});
