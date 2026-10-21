// T-32 / TC-197–TC-199: local production lobby at mobile and desktop widths.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
try {
  await mkdir("qa/screenshots/T-32", { recursive: true });
  for (const [width, colorScheme] of [
    [360, "light"],
    [1280, "dark"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await page.goto("http://localhost:3100");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 3000,
    });
    await expect(
      page.getByRole("link", { name: "Enter the room" }),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: "Start a sandbox" }),
    ).toBeDisabled({ timeout: 3000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const results = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact),
      ),
      [],
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `qa/screenshots/T-32/lobby-${width}-${colorScheme}.png`,
      fullPage: true,
    });
    await context.close();
  }
  console.log(
    "T-32 lobby: mobile/light and desktop/dark, zero serious/critical axe violations, no overflow or runtime errors.",
  );
} finally {
  await browser.close();
}
