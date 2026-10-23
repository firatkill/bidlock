import { test, expect, newBidder } from "./fixtures";
test("TC-228 E2E-04 settlement winner pays @isolated", async ({
  browser,
  createAuction,
  setClock,
  resetClock,
}) => {
  const a = await newBidder(browser);
  try {
    const id = await createAuction({ duration_s: 20 });
    await a.page.goto(`/a/${id}`);
    await a.page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
    await expect(
      a.page.getByText("You are the highest bidder.", { exact: true }),
    ).toBeVisible();
    await setClock(21000);
    await expect(
      a.page.getByRole("heading", { name: /^You won Lot \d+ for \$10\.00\.$/ }),
    ).toBeVisible();
    await a.page.getByRole("button", { name: "Pay now (simulated)" }).click();
    await expect(
      a.page.getByText(
        /^Paid\. Lot \d+ is yours for \$10\.00\. Thanks for testing Bidlock\.$/,
      ),
    ).toBeVisible();
    await expect(
      a.page.getByRole("button", { name: "Pay now (simulated)" }),
    ).toHaveCount(0);
  } finally {
    await resetClock();
    await a.context.close();
  }
});
test("TC-229 TC-232 E2E-04 settlement runner-up and strike @isolated", async ({
  browser,
  createAuction,
  setClock,
  resetClock,
}) => {
  const a = await newBidder(browser),
    b = await newBidder(browser);
  try {
    const id = await createAuction({ duration_s: 20 });
    await Promise.all([a.page.goto(`/a/${id}`), b.page.goto(`/a/${id}`)]);
    await b.page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
    await expect(
      a.page.getByRole("button", { name: "Bid $11.00 +1 step" }),
    ).toBeEnabled();
    await a.page.getByRole("button", { name: "Bid $11.00 +1 step" }).click();
    await expect(
      a.page.getByText("You are the highest bidder.", { exact: true }),
    ).toBeVisible();
    await setClock(21000);
    await expect(
      a.page.getByRole("heading", { name: /^You won Lot \d+ for \$11\.00\.$/ }),
    ).toBeVisible();
    await setClock(202000);
    await expect(
      b.page.getByRole("heading", {
        name: "Second-chance offer.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      a.page.getByText(
        "Your payment window expired, so the lot was offered to the runner-up. This counts as one missed payment on your demo profile.",
      ),
    ).toBeVisible();
    await expect(
      a.page.getByText("1 missed payment", { exact: true }),
    ).toBeVisible();
    await b.page.goto("/");
    await expect(
      b.page.getByText(
        /^Second-chance offer on Lot \d+: \$10\.00\. Ends in \d+:\d{2}\.$/,
      ),
    ).toBeVisible();
    await b.page
      .getByRole("link", { name: "Go to the auction", exact: true })
      .click();
    await b.page.getByRole("button", { name: "Pay now (simulated)" }).click();
    await expect(
      b.page.getByText(
        /^Paid\. Lot \d+ is yours for \$10\.00 through a second-chance offer\.$/,
      ),
    ).toBeVisible();
    await expect(
      b.page.getByText(/missed payment/, { exact: false }),
    ).toHaveCount(0);
  } finally {
    await resetClock();
    await a.context.close();
    await b.context.close();
  }
});
