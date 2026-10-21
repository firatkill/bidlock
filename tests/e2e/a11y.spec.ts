import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
for (const colorScheme of ["light", "dark"] as const) {
  test(`TC-203 E2E-07 room axe ${colorScheme}`, async ({
    page,
    createAuction,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(`/a/${await createAuction()}`);
    await expect(
      page.getByRole("button", { name: "Bid $10.00 +1 step" }),
    ).toBeEnabled();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
  test(`TC-203 E2E-07 lobby axe ${colorScheme} @isolated`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Enter the room" }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}
test("TC-203 E2E-07 keyboard-only bid", async ({ page, createAuction }) => {
  await page.goto(`/a/${await createAuction()}`);
  const bid = page.getByRole("button", { name: "Bid $10.00 +1 step" });
  await expect(bid).toBeEnabled();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await bid.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(bid).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("You are the highest bidder.", { exact: true }),
  ).toBeVisible();
});
test("TC-204 E2E-07 mobile reduced motion and polling has no sockets", async ({
  page,
  createAuction,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    sockets.push(socket.url());
  });
  await page.goto(`/a/${await createAuction()}`);
  await page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
  await expect(
    page.getByText("You are the highest bidder.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  expect(
    await page.locator(".price").evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  expect(sockets).toEqual([]);
});
test("TC-204 E2E-07 mobile lobby has no overflow @isolated", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Enter the room" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
test("TC-171 deferred name dialog opens saves and returns keyboard focus", async ({
  page,
  createAuction,
}) => {
  await page.goto(`/a/${await createAuction()}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your display name" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("E2E-Rename");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("You are E2E-Rename", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeFocused();
});
