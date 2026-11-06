import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Experiments } from "@/components/sandbox/Experiments";
import { ApiError, localNow, placeBid } from "@/client/api";
import { ClockSync } from "@/domain/clock";
import { auction } from "../fixtures/auction";
vi.mock("@/client/api", async (original) => ({
  ...(await original<typeof import("@/client/api")>()),
  placeBid: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function panel(readonly = false) {
  const clock = new ClockSync();
  clock.addSample(localNow(), localNow(), auction.server_now);
  return (
    <Experiments
      auction={auction}
      clock={clock}
      isLeader={false}
      readonly={readonly}
      onAccepted={vi.fn()}
      onRejected={vi.fn()}
      onRefresh={vi.fn()}
    />
  );
}
test("TC-239 experiment rate limit uses normal copy and disables controls", async () => {
  vi.mocked(placeBid).mockRejectedValue(
    new ApiError(429, {
      error: {
        code: "RATE_LIMITED",
        message: "rate",
        details: { retry_after_ms: 20000 },
      },
      request_id: auction.id,
    }),
  );
  render(panel());
  fireEvent.click(screen.getByRole("button", { name: "Race" }));
  await waitFor(() => {
    expect(screen.getByRole("alert").textContent).toMatch(
      /^Slow down\. You can bid again in \d+ s\.$/,
    );
  });
  for (const button of screen.getAllByRole("button"))
    expect(button.hasAttribute("disabled")).toBe(true);
  expect(placeBid).toHaveBeenCalledTimes(2);
});
test("TC-240 experiment transport failure is reported without invented acceptance", async () => {
  vi.mocked(placeBid).mockRejectedValue(new TypeError("network"));
  const view = render(panel());
  fireEvent.click(screen.getByRole("button", { name: "Replay" }));
  await waitFor(() => {
    expect(view.container.querySelectorAll("output")[1]?.textContent).toContain(
      "Couldn't reach the server. Your bid was not confirmed.",
    );
  });
  expect(screen.queryByText("Same bid id. No second row.")).toBeNull();
});
test("TC-241 experiments respect readonly and cannot send before deadline", () => {
  render(panel(true));
  for (const button of screen.getAllByRole("button"))
    expect(button.hasAttribute("disabled")).toBe(true);
  expect(placeBid).not.toHaveBeenCalled();
});

test("TC-252 closed, settled and unsold disable experiments and explain why", () => {
  const clock = new ClockSync();
  const props = {
    clock,
    isLeader: false,
    readonly: false,
    onAccepted: vi.fn(),
    onRejected: vi.fn(),
    onRefresh: vi.fn(),
  };
  const view = render(
    <Experiments {...props} auction={{ ...auction, status: "closed" }} />,
  );
  for (const status of ["closed", "settled", "unsold"] as const) {
    view.rerender(<Experiments {...props} auction={{ ...auction, status }} />);
    expect(screen.getByText("The auction has closed.")).toBeTruthy();
    for (const button of screen.getAllByRole("button"))
      expect(button.hasAttribute("disabled")).toBe(true);
  }
  expect(placeBid).not.toHaveBeenCalled();
});

test("TC-251 accepted A and rejected B retain code and factual race explanation", async () => {
  vi.mocked(placeBid)
    .mockResolvedValueOnce({
      bid: {
        id: auction.id,
        bid_no: 4,
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
    })
    .mockRejectedValueOnce(
      new ApiError(409, {
        error: { code: "ALREADY_LEADING", message: "leading" },
        request_id: auction.id,
      }),
    );
  const view = render(panel());
  fireEvent.click(screen.getByRole("button", { name: "Race" }));
  await waitFor(() => {
    expect(
      screen.getByText(
        "B was checked after A committed, so it saw the new state. Two requests, one bid.",
      ),
    ).toBeTruthy();
  });
  const output = view.container.querySelector("output");
  expect(output?.textContent).toContain("ALREADY_LEADING");
  expect(output?.textContent).toContain(auction.id.slice(0, 8));
  expect(output?.textContent).not.toContain(auction.id);
  expect(output?.querySelector("[title]")?.getAttribute("title")).toBe(
    auction.id,
  );
});
