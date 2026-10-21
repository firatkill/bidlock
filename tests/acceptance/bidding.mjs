// T-30 / TC-188–TC-192: local production two-bidder flow, before T-33 E2E harness.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const origin = "http://localhost:3100";
const created = await fetch(`${origin}/api/test/auctions`, {
  method: "POST",
  headers: {
    origin,
    "content-type": "application/json",
    "x-test-secret": "test-placeholder",
  },
  body: JSON.stringify({ duration_s: 600, title: "Bid panel acceptance" }),
});
assert.equal(created.status, 201);
const { auction_id: id } = await created.json();
const browser = await chromium.launch();
try {
  const a = await browser.newContext({ viewport: { width: 360, height: 900 } });
  const b = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  const first = await a.newPage(),
    second = await b.newPage();
  const errors = [];
  for (const page of [first, second]) {
    page.setDefaultTimeout(3000);
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
  }
  await Promise.all([
    first.goto(`${origin}/a/${id}`),
    second.goto(`${origin}/a/${id}`),
  ]);
  const quick = first.getByRole("button", { name: "Bid $10.00 +1 step" });
  await expect(quick).toBeEnabled({ timeout: 3000 });
  await quick.click();
  await expect(
    first.getByText("Bid placed: $10.00. You are the highest bidder."),
  ).toBeVisible({ timeout: 3000 });
  await expect(
    first.getByText(
      "You're leading. You can bid again after someone outbids you.",
    ),
  ).toBeVisible({ timeout: 3000 });
  await expect(
    second.getByRole("button", { name: "Bid $12.00 +2 steps" }),
  ).toBeEnabled({ timeout: 3000 });
  await second.keyboard.press("2");
  await expect(
    second.getByText("Bid placed: $12.00. You are the highest bidder."),
  ).toBeVisible({ timeout: 3000 });
  await expect(first.getByRole("main").getByRole("alert")).toContainText(
    "You've been outbid.",
    {
      timeout: 3000,
    },
  );
  await expect(
    first.getByRole("button", { name: "Bid $13.00 +1 step" }),
  ).toBeEnabled({ timeout: 3000 });
  await first.getByLabel("Your bid", { exact: true }).fill("35.555");
  await first.getByLabel("Your bid", { exact: true }).press("Enter");
  await expect(first.getByRole("main").getByRole("alert")).toHaveText(
    "Use at most two decimal places.",
    { timeout: 3000 },
  );
  await first.getByLabel("Your bid", { exact: true }).fill("13.00");
  await first.getByLabel("Your bid", { exact: true }).press("Enter");
  await expect(
    first.getByText("Bid placed: $13.00. You are the highest bidder."),
  ).toBeVisible({ timeout: 3000 });
  assert.deepEqual(errors, []);
  await mkdir("qa/screenshots/T-30", { recursive: true });
  for (const [page, name] of [
    [first, "bidding-360-light"],
    [second, "bidding-1280-dark"],
  ]) {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `qa/screenshots/T-30/${name}.png`,
      fullPage: true,
    });
  }
  console.log(
    "T-30: two isolated bidders, quick/keyboard/custom bids, accepted/outbid copy, validation, no overflow/runtime errors.",
  );
} finally {
  await browser.close();
}
