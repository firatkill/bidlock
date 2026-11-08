import { test, expect, newBidder } from "./fixtures";
test("TC-202 TC-297 E2E-02 two bidders synchronize and stale bids are rejected @isolated", async ({
  browser,
  createAuction,
}) => {
  const id = await createAuction();
  const a = await newBidder(browser, "UTC"),
    b = await newBidder(browser, "Europe/Istanbul");
  const browserErrors: string[] = [];
  for (const { page } of [a, b]) {
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      // The stale-bid step intentionally receives the specified HTTP 409.
      if (
        message.type() === "error" &&
        message.text() !==
          "Failed to load resource: the server responded with a status of 409 (Conflict)"
      )
        browserErrors.push(message.text());
    });
  }
  const checkTimes = async (
    bidder: typeof a,
    offsetHours: number,
    count: number,
  ) => {
    const times = bidder.page
      .getByRole("region", { name: "Bid history" })
      .locator("time");
    await expect(times).toHaveCount(count);
    for (const time of await times.all()) {
      const iso = await time.getAttribute("datetime");
      expect(iso).not.toBeNull();
      const expected = new Date(Date.parse(iso ?? "") + offsetHours * 3_600_000)
        .toISOString()
        .slice(11, 23);
      await expect(time).toHaveText(expected);
    }
  };
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
    // Reload with a pre-existing bid: UTC SSR must hydrate into Istanbul time.
    await b.page.reload();
    await checkTimes(b, 3, 1);
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
    await checkTimes(a, 0, 2);
    await checkTimes(b, 3, 2);
    expect(browserErrors).toEqual([]);
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
