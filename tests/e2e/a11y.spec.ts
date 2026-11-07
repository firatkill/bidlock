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

for (const colorScheme of ["light", "dark"] as const) {
  test(`TC-275 TC-289 E2E-07 how-it-works axe ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/how-it-works");
    await expect(
      page.getByRole("heading", { name: "How it works", exact: true }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}
for (const width of [360, 375]) {
  test(`TC-275 TC-289 E2E-07 how-it-works mobile ${String(width)}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/how-it-works#benchmark");
    await expect(
      page.getByRole("table", { name: "Benchmark", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
test("TC-272 TC-284 TC-285 How it works sections and timeline", async ({
  page,
}) => {
  await page.goto("/how-it-works");
  expect(
    await page
      .locator("main section")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual([
    "rules",
    "state-machine",
    "concurrency",
    "benchmark",
    "stats",
    "run-it",
  ]);
  await expect(
    page.getByRole("figure", { name: "Two bids, one auction row" }),
  ).toContainText("BID_TOO_LOW");
  await expect(
    page.getByRole("img", { name: "Auction lifecycle" }),
  ).toBeVisible();
  await expect(page.locator("#rules")).toContainText("180 seconds");
  await expect(page.locator("#rules")).toContainText("$1,000,000.00");
});
test("TC-275 TC-289 lobby benchmark link resolves to the table @isolated", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See the full results" }).click();
  await expect(page).toHaveURL(/\/how-it-works#benchmark$/);
  await expect(
    page.getByRole("table", { name: "Benchmark", exact: true }),
  ).toBeVisible();
});
