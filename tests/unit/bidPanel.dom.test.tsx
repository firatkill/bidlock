import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BidPanel } from "@/components/room/BidPanel";
import { ApiError, localNow, placeBid } from "@/client/api";
import { ClockSync } from "@/domain/clock";
import { fillCopy, roomCopy as copy } from "@/domain/copy";
import { ERROR_STATUS, type ErrorCode } from "@/domain/errors";
import { auction } from "../fixtures/auction";
vi.mock("@/client/api", async (original) => {
  const actual = await original<typeof import("@/client/api")>();
  return { ...actual, placeBid: vi.fn() };
});
const accepted: Awaited<ReturnType<typeof placeBid>> = {
  bid: {
    id: auction.id,
    bid_no: 1,
    amount: 1000,
    placed_at: auction.server_now,
  },
  auction: {
    id: auction.id,
    status: "live",
    current_price: 1000,
    leader_bidder_id: auction.id,
    min_next_bid: 1100,
    max_bid: 11100,
    ends_at: auction.ends_at,
    extended: false,
    extension_count: 0,
    version: 2,
  },
  replayed: false,
  server_now: auction.server_now,
};
const details = {
  min_next_bid: 1500,
  max_bid: 11500,
  current_price: 1400,
  leader_bidder_id: auction.id,
  status: "live",
  ends_at: auction.ends_at,
  version: 3,
  replayed: false,
  server_now: auction.server_now,
};
function failure(code: ErrorCode, extra: Record<string, unknown> = details) {
  return new ApiError(ERROR_STATUS[code], {
    error: { code, message: code, details: extra },
    request_id: auction.id,
  });
}
function props() {
  const clock = new ClockSync();
  clock.addSample(localNow(), localNow(), auction.server_now);
  return { auction, clock, isLeader: false, onAccepted: vi.fn() };
}
const quick = () => screen.getByRole("button", { name: "Bid $10.00 +1 step" });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
test("TC-188: quick bids use integer amounts, disable controls while pending and announce acceptance", async () => {
  let resolve: ((value: typeof accepted) => void) | undefined;
  vi.mocked(placeBid).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const input = props();
  render(<BidPanel {...input} />);
  expect(
    screen.getByRole("button", { name: "Bid $11.00 +2 steps" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Bid $14.00 +5 steps" }),
  ).toBeTruthy();
  fireEvent.click(quick());
  expect(typeof vi.mocked(placeBid).mock.calls[0]?.[0].key).toBe("string");
  expect(placeBid).toHaveBeenCalledWith({
    auctionId: auction.id,
    amount: 1000,
    key: vi.mocked(placeBid).mock.calls[0]?.[0].key,
  });
  expect(screen.getByRole("button", { name: /Placing bid/ })).toBeTruthy();
  for (const control of screen.getAllByRole("button"))
    expect(control.hasAttribute("disabled")).toBe(true);
  await act(async () => {
    resolve?.(accepted);
    await Promise.resolve();
  });
  expect(screen.getByRole("status").textContent).toBe(
    fillCopy(copy.accepted, { amount: "$10.00" }),
  );
  expect(input.onAccepted).toHaveBeenCalledOnce();
});
test("TC-188 TC-189: custom input validates decimals and Enter submits integer cents", async () => {
  vi.mocked(placeBid).mockResolvedValue(accepted);
  render(<BidPanel {...props()} />);
  const input = screen.getByLabelText(copy.custom);
  const user = userEvent.setup();
  await user.type(input, "35.555{Enter}");
  expect(screen.getByRole("alert").textContent).toBe(copy.errors.decimals);
  expect(placeBid).not.toHaveBeenCalled();
  await user.clear(input);
  await user.type(input, "-1{Enter}");
  expect(screen.getByRole("alert").textContent).toBe(copy.errors.VALIDATION);
  await user.clear(input);
  await user.type(input, "$35.50{Enter}");
  expect(vi.mocked(placeBid).mock.calls[0]?.[0].amount).toBe(3550);
});
test("TC-189: shortcuts work only without modifiers, editable focus or an open dialog", async () => {
  vi.mocked(placeBid).mockResolvedValue(accepted);
  const view = render(
    <>
      <BidPanel {...props()} />
      <textarea aria-label="notes" />
      <select aria-label="choice">
        <option>One</option>
      </select>
      <div
        contentEditable
        suppressContentEditableWarning
        data-testid="editable"
      />
    </>,
  );
  for (const [key, amount] of [
    ["1", 1000],
    ["2", 1100],
    ["3", 1400],
  ] as const) {
    await act(async () => {
      fireEvent.keyDown(document, { key });
      await Promise.resolve();
    });
    expect(vi.mocked(placeBid).mock.lastCall?.[0].amount).toBe(amount);
  }
  const count = vi.mocked(placeBid).mock.calls.length;
  for (const modifier of ["ctrlKey", "altKey", "metaKey", "shiftKey"])
    fireEvent.keyDown(document, { key: "1", [modifier]: true });
  for (const target of [
    screen.getByLabelText(copy.custom),
    screen.getByLabelText("notes"),
    screen.getByLabelText("choice"),
    screen.getByTestId("editable"),
  ])
    fireEvent.keyDown(target, { key: "1" });
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  view.container.append(dialog);
  fireEvent.keyDown(document, { key: "1" });
  expect(placeBid).toHaveBeenCalledTimes(count);
});
test.each([
  ["BID_TOO_LOW", "Someone bid first. The minimum is now $15.00."],
  [
    "BID_TOO_HIGH",
    "That's more than 100 steps above the current price. Enter $115.00 or less.",
  ],
  ["ALREADY_LEADING", copy.errors.ALREADY_LEADING],
  ["AUCTION_NOT_LIVE", "Bidding opens in 0:00."],
  ["AUCTION_CLOSED", copy.errors.AUCTION_CLOSED],
  ["DEMO_READONLY", copy.errors.DEMO_READONLY],
  ["BIDDING_PAUSED", copy.errors.BIDDING_PAUSED],
  ["IDEMPOTENCY_MISMATCH", copy.errors.IDEMPOTENCY_MISMATCH],
  ["VALIDATION", copy.errors.VALIDATION],
  ["NOT_FOUND", copy.errors.NOT_FOUND],
] as const)("TC-190: %s renders its exact PRD copy", async (code, text) => {
  vi.mocked(placeBid).mockRejectedValue(failure(code));
  render(<BidPanel {...props()} />);
  fireEvent.click(quick());
  await waitFor(() => {
    expect(screen.getByRole("alert").textContent).toBe(text);
  });
});
test.each([new TypeError("offline"), failure("INTERNAL")])(
  "TC-190: network/5xx Retry retains the original key and amount",
  async (reason) => {
    vi.mocked(placeBid)
      .mockRejectedValueOnce(reason)
      .mockResolvedValueOnce(accepted);
    render(<BidPanel {...props()} />);
    fireEvent.click(quick());
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(copy.errors.network);
    });
    const attempt = vi.mocked(placeBid).mock.calls[0]?.[0];
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.errors.retry }));
      await Promise.resolve();
    });
    expect(vi.mocked(placeBid).mock.calls[1]?.[0]).toEqual(attempt);
    expect(
      screen.queryByRole("button", { name: copy.errors.retry }),
    ).toBeNull();
  },
);
test("TC-190: definitive mismatch clears retry and the next action creates a new key", async () => {
  vi.mocked(placeBid)
    .mockRejectedValueOnce(failure("IDEMPOTENCY_MISMATCH"))
    .mockResolvedValueOnce(accepted);
  render(<BidPanel {...props()} />);
  await act(async () => {
    fireEvent.click(quick());
    await Promise.resolve();
  });
  expect(screen.queryByRole("button", { name: copy.errors.retry })).toBeNull();
  await act(async () => {
    fireEvent.click(quick());
    await Promise.resolve();
  });
  expect(vi.mocked(placeBid).mock.calls[1]?.[0].key).not.toBe(
    vi.mocked(placeBid).mock.calls[0]?.[0].key,
  );
});
test("TC-191: stale minimum updates quick buttons and server state supersedes it", async () => {
  vi.mocked(placeBid).mockRejectedValue(failure("BID_TOO_LOW"));
  const input = props();
  const view = render(<BidPanel {...input} />);
  await act(async () => {
    fireEvent.click(quick());
    await Promise.resolve();
  });
  expect(
    screen.getByRole("button", { name: "Bid $15.00 +1 step" }),
  ).toBeTruthy();
  view.rerender(
    <BidPanel
      {...input}
      auction={{ ...auction, version: 4, min_next_bid: 2000 }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Bid $20.00 +1 step" }),
  ).toBeTruthy();
});
test("TC-191: rate limit countdown disables controls until retry time passes", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  vi.mocked(placeBid).mockRejectedValue(
    failure("RATE_LIMITED", { retry_after_ms: 2000 }),
  );
  render(<BidPanel {...props()} />);
  await act(async () => {
    fireEvent.click(quick());
    await Promise.resolve();
  });
  expect(screen.getByRole("alert").textContent).toBe(
    fillCopy(copy.errors.RATE_LIMITED, { n: 2 }),
  );
  expect(quick().hasAttribute("disabled")).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole("alert").textContent).toBe(
    fillCopy(copy.errors.RATE_LIMITED, { n: 1 }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(quick().hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("alert").textContent).toBe("");
});
test("TC-192: leading, scheduled, readonly and terminal gates; outbid is assertive", () => {
  const input = props();
  const view = render(<BidPanel {...input} isLeader />);
  expect(quick().hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(copy.leadingNote)).toBeTruthy();
  view.rerender(
    <BidPanel
      {...input}
      auction={{
        ...auction,
        current_price: 1200,
        leader: { id: auction.id, display_name: "Other", is_bot: false },
      }}
    />,
  );
  expect(screen.getByRole("alert").textContent).toBe(
    fillCopy(copy.outbid, { name: "Other", amount: "$12.00" }),
  );
  view.rerender(<BidPanel {...input} readonly />);
  expect(screen.getByText(copy.readonly)).toBeTruthy();
  expect(quick().hasAttribute("disabled")).toBe(true);
  view.rerender(
    <BidPanel {...input} auction={{ ...auction, status: "scheduled" }} />,
  );
  expect(screen.getByText("Bidding opens in 0:00.")).toBeTruthy();
  expect(quick().hasAttribute("disabled")).toBe(true);
  for (const status of ["closed", "settled", "unsold"] as const) {
    view.rerender(<BidPanel {...input} auction={{ ...auction, status }} />);
    expect(screen.queryByRole("button")).toBeNull();
  }
});
