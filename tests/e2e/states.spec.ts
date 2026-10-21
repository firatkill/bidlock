import { randomUUID } from "node:crypto";
import { test, expect, headers } from "./fixtures";
test("TC-205 E2E-08 minute limit shows countdown and disables bidding @isolated", async ({
  page,
  createAuction,
  resetClock,
}) => {
  try {
    const id = await createAuction();
    await page.goto(`/a/${id}`);
    const bid = page.getByRole("button", { name: "Bid $10.00 +1 step" });
    await expect(bid).toBeEnabled();
    for (let i = 0; i < 65; i++) {
      const response = await page.request.post(`/api/auctions/${id}/bids`, {
        headers: { ...headers, "idempotency-key": randomUUID() },
        data: { amount: 999, idempotency_key: randomUUID() },
      });
      expect([409, 429]).toContain(response.status());
    }
    await bid.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      /^Slow down\. You can bid again in \d+ s\.$/,
    );
    await expect(bid).toBeDisabled();
    await expect(page.getByLabel("Your bid", { exact: true })).toBeDisabled();
  } finally {
    await resetClock();
  }
});
test("TC-205 E2E-08 missing auction and scheduled controls", async ({
  page,
  createAuction,
}) => {
  await page.goto(`/a/${randomUUID()}`);
  await expect(
    page.getByText("Auction not found.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/a/${await createAuction({ starts_in_s: 60 })}`);
  await expect(page.getByText(/Opens in (1:00|0:59)/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bid $10.00 +1 step" }),
  ).toBeDisabled();
});
