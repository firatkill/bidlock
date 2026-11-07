import { afterEach, expect, test, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/server/db", () => ({ sql: query }));
afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  query.mockReset();
});
test("TC-274 TC-288 stats share concurrent reads, expire at60s, validate and never serve stale errors", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const { cachedStats } = await import("@/server/repo/stats");
  const value = {
    bids_today: 7,
    active_sandboxes: 2,
    public_lots_today: 3,
    server_now: "2026-11-07T00:00:00.000Z",
  };
  query.mockResolvedValueOnce([{ result: value }]);
  const [first, second] = await Promise.all([cachedStats(), cachedStats()]);
  expect(first).toEqual({ value, fetchedAt: 1000 });
  expect(second).toBe(first);
  vi.setSystemTime(60999);
  expect(await cachedStats()).toBe(first);
  expect(query).toHaveBeenCalledTimes(1);
  vi.setSystemTime(61000);
  query.mockResolvedValueOnce([{ result: { ...value, bids_today: 8 } }]);
  expect((await cachedStats()).value.bids_today).toBe(8);
  expect(query).toHaveBeenCalledTimes(2);
  vi.setSystemTime(121000);
  query.mockResolvedValueOnce([{ result: { ...value, bids_today: -1 } }]);
  await expect(cachedStats()).rejects.toThrow();
  query.mockRejectedValueOnce(new Error("unavailable"));
  await expect(cachedStats()).rejects.toThrow("unavailable");
  query.mockResolvedValueOnce([{ result: value }]);
  expect((await cachedStats()).fetchedAt).toBe(121000);
});
