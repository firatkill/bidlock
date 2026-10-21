import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { SandboxStart } from "@/components/lobby/SandboxCard";
import { BotStrip, SandboxHeader } from "@/components/room/BotStrip";
import { ApiError, request } from "@/client/api";
import { ClockSync } from "@/domain/clock";
import { fillCopy, sandboxCopy as copy } from "@/domain/copy";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/client/api", async (original) => ({
  ...(await original<typeof import("@/client/api")>()),
  request: vi.fn(),
  localNow: () => Date.now(),
}));
const now = Date.parse("2026-01-01T00:00:00Z");
const created = {
  auction_id: crypto.randomUUID(),
  sandbox_id: crypto.randomUUID(),
  expires_at: new Date(now + 900000).toISOString(),
  bot_seed: 42,
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
const failure = (
  code: "SANDBOX_EXISTS" | "SANDBOX_CAPACITY" | "RATE_LIMITED",
  details?: Record<string, unknown>,
) =>
  new ApiError(
    code === "SANDBOX_CAPACITY" ? 503 : code === "RATE_LIMITED" ? 429 : 409,
    {
      error: { code, message: code, ...(details ? { details } : {}) },
      request_id: crypto.randomUUID(),
    },
  );
test("TC-225: sandbox starts once, shows pending copy and navigates to created room", async () => {
  let finish: (value: typeof created) => void = () => {
    throw new Error("Missing request");
  };
  vi.mocked(request).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<SandboxStart now={now} />);
  fireEvent.click(screen.getByRole("button", { name: copy.start }));
  expect(
    screen
      .getByRole("button", { name: copy.starting })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(request).toHaveBeenCalledWith("/api/sandboxes", expect.anything(), {
    method: "POST",
    body: "{}",
  });
  await act(async () => {
    finish(created);
    await Promise.resolve();
  });
  expect(push).toHaveBeenCalledWith(`/a/${created.auction_id}`);
  expect(request).toHaveBeenCalledTimes(1);
});
test("TC-225: existing sandbox redirects and error copy matches PRD", async () => {
  vi.mocked(request).mockRejectedValue(failure("SANDBOX_EXISTS", created));
  const view = render(<SandboxStart now={now} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: copy.start }));
    await Promise.resolve();
  });
  expect(push).toHaveBeenCalledWith(`/a/${created.auction_id}`);
  view.unmount();
  vi.mocked(request).mockRejectedValue(
    failure("RATE_LIMITED", { retry_after_ms: 61000 }),
  );
  const limited = render(<SandboxStart now={now} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: copy.start }));
    await Promise.resolve();
  });
  expect(screen.getByRole("status").textContent).toBe(
    fillCopy(copy.rate, { n: 2 }),
  );
  limited.unmount();
  vi.mocked(request).mockRejectedValue(new Error("Offline"));
  render(<SandboxStart now={now} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: copy.start }));
    await Promise.resolve();
  });
  expect(screen.getByRole("alert").textContent).toBe(copy.error);
});
test("TC-225: capacity disables creation for exactly 30 seconds; readonly stays disabled", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.mocked(request).mockRejectedValue(failure("SANDBOX_CAPACITY"));
  const view = render(<SandboxStart now={now} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: copy.start }));
    await Promise.resolve();
  });
  expect(screen.getByText(copy.capacity)).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(29999));
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
  view.rerender(<SandboxStart now={now} readonly />);
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  expect(screen.getByText(copy.readonly)).toBeTruthy();
});
test("TC-225: sandbox TTL header and bot statuses use exact copy", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  render(
    <SandboxHeader
      expiresAt={created.expires_at}
      serverNow={new Date(now).toISOString()}
      clock={new ClockSync()}
    />,
  );
  expect(screen.getByText("Your sandbox · expires in 15:00")).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText("Your sandbox · expires in 14:59")).toBeTruthy();
  const bots = render(
    <BotStrip
      view={{
        hidden: false,
        error: false,
        bots: [
          {
            id: "cautious",
            persona: "cautious",
            status: "watching",
            outAt: null,
          },
          { id: "steady", persona: "steady", status: "bidding", outAt: null },
          { id: "sniper", persona: "sniper", status: "out", outAt: 12300 },
        ],
      }}
    />,
  );
  for (const label of copy.bots) expect(screen.getByText(label)).toBeTruthy();
  for (const label of [
    copy.watching,
    copy.bidding,
    "out at $123.00",
    copy.note,
  ])
    expect(screen.getByText(label)).toBeTruthy();
  bots.rerender(<BotStrip view={{ bots: [], hidden: true, error: false }} />);
  expect(screen.getAllByText(copy.paused)).toHaveLength(3);
  expect(screen.getByRole("status").textContent).toBe(copy.hidden);
});
