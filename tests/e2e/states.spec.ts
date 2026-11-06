import { randomUUID } from "node:crypto";
import { AuctionState } from "../../src/domain/schemas";
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
  const id = await createAuction({ starts_in_s: 60 });
  await page.goto(`/a/${id}`);
  const countdown = page.getByText(/^Opens in \d+:\d{2}$/);
  await expect(countdown).toBeVisible();
  // Creation returns only the ID; read its timestamps from the state endpoint.
  const response = await page.request.get(`/api/auctions/${id}/state`);
  expect(response.status()).toBe(200);
  const state = AuctionState.parse(await response.json());
  const expectedSeconds = Math.max(
    0,
    Math.ceil(
      (Date.parse(state.starts_at) - Date.parse(state.server_now)) / 1000,
    ),
  );
  const text = await countdown.innerText();
  expect(text).toMatch(/^Opens in \d+:[0-5]\d$/);
  const [minutes, seconds] = text
    .replace("Opens in ", "")
    .split(":")
    .map(Number);
  const displayedSeconds = (minutes ?? NaN) * 60 + (seconds ?? NaN);
  expect(displayedSeconds).toBeLessThanOrEqual(60);
  expect(Math.abs(displayedSeconds - expectedSeconds)).toBeLessThanOrEqual(3);
  await expect(
    page.getByRole("button", { name: "Bid $10.00 +1 step" }),
  ).toBeDisabled();
});
