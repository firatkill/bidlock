import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { PayButton } from "@/components/room/PayButton";
import { ApiError, request } from "@/client/api";
import { refreshMe } from "@/client/hooks/useMe";
import { auction } from "../fixtures/auction";
vi.mock("@/client/api", async (original) => ({
  ...(await original<typeof import("@/client/api")>()),
  request: vi.fn(),
}));
vi.mock("@/client/hooks/useMe", () => ({
  refreshMe: vi.fn().mockResolvedValue(null),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});
const click = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
  });
};
test("TC-231: payment awaits identity, sends strict empty body once and refreshes on success", async () => {
  let complete: (() => void) | undefined;
  vi.mocked(request).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const refreshed = vi.fn();
  render(<PayButton auctionId={auction.id} onRefresh={refreshed} />);
  await click();
  await click();
  expect(refreshMe).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    `/api/auctions/${auction.id}/pay`,
    expect.anything(),
    { method: "POST", body: "{}" },
  );
  expect(screen.getByRole("button").textContent).toBe("Paying…");
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  await act(async () => {
    complete?.();
    await Promise.resolve();
  });
  expect(refreshed).toHaveBeenCalledTimes(1);
  expect(refreshMe).toHaveBeenCalledTimes(2);
});
test("TC-231: payment rejections, transport retry and read-only controls", async () => {
  const refreshed = vi.fn();
  const view = render(
    <PayButton auctionId={auction.id} onRefresh={refreshed} />,
  );
  for (const [code, text] of [
    ["OFFER_EXPIRED", "Your payment window has closed."],
    ["NOT_PAYABLE", "There is nothing for you to pay on this lot."],
  ] as const) {
    vi.mocked(request).mockRejectedValueOnce(
      new ApiError(409, {
        error: { code, message: code },
        request_id: auction.id,
      }),
    );
    await click();
    expect(screen.getByRole("alert").textContent).toBe(text);
  }
  expect(refreshed).toHaveBeenCalledTimes(2);
  vi.mocked(request).mockRejectedValueOnce(new TypeError("offline"));
  await click();
  expect(screen.getByRole("alert").textContent).toBe(
    "Couldn't confirm your payment. Please try again.",
  );
  expect(screen.getByRole("button").textContent).toBe("Retry");
  vi.mocked(request).mockResolvedValueOnce({});
  await click();
  expect(refreshed).toHaveBeenCalledTimes(3);
  view.rerender(
    <PayButton auctionId={auction.id} onRefresh={refreshed} readonly />,
  );
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
});
test("TC-231: payment rate limit counts down and prevents early retries", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  vi.mocked(request).mockRejectedValueOnce(
    new ApiError(429, {
      error: {
        code: "RATE_LIMITED",
        message: "rate",
        details: { retry_after_ms: 2000 },
      },
      request_id: auction.id,
    }),
  );
  render(<PayButton auctionId={auction.id} onRefresh={vi.fn()} />);
  await click();
  expect(screen.getByRole("alert").textContent).toBe(
    "Slow down. You can pay again in 2 s.",
  );
  await click();
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole("alert").textContent).toBe(
    "Slow down. You can pay again in 1 s.",
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
});
