import { formatCents } from "../../src/domain/money";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, headers } from "./fixtures";
import {
  AuctionState,
  BidAccepted,
  BotTokens,
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
    page.locator(".countdown-text"),
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
  await expect(page.locator("output").nth(1).locator("[title]")).toHaveCount(2);
  for (const item of await page
    .locator("output")
    .nth(1)
    .locator("[title]")
    .all())
    await expect(item).toHaveAttribute(
      "title",
      history.bids[0]?.id ?? "missing",
    );
  expect(
    output.split(history.bids[0]?.id.slice(0, 8) ?? "missing"),
  ).toHaveLength(3);
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

test("TC-249 mobile countdown and price clear the compact dock at first load", async ({
  page,
  createAuction,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/a/${await createAuction()}`);
  await expect(page.locator(".quick-bid").first()).toBeEnabled();
  const dock = page.locator(".bid-dock");
  const box = await dock.boundingBox();
  expect(box?.height).toBeLessThanOrEqual(140);
  for (const locator of [
    page.locator(".price"),
    page.locator(".countdown-text"),
  ]) {
    const rect = await locator.boundingBox();
    expect(rect).not.toBeNull();
    expect((rect?.y ?? 812) + (rect?.height ?? 1)).toBeLessThanOrEqual(
      box?.y ?? 0,
    );
  }
  await page.locator(".quick-bid").first().click();
  await expect(page.getByText(/^Bid placed:/)).toBeVisible();
  await expect(dock.getByText(/^Bid placed:/)).toHaveCount(0);
  expect((await dock.boundingBox())?.height).toBeLessThanOrEqual(140);
});

test("TC-250 newer accepted bids appear above earlier rejected requests", async ({
  page,
  createAuction,
}) => {
  await page.goto(`/a/${await createAuction()}`);
  await page.getByLabel("Your bid", { exact: true }).fill("9.00");
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  const history = page.getByRole("region", { name: "Bid history" });
  await expect(history.locator("[data-rejected]")).toHaveCount(1);
  await page.locator(".quick-bid").first().click();
  await expect(history.locator("time")).toHaveCount(1);
  await expect(history.getByRole("listitem").nth(0)).toContainText("#1");
  await expect(history.getByRole("listitem").nth(1)).toContainText("rejected");
});

test("TC-251 run snapshots remain factual when the current price changes", async ({
  page,
}) => {
  const id = await sandbox(page);
  const state = AuctionState.parse(
    await (await page.request.get(`/api/auctions/${id}/state`)).json(),
  );
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  const output = page.locator("output").nth(1);
  await expect(output).toContainText("Same bid id. No second row.");
  const original = await output.innerText();
  expect(original).toMatch(/^\d{2}:\d{2}:\d{2} · \$/);
  const tokens = BotTokens.parse(
    await (
      await page.request.post("/api/bot-tokens", {
        headers,
        data: { sandbox_id: state.sandbox?.id },
      })
    ).json(),
  );
  const next = AuctionState.parse(
    await (await page.request.get(`/api/auctions/${id}/state`)).json(),
  );
  expect(
    (
      await page.request.post(`/api/auctions/${id}/bids`, {
        headers: {
          ...headers,
          authorization: `Bot ${tokens.bots[0]?.token ?? ""}`,
        },
        data: { amount: next.min_next_bid, idempotency_key: randomUUID() },
      })
    ).status(),
  ).toBe(201);
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toBeEnabled();
  await expect(output).toHaveText(original, { useInnerText: true });
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(output).toContainText("Same bid id. No second row.");
  expect(await output.innerText()).not.toBe(original);
  const header = (await output.innerText()).split("\n")[0];
  const latest = AuctionState.parse(
    await (await page.request.get(`/api/auctions/${id}/state`)).json(),
  );
  expect(header).toContain(formatCents(latest.current_price ?? 0));
  await expect(output.locator("[title]")).toHaveCount(2);
});

test("TC-254 mobile header is one row with keyboard-accessible navigation", async ({
  page,
  createAuction,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/a/${await createAuction()}`);
  const header = page.locator("header").first();
  const edit = header.getByRole("button", { name: "Edit", exact: true });
  await expect(edit).toBeVisible();
  expect((await header.boundingBox())?.height).toBeLessThanOrEqual(80);
  const menu = header.getByRole("button", { name: "Menu", exact: true });
  expect((await menu.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await menu.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  await expect(header.getByRole("link", { name: "How it works" })).toBeHidden();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(
    header.getByRole("link", { name: "How it works" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(header.getByRole("link", { name: "GitHub" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(header.getByRole("button", { name: /Theme/ })).toBeFocused();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("TC-253 F7 reload has no price or ledger flash and only a new bid row animates", async ({
  page,
  browser,
  createAuction,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const id = await createAuction();
  const rival = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    await rival.request.get("/api/me");
    expect(
      (
        await rival.request.post(`/api/auctions/${id}/bids`, {
          headers,
          data: { amount: 1000, idempotency_key: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    // Observe real CSS animation events, including short animations that finish before an assertion runs.
    await page.addInitScript(() => {
      document.addEventListener("animationstart", (event) => {
        if (
          event.animationName === "flash" &&
          event.target instanceof HTMLElement
        )
          event.target.dataset.flashObserved = "true";
      });
    });
    await page.goto(`/a/${id}`);
    await page.reload();
    const history = page.getByRole("region", { name: "Bid history" });
    await expect(history.locator("time")).toHaveCount(1);
    await expect(page.locator(".quick-bid").first()).toBeEnabled();
    await expect(
      page.locator(
        '.price[data-flash-observed], [aria-labelledby="history-heading"] [data-flash-observed]',
      ),
    ).toHaveCount(0);
    expect(
      await page
        .locator('.price, [aria-labelledby="history-heading"] li')
        .evaluateAll(
          (elements) =>
            elements.flatMap((element) =>
              element
                .getAnimations()
                .filter(
                  (animation) =>
                    animation instanceof CSSAnimation &&
                    animation.animationName === "flash" &&
                    animation.playState === "running",
                ),
            ).length,
        ),
    ).toBe(0);
    await expect(history.locator(".price-flash")).toHaveCount(0);
    await page.locator(".quick-bid").first().click();
    const rows = history.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("#2");
    await expect(rows.nth(0)).toHaveAttribute("data-flash-observed", "true");
    await expect(rows.nth(1)).not.toHaveAttribute(
      "data-flash-observed",
      "true",
    );
    await expect(history.locator(".price-flash")).toHaveCount(1);
    await expect(page.locator(".price")).toHaveAttribute(
      "data-flash-observed",
      "true",
    );
  } finally {
    await rival.close();
  }
});
