// T-26 / TC-170–TC-174: local production acceptance and PR screenshots.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
await mkdir("qa/screenshots/T-26", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [360, 1280])
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        colorScheme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(3000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      const audit = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        audit.violations
          .filter((v) => ["serious", "critical"].includes(v.impact))
          .map((v) => v.id),
        [],
      );
      await page.screenshot({
        path: `qa/screenshots/T-26/shell-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const field = page.getByRole("textbox", { name: "Display name" });
      await field.fill("Robot");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      assert.equal(
        await page.getByRole("alert").textContent(),
        "Names ending in “bot” are reserved for bots.",
      );
      await page.screenshot({
        path: `qa/screenshots/T-26/dialog-${width}-${colorScheme}.png`,
        fullPage: true,
      });
      await field.fill(`QA ${width} ${colorScheme}`);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page
        .getByText(`You are QA ${width} ${colorScheme}`, { exact: true })
        .waitFor();
      assert.equal(
        await page.getByRole("status").textContent(),
        "Name updated.",
      );
      await page.waitForTimeout(3000);
      assert.equal(await page.getByRole("status").textContent(), "");
      await page.getByRole("button", { name: "Theme: System" }).click();
      await page.reload();
      await page.getByRole("button", { name: "Theme: Light" }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.dataset.theme),
        "light",
      );
      const nonces = await page
        .locator("script")
        .evaluateAll((nodes) => nodes.map((node) => node.nonce));
      assert.ok(nonces.length > 0 && nonces.every((nonce) => nonce.length > 0));
      assert.deepEqual(errors, []);
      await context.close();
    }
  console.log(
    "T-26 browser acceptance passed: four responsive/theme combinations, name save/validation, toast expiry, theme reload, nonce scripts, no serious/critical axe findings or runtime errors.",
  );
} finally {
  await browser.close();
}
