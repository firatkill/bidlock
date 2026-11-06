import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, headers } from "./fixtures";
import {
  AuctionState,
  BidAccepted,
  BidsPage,
  SandboxCreated,
  PlaceBidBody,
} from "../../src/domain/schemas";
import { adminSql } from "../fixtures/db";

async function sandbox(page: Page, short = false) {
  await page.request.get("/api/me");
  const response = await page.request.post("/api/sandboxes", {
    headers,
    data: {},
  });
  expect(response.status()).toBe(201);
  const created = SandboxCreated.parse(await response.json());
  // Own local fixture only. Do not move the global clock or call test routes in the UI.
  if (short) {
    const sql = adminSql();
    try {
      await sql`with deadline as materialized (select bidlock.bidlock_now() + interval '8 seconds' as at) update bidlock.auctions set ends_at = deadline.at, original_ends_at = deadline.at, max_extensions = 0 from deadline where id = ${created.auction_id}`;
    } finally {
      await sql.end();
    }
  }
  // Keep bots from racing the experiment; human requests still hit the real API.
  await page.route("**/api/auctions/*/bids", async (route) => {
    if (route.request().headers().authorization?.startsWith("Bot "))
      await route.fulfill({
        status: 429,
        json: {
          error: {
            code: "RATE_LIMITED",
            message: "Fixture paused",
            details: { retry_after_ms: 60000 },
          },
          request_id: randomUUID(),
        },
      });
    else await route.continue();
  });
  if (short) {
    // Hold feed refreshes so the user can click during the brief live/Closing interval.
    // Initial SSR snapshot and the click's POST still use the real server clock.
    await page.route(`**/api/auctions/${created.auction_id}/state`, (route) =>
      route.fulfill({ status: 304 }),
    );
  }
  await page.goto(`/a/${created.auction_id}`);
  await expect(
    page.getByRole("heading", { name: "Try to break it" }),
  ).toBeVisible();
  return created.auction_id;
}

test("TC-237 catalogue controls fit the 1280 by 800 viewport", async ({
  page,
  createAuction,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/a/${await createAuction()}`);
  for (const locator of [
    page.locator(".price"),
    page.getByText(/^Closes in/),
    ...(await page.locator(".quick-bid").all()),
  ]) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 800) + (box?.height ?? 1)).toBeLessThanOrEqual(800);
  }
  await expect(page.locator(".quick-bid")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Enter a custom amount" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Try to break it" }),
  ).toHaveCount(0);
});

test("TC-238 mobile sticky bar and expandable custom amount", async ({
  page,
  createAuction,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/a/${await createAuction()}`);
  await expect(page.locator(".quick-bid").first()).toBeEnabled();
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  const dock = page.locator(".bid-dock");
  expect(await dock.evaluate((el) => getComputedStyle(el).position)).toBe(
    "fixed",
  );
  const box = await dock.boundingBox();
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
  for (const button of await dock.getByRole("button").all()) {
    const rect = await button.boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    expect(rect?.width).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByLabel("Your bid", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Enter a custom amount" }).click();
  await expect(page.getByLabel("Your bid", { exact: true })).toBeFocused();
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  const lastContent = await page
    .getByRole("region", { name: "Bid history" })
    .boundingBox();
  const expanded = await dock.boundingBox();
  expect(
    (lastContent?.y ?? 0) + (lastContent?.height ?? 0),
  ).toBeLessThanOrEqual(expanded?.y ?? 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("TC-239 race sends distinct keys and reports one acceptance", async ({
  page,
}) => {
  await sandbox(page);
  const responses: { status: number; body: unknown }[] = [];
  const keys: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/bids") &&
      !request.headers().authorization
    ) {
      const body = PlaceBidBody.parse(request.postDataJSON());
      keys.push(body.idempotency_key);
    }
  });
  const a = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith("/bids") &&
      r.status() === 201,
  );
  const b = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith("/bids") &&
      r.status() === 409,
  );
  await page.getByRole("button", { name: "Race", exact: true }).click();
  for (const r of await Promise.all([a, b]))
    responses.push({ status: r.status(), body: await r.json() });
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(new Set(keys).size).toBe(2);
  await expect(page.locator("output").first()).toContainText(
    /BID_TOO_LOW|ALREADY_LEADING/,
  );
  await expect(
    page.getByText("You're leading. Wait until a bot outbids you."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Race", exact: true }),
  ).toBeDisabled();
});

test("TC-240 replay returns the same bid id without another row", async ({
  page,
}) => {
  const id = await sandbox(page);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(
    page.getByText("Same bid id. No second row.", { exact: false }),
  ).toBeVisible();
  const history = BidsPage.parse(
    await (await page.request.get(`/api/auctions/${id}/bids`)).json(),
  );
  expect(history.bids).toHaveLength(1);
  const output = await page.locator("output").nth(1).innerText();
  expect(output.split(history.bids[0]?.id ?? "missing")).toHaveLength(3);
});

test("TC-241 late experiment uses real deadline and receives AUCTION_CLOSED", async ({
  page,
}) => {
  const id = await sandbox(page, true);
  const button = page.getByRole("button", { name: "Send late", exact: true });
  await expect(button).toBeDisabled();
  const state = AuctionState.parse(
    await (await page.request.get(`/api/auctions/${id}/state`)).json(),
  );
  // Wait for this fixture's known deadline, not for a raised assertion timeout.
  await page.waitForTimeout(
    Math.max(0, Date.parse(state.ends_at) - Date.parse(state.server_now)) + 300,
  );
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator("output").nth(2)).toContainText("AUCTION_CLOSED");
});

test("TC-242 own rejected bid is local to the current page session", async ({
  page,
  createAuction,
}) => {
  const id = await createAuction();
  await page.goto(`/a/${id}`);
  await page.getByLabel("Your bid", { exact: true }).fill("9.00");
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  const history = page.getByRole("region", { name: "Bid history" });
  await expect(history.getByText("rejected", { exact: true })).toBeVisible();
  await expect(history.locator("s")).toHaveText("$9.00");
  await expect(
    history.getByText(
      "The price check rejected your bid. The minimum is now $10.00.",
    ),
  ).toBeVisible();
  const bids = BidsPage.parse(
    await (await page.request.get(`/api/auctions/${id}/bids`)).json(),
  );
  expect(bids.bids).toHaveLength(0);
  await page.reload();
  await expect(history.getByText("rejected", { exact: true })).toHaveCount(0);
});

test("TC-243 ledger shows server placed_at to milliseconds", async ({
  page,
  createAuction,
}) => {
  await page.goto(`/a/${await createAuction()}`);
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/bids"),
  );
  await page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
  const accepted = BidAccepted.parse(await (await response).json());
  const time = page
    .getByRole("region", { name: "Bid history" })
    .locator("time")
    .first();
  await expect(time).toHaveAttribute("datetime", accepted.bid.placed_at);
  await expect(time).toHaveText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  expect((await time.innerText()).slice(-3)).toBe(
    String(new Date(accepted.bid.placed_at).getMilliseconds()).padStart(3, "0"),
  );
});

for (const theme of ["light", "dark"] as const)
  test(`TC-246 catalogue axe and touch targets ${theme}`, async ({
    page,
    createAuction,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    const id = await createAuction({ duration_s: 12, max_extensions: 0 });
    await page.goto(`/a/${id}`);
    await expect(page.locator(".quick-bid").first()).toBeEnabled();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
    expect(
      await page
        .locator(".fuse")
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
    for (const control of await page.locator("a,button,input").all()) {
      if (!(await control.isVisible())) continue;
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await page.locator(".quick-bid").first().click();
    const state = AuctionState.parse(
      await (await page.request.get(`/api/auctions/${id}/state`)).json(),
    );
    await page.waitForTimeout(
      Math.max(0, Date.parse(state.ends_at) - Date.parse(state.server_now)) +
        300,
    );
    await expect(
      page.getByRole("heading", { name: /You won Lot/ }),
    ).toBeVisible();
    const receipt = await new AxeBuilder({ page }).analyze();
    expect(
      receipt.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
    await sandbox(page);
    const experiments = await new AxeBuilder({ page }).analyze();
    expect(
      experiments.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
