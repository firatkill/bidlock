// T-29 / TC-184–TC-187: production-rendered read-only auction room, local only.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://localhost:3100";
const response = await fetch(`${origin}/api/test/auctions`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin,
    "x-test-secret": "test-placeholder",
  },
  body: JSON.stringify({ duration_s: 600, title: "Read-only room acceptance" }),
});
assert.equal(response.status, 201);
const { auction_id: id } = await response.json();
await mkdir("qa/screenshots/T-29", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [360, 1280])
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(3000);
      const errors = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(`${origin}/a/${id}`, { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: "Read-only room acceptance" }),
      ).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("No bids yet. Be the first.")).toBeVisible({
        timeout: 3000,
      });
      await expect(page.getByText(/^Closes in /)).toBeVisible({
        timeout: 3000,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const audit = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        audit.violations
          .filter((item) => ["serious", "critical"].includes(item.impact))
          .map((item) => item.id),
        [],
      );
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: `qa/screenshots/T-29/room-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.goto(`${origin}/a/00000000-0000-4000-8000-999999999999`);
      await expect(
        page.getByRole("heading", { name: "Auction not found." }),
      ).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole("link", { name: "Back to the lobby" }),
      ).toBeVisible({ timeout: 3000 });
      await context.close();
    }
} finally {
  await browser.close();
}
console.log(
  "T-29 production room: 360/1280 light/dark, exact copy, no overflow, zero serious/critical axe or runtime errors; missing auction verified.",
);
