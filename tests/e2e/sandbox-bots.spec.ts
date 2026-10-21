import { test, expect, newBidder } from "./fixtures";
import { AuctionState, BidsPage } from "../../src/domain/schemas";
// Visits the shared public lobby: AGENTS.md isolation overrides the plan's parallel label.
test("TC-225 TC-226 E2E-03 seeded sandbox bots and human bid @isolated", async ({
  browser,
}) => {
  const owner = await newBidder(browser);
  try {
    await owner.page
      .getByRole("button", { name: "Start a sandbox", exact: true })
      .click();
    await expect(owner.page).toHaveURL(/\/a\/[0-9a-f-]+$/);
    await expect(
      owner.page.getByText(/Your sandbox · expires in 14:5\d/),
    ).toBeVisible();
    for (const name of ["Cautious bot", "Steady bot", "Sniper bot"])
      await expect(
        owner.page.getByText(name, { exact: true }).first(),
      ).toBeVisible();
    await expect(
      owner.page.getByText(
        "The bots run in this tab. If you close it, they stop bidding.",
      ),
    ).toBeVisible();
    const id = owner.page.url().split("/").at(-1);
    if (!id) throw new Error("Missing sandbox auction id");
    // The spec allows 15s for a bot decision; keep each assertion's 3s limit.
    const started = Date.now();
    let botVisible = false;
    while (Date.now() - started < 15000) {
      botVisible = await owner.page
        .getByText("BOT", { exact: true })
        .first()
        .isVisible();
      if (botVisible) break;
      await owner.page.waitForTimeout(250);
    }
    expect(botVisible).toBe(true);
    // Invite a counterbid so the timestamp assertion exercises repeated bot bids.
    await owner.page.getByRole("textbox", { name: "Your bid" }).fill("30");
    await owner.page
      .getByRole("button", { name: "Place bid", exact: true })
      .click();
    await expect(
      owner.page.getByText("You are the highest bidder.", { exact: true }),
    ).toBeVisible();
    const counterStart = Date.now();
    let repeatedBot = false;
    while (Date.now() - counterStart < 15000) {
      const history = BidsPage.parse(
        await (
          await owner.context.request.get(`/api/auctions/${id}/bids?limit=50`)
        ).json(),
      );
      const ids = history.bids
        .filter((bid) => bid.is_bot)
        .map((bid) => bid.bidder_id);
      repeatedBot = new Set(ids).size < ids.length;
      if (repeatedBot) break;
      await owner.page.waitForTimeout(250);
    }
    expect(repeatedBot).toBe(true);
    await owner.page.getByRole("textbox", { name: "Your bid" }).fill("120");
    await owner.page
      .getByRole("button", { name: "Place bid", exact: true })
      .click();
    await expect(
      owner.page.getByText("You are the highest bidder.", { exact: true }),
    ).toBeVisible();
    const state = AuctionState.parse(
      await (
        await owner.context.request.get(`/api/auctions/${id}/state`)
      ).json(),
    );
    expect(state.leader?.id).toBe(owner.id);
    const page = BidsPage.parse(
      await (
        await owner.context.request.get(`/api/auctions/${id}/bids?limit=50`)
      ).json(),
    );
    expect(page.bids.some((bid) => bid.is_bot)).toBe(true);
    expect(page.bids.some((bid) => bid.bidder_id === owner.id)).toBe(true);
    const bots = new Map<string, number[]>();
    for (const bid of page.bids.filter((bid) => bid.is_bot)) {
      const times = bots.get(bid.bidder_id) ?? [];
      times.push(Date.parse(bid.placed_at));
      bots.set(bid.bidder_id, times);
    }
    for (const times of bots.values()) {
      times.sort((a, b) => a - b);
      for (let n = 1; n < times.length; n++)
        expect((times[n] ?? 0) - (times[n - 1] ?? 0)).toBeGreaterThanOrEqual(
          2000,
        );
    }
  } finally {
    await owner.context.close();
  }
});
