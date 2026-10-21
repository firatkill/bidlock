import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { request, ApiError } from "@/client/api";
const me = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Bidder 1234",
  payment_strikes: 0,
  active_sandbox: null,
  open_offers: [],
  server_now: "2026-01-01T00:00:00Z",
};
const denied = () =>
  Response.json(
    {
      error: { code: "NO_SESSION", message: "NO_SESSION" },
      request_id: crypto.randomUUID(),
    },
    { status: 401 },
  );
afterEach(() => {
  vi.unstubAllGlobals();
});
test("TC-210: client preserves Headers and strictly validates responses", async () => {
  const fetcher = vi.fn((_path: unknown, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    expect(headers.get("x-example")).toBe("kept");
    expect(headers.get("content-type")).toBe("application/json");
    return Promise.resolve(Response.json({ ok: true, extra: true }));
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(
    request("/api/example", z.object({ ok: z.boolean() }).strict(), {
      method: "POST",
      body: "{}",
      headers: new Headers({ "x-example": "kept" }),
    }),
  ).rejects.toBeInstanceOf(z.ZodError);
});
test("TC-210: PATCH me renews identity once, then retries the original request", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(denied())
    .mockResolvedValueOnce(Response.json(me))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  expect(
    await request("/api/me", z.object({ ok: z.boolean() }).strict(), {
      method: "PATCH",
      body: "{}",
    }),
  ).toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(
    fetcher.mock.calls.map((call) => [
      call[0],
      (call[1] as RequestInit).method ?? "GET",
    ]),
  ).toEqual([
    ["/api/me", "PATCH"],
    ["/api/me", "GET"],
    ["/api/me", "PATCH"],
  ]);
});
test("TC-210: renewal never loops on repeated session failure", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(denied())
    .mockResolvedValueOnce(Response.json(me))
    .mockResolvedValueOnce(denied());
  vi.stubGlobal("fetch", fetcher);
  await expect(
    request("/api/example", z.object({ ok: z.boolean() }).strict()),
  ).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
