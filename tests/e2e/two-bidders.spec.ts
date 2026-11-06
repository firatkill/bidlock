import { test, expect, newBidder } from "./fixtures";
test("TC-202 E2E-02 two bidders synchronize and stale bids are rejected @isolated", async ({
  browser,
  createAuction,
}) => {
  const id = await createAuction();
  const a = await newBidder(browser),
    b = await newBidder(browser);
  try {
    await Promise.all([a.page.goto(`/a/${id}`), b.page.goto(`/a/${id}`)]);
    await a.page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
    await expect(
      a.page.getByText("You are the highest bidder.", { exact: true }),
    ).toBeVisible();
    await expect(b.page.locator(".price")).toHaveText("$10.00");
    await expect(
      b.page.getByText(`Leader: ${a.name}`, { exact: true }),
    ).toBeVisible();
    await expect(
      b.page.getByRole("button", { name: "Bid $12.00 +2 steps" }),
    ).toBeEnabled();
    await b.page.keyboard.press("2");
    await expect(a.page.getByRole("main").getByRole("alert")).toContainText(
      "You've been outbid.",
    );
    await expect(a.page.locator(".price")).toHaveText("$12.00");
    await expect(
      a.page.getByRole("button", { name: "Bid $13.00 +1 step" }),
    ).toBeEnabled();
    await a.page.getByLabel("Your bid", { exact: true }).fill("11.00");
    await a.page.getByLabel("Your bid", { exact: true }).press("Enter");
    await expect(a.page.getByRole("main").getByRole("alert")).toHaveText(
      "Someone bid first. The minimum is now $13.00.",
    );
    for (const [bidder, amount] of [
      [a, "$10.00"],
      [b, "$12.00"],
    ] as const) {
      const history = bidder.page.getByRole("region", { name: "Bid history" });
      const acceptedRows = history
        .getByRole("listitem")
        .filter({ has: bidder.page.locator("time") });
      await expect(acceptedRows).toHaveCount(2);
      await expect(history.getByText("rejected", { exact: true })).toHaveCount(
        bidder === a ? 1 : 0,
      );
      await expect(
        acceptedRows
          .filter({ hasText: amount })
          .getByText("You", { exact: true }),
      ).toBeVisible();
      await expect(history.getByText("You", { exact: true })).toHaveCount(1);
    }
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
