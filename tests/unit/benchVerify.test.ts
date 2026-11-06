import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Auction,
  Checks,
  Summary,
  Verification,
  VerifyEnv,
  pollAuction,
  verificationExitCode,
} from "../../scripts/bench/verify";

const auction_id = "00000000-0000-4000-8000-000000000001";
const auction = {
  auction_id,
  status: "closed" as const,
  final_price: 10000,
  bid_count: 100,
  extension_count: 2,
};
const checks = [
  { id: "INV-12", check: "bid_count equals accepted bids", violations: 0 },
];
const result = { ...auction, checks };
const env = {
  DATABASE_URL_ADMIN:
    "postgres://postgres:postgres@localhost:54329/bidlock_load",
};
afterEach(() => vi.useRealTimers());

describe("TC-265 FR-94: verifier inputs and documented output", () => {
  test("reads setup auction UUID and permits k6-owned summary fields", () => {
    const summary = {
      setup_data: { auctionId: auction_id, cookies: [], startedAt: 123 },
      metrics: {},
    };
    expect(Summary.parse(summary).setup_data.auctionId).toBe(auction_id);
    for (const value of [
      {},
      { auctionId: auction_id },
      {
        ...summary,
        setup_data: { ...summary.setup_data, auctionId: "invalid" },
      },
      { ...summary, setup_data: { ...summary.setup_data, extra: true } },
    ]) {
      expect(Summary.safeParse(value).success).toBe(false);
    }
  });
  test("emits exactly the documented fields with JSON numeric money", () => {
    expect(JSON.parse(JSON.stringify(Verification.parse(result)))).toEqual(
      result,
    );
    expect(Verification.safeParse({ ...result, extra: true }).success).toBe(
      false,
    );
    expect(
      Auction.safeParse({
        ...auction,
        final_price: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false);
    expect(Checks.safeParse([{ ...checks[0], violations: -1 }]).success).toBe(
      false,
    );
    expect(Checks.safeParse([]).success).toBe(false);
    expect(
      Auction.parse({ ...auction, status: "unsold", final_price: null })
        .final_price,
    ).toBeNull();
  });
  test("requires a PostgreSQL admin URL and defaults to 100 bids", () => {
    expect(VerifyEnv.parse(env).BENCH_MIN_BIDS).toBe(100);
    expect(
      VerifyEnv.parse({ ...env, BENCH_MIN_BIDS: "10" }).BENCH_MIN_BIDS,
    ).toBe(10);
    for (const value of [
      {},
      { DATABASE_URL_ADMIN: "https://example.com" },
      { ...env, BENCH_MIN_BIDS: "abc" },
      { ...env, BENCH_MIN_BIDS: "-1" },
      { ...env, BENCH_MIN_BIDS: "1.5" },
    ]) {
      expect(VerifyEnv.safeParse(value).success).toBe(false);
    }
  });
});

describe("TC-266 FR-94; NFR-12: failure decisions and closing deadline", () => {
  test("fails any violation, live status or insufficient bid count", () => {
    expect(verificationExitCode(result, 100)).toBe(0);
    expect(
      verificationExitCode(
        {
          ...result,
          checks: [
            {
              id: "INV-12",
              check: "bid_count equals accepted bids",
              violations: 1,
            },
          ],
        },
        100,
      ),
    ).toBe(1);
    expect(verificationExitCode({ ...result, status: "live" }, 100)).toBe(1);
    expect(verificationExitCode({ ...result, bid_count: 99 }, 100)).toBe(1);
    expect(verificationExitCode({ ...result, bid_count: 10 }, 10)).toBe(0);
    expect(verificationExitCode({ ...result, bid_count: 9 }, 10)).toBe(1);
  });
  test("polls at two seconds and stops as soon as status leaves live", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] });
    const read = vi
      .fn()
      .mockResolvedValueOnce({ ...auction, status: "live" })
      .mockResolvedValue(auction);
    const pending = pollAuction(read);
    await vi.advanceTimersByTimeAsync(1999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual(auction);
    expect(read).toHaveBeenCalledTimes(2);
  });
  test("retains still-live state at the 120 second deadline for failure output", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "performance"] });
    const live = { ...auction, status: "live" as const };
    const read = vi.fn().mockResolvedValue(live);
    const pending = pollAuction(read);
    await vi.advanceTimersByTimeAsync(120000);
    expect(await pending).toEqual(live);
    expect(read).toHaveBeenCalledTimes(61);
    expect(verificationExitCode({ ...live, checks }, 100)).toBe(1);
  });
});
