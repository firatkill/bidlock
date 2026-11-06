import { test, expect, newBidder } from "./fixtures";
test("TC-234 E2E-05 late bid extends close and marks history @isolated", async ({
  browser,
  createAuction,
  setClock,
  resetClock,
}) => {
  const a = await newBidder(browser);
  try {
    const id = await createAuction({ duration_s: 120 });
    await a.page.goto(`/a/${id}`);
    await setClock(112000);
    // Test-clock jumps are discontinuous; start with a fresh clock sample.
    await a.page.reload();
    await a.page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
    await expect(
      a.page.getByText("Late bid! Closing moved to 0:30", { exact: true }),
    ).toBeVisible();
    await expect(
      a.page.getByText("Extension 1 of 20", { exact: true }),
    ).toBeVisible();
    await expect(a.page.getByText(/^Closes in 0:(29|30)$/)).toBeVisible();
    const history = a.page.getByRole("region", { name: "Bid history" });
    await expect(history.getByText("+0:30", { exact: true })).toHaveAttribute(
      "title",
      "This bid extended the close",
    );
  } finally {
    await resetClock();
    await a.context.close();
  }
});
