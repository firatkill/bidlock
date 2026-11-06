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
