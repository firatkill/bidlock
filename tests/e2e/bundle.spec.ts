import { test, expect } from "./fixtures";
test("TC-206 E2E-09 initial auction scripts fit 180 KiB gzip", async ({
  page,
  createAuction,
}, testInfo) => {
  await page.goto(`/a/${await createAuction()}`, { waitUntil: "load" });
  const sizes = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          entry instanceof PerformanceResourceTiming &&
          entry.initiatorType === "script" &&
          new URL(entry.name).pathname.startsWith("/_next/"),
      )
      .map((entry) => ({
        name: new URL(entry.name).pathname,
        bytes: entry.encodedBodySize,
      })),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.every((entry) => entry.bytes > 0)).toBe(true);
  const bytes = sizes.reduce((sum, entry) => sum + entry.bytes, 0);
  await testInfo.attach("initial-script-sizes", {
    body: JSON.stringify({ bytes, sizes }, null, 2),
    contentType: "application/json",
  });
  expect(bytes).toBeLessThanOrEqual(180 * 1024);
});
