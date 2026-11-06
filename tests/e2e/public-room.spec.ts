import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test, expect, newBidder, headers } from "./fixtures";
import {
  AuctionState,
  BenchResult,
  BidAccepted,
  ErrorBody,
} from "../../src/domain/schemas";
const benchmarkPath = new URL(
  "../../bench/results/latest.json",
  import.meta.url,
);
const latest: unknown = existsSync(benchmarkPath)
  ? JSON.parse(readFileSync(benchmarkPath, "utf8"))
  : { schema: 1, empty: true };
test("TC-235 E2E-06 public entry, benchmark and successor @isolated", async ({
  browser,
  setClock,
  resetClock,
}) => {
  const a = await newBidder(browser);
  try {
    await expect(
      a.page.getByText(/^PUBLIC ROOM · (LIVE|NEXT LOT)$/),
    ).toBeVisible();
    await expect(
      a.page.getByText(/^(Closes|Opens) in \d+:\d{2}$/),
    ).toBeVisible();
    const bench = BenchResult.parse(latest);
    if ("empty" in bench)
      await expect(
        a.page.getByText(
          "Benchmark results will appear here after the first load-test run.",
          { exact: true },
        ),
      ).toHaveCount(0);
    else
      await expect(
        a.page.getByText(
          `Last benchmark: ${String(bench.outcomes.accepted)} accepted bids from ${String(bench.config.vus)} concurrent bidders in ${String(bench.config.duration_s)} s. 1 winner. ${String(bench.invariants.reduce((sum, row) => sum + row.violations, 0))} invalid bids. p95 ${String(bench.latency_ms.p95)} ms.`,
          { exact: true },
        ),
      ).toBeVisible();
    const link = a.page.getByRole("link", {
      name: "Enter the room",
      exact: true,
    });
    const path = await link.getAttribute("href");
    expect(path).toMatch(/^\/a\/[0-9a-f-]+$/);
    await link.click();
    await expect(a.page).toHaveURL(new RegExp(`${path ?? "missing"}$`));
    const state = AuctionState.parse(
      await (
        await a.context.request.get(
          `/api/auctions/${path?.split("/").at(-1) ?? "missing"}/state`,
        )
      ).json(),
    );
    const response = await a.context.request.post(
      `/api/auctions/${state.id}/bids`,
      {
        headers,
        data: { amount: state.min_next_bid, idempotency_key: randomUUID() },
      },
    );
    if (response.status() === 201)
      expect(BidAccepted.parse(await response.json()).bid.amount).toBe(
        state.min_next_bid,
      );
    else {
      expect([409, 429]).toContain(response.status());
      expect([
        "BID_TOO_LOW",
        "ALREADY_LEADING",
        "AUCTION_NOT_LIVE",
        "AUCTION_CLOSED",
        "RATE_LIMITED",
      ]).toContain(ErrorBody.parse(await response.json()).error.code);
    }
    const fresh = AuctionState.parse(
      await (
        await a.context.request.get(`/api/auctions/${state.id}/state`)
      ).json(),
    );
    await setClock(
      Math.max(
        0,
        Date.parse(fresh.ends_at) - Date.parse(fresh.server_now) + 16000,
      ),
    );
    await expect(
      a.page.getByRole("link", { name: "Go to the next lot", exact: true }),
    ).toBeVisible();
    const next = await a.page
      .getByRole("link", { name: "Go to the next lot", exact: true })
      .getAttribute("href");
    expect(next).not.toBe(path);
    await a.page
      .getByRole("link", { name: "Go to the next lot", exact: true })
      .click();
    await expect(a.page).toHaveURL(new RegExp(`${next ?? "missing"}$`));
  } finally {
    await resetClock();
    await a.context.close();
  }
});
