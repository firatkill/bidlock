import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResultPanel } from "@/components/room/ResultPanel";
import { ClockSync } from "@/domain/clock";
import { resultCopy as copy } from "@/domain/copy";
import type { AuctionState } from "@/domain/schemas";
import { auction } from "../fixtures/auction";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const winner = "00000000-0000-4000-8000-000000000002";
const runner = "00000000-0000-4000-8000-000000000003";
const closed = {
  ...auction,
  status: "closed",
  payment_state: "awaiting_payment",
  closed_at: auction.ends_at,
  offer: {
    rank: 1,
    bidder_id: winner,
    display_name: "Winner",
    is_bot: false,
    amount: 1200,
    status: "open",
    opened_at: auction.server_now,
    deadline: "2026-01-01T00:03:00Z",
  },
} satisfies AuctionState;
const second = {
  ...closed,
  payment_state: "offered_to_runner_up",
  expired_offers: [{ rank: 1, bidder_id: winner }],
  offer: {
    ...closed.offer,
    rank: 2,
    bidder_id: runner,
    display_name: "Runner",
    amount: 1100,
  },
} satisfies AuctionState;
function panel(state: AuctionState, viewerId: string | null) {
  return (
    <ResultPanel
      auction={state}
      viewerId={viewerId}
      clock={new ClockSync()}
      payment={<button>Pay now (simulated)</button>}
    />
  );
}
test("TC-230: all closed-state viewer copy and payment eligibility", () => {
  const view = render(panel(closed, winner));
  expect(screen.getByRole("heading").textContent).toBe(
    "You won Lot 1 for $12.00.",
  );
  expect(
    screen.getByText(
      "Pay within 3:00 to complete the purchase. No real money is involved.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button")).toBeTruthy();
  view.rerender(panel(closed, null));
  expect(
    screen.getByText(
      "Sold to Winner for $12.00, pending payment. Payment window ends in 3:00.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(panel(second, runner));
  expect(screen.getByRole("heading").textContent).toBe(copy.secondChance);
  expect(
    screen.getByText(
      "The winner didn't pay in time. You can buy Lot 1 for your last bid, $11.00. Offer ends in 3:00.",
    ),
  ).toBeTruthy();
  view.rerender(panel(second, winner));
  expect(screen.getByText(copy.expiredWinner)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(panel(second, null));
  expect(
    screen.getByText(
      "The winner didn't pay. Offered to Runner for $11.00. Offer ends in 3:00.",
    ),
  ).toBeTruthy();
  for (const [state, viewer, expected] of [
    [
      {
        ...closed,
        status: "settled",
        payment_state: "paid",
        offer: { ...closed.offer, status: "paid" },
      },
      winner,
      "Paid. Lot 1 is yours for $12.00. Thanks for testing Bidlock.",
    ],
    [
      {
        ...closed,
        status: "settled",
        payment_state: "paid",
        offer: { ...closed.offer, status: "paid" },
      },
      null,
      "Sold to Winner for $12.00. Paid.",
    ],
    [
      {
        ...second,
        status: "settled",
        payment_state: "paid",
        offer: { ...second.offer, status: "paid" },
      },
      runner,
      "Paid. Lot 1 is yours for $11.00 through a second-chance offer.",
    ],
    [
      {
        ...second,
        status: "settled",
        payment_state: "paid",
        offer: { ...second.offer, status: "paid" },
      },
      null,
      "Sold to Runner for $11.00. Paid. after a second-chance offer",
    ],
    [{ ...auction, status: "unsold" }, null, copy.noBids],
    [
      { ...second, status: "unsold", payment_state: "expired", offer: null },
      null,
      copy.expiredOnly,
    ],
    [
      {
        ...second,
        status: "unsold",
        payment_state: "expired",
        offer: null,
        expired_offers: [
          ...second.expired_offers,
          { rank: 2, bidder_id: runner },
        ],
      },
      null,
      copy.expiredBoth,
    ],
  ] satisfies [AuctionState, string | null, string][]) {
    view.rerender(panel(state, viewer));
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  }
});
test("TC-233: owned offers announce once and finished public lot links to successor", () => {
  const view = render(
    panel(
      { ...closed, kind: "public", next_public_auction_id: runner },
      winner,
    ),
  );
  const live = view.container.querySelector('[aria-live="assertive"]');
  expect(live?.textContent).toBe("You won Lot 1 for $12.00.");
  view.rerender(
    panel(
      { ...closed, kind: "public", version: 2, next_public_auction_id: runner },
      winner,
    ),
  );
  expect(live?.textContent).toBe("You won Lot 1 for $12.00.");
  expect(screen.getByText("Next lot starts in 0:45.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: copy.nextLink }).getAttribute("href"),
  ).toBe(`/a/${runner}`);
  view.rerender(panel(second, runner));
  expect(live?.textContent).toBe(copy.secondChance);
});
