import { afterAll, expect, test } from "vitest";
import { sql } from "@/server/db";
import { createBidder, getMe, renameBidder } from "@/server/repo/me";
import { auctionState, listAuctions, listBids } from "@/server/repo/auctions";
import { placeBid, payOffer } from "@/server/repo/bids";
import { checkBidRate } from "@/server/repo/rate";
import { createSandbox, sandboxBots } from "@/server/repo/sandboxes";
import { stats } from "@/server/repo/stats";
import {
  createTestAuction,
  serverNow,
  setTestClock,
} from "@/server/repo/testSupport";
import { Cents, Me } from "@/domain/schemas";

afterAll(async () => {
  await sql.end();
  globalThis.__bidlockSql = undefined;
});
test("TC-127: repository calls parse every application function and serialize dates", async () => {
  const ip = crypto.randomUUID().replaceAll("-", "");
  const created = await createBidder(ip);
  expect(created.outcome).toBe("accepted");
  if (created.outcome !== "accepted") throw new Error("Expected guest fixture");
  const who = created.bidder_id;
  expect(created.display_name).toMatch(/^Bidder [1-9][0-9]{3}$/);
  expect(await renameBidder(who, "Repo Guest")).toEqual({
    outcome: "accepted",
  });
  expect((await getMe(who))?.display_name).toBe("Repo Guest");
  expect(await getMe(crypto.randomUUID())).toBeNull();
  expect(await renameBidder(crypto.randomUUID(), "Absent Guest")).toEqual({
    outcome: "rejected",
    error_code: "NOT_FOUND",
  });
  const id = await createTestAuction({
    duration_s: 120,
    snipe_window_s: 0,
    title: "Repository fixture",
  });
  const before = await auctionState(id, who);
  expect(before?.title).toBe("Repository fixture");
  expect(before?.current_price).toBeNull();
  expect(await auctionState(crypto.randomUUID(), who)).toBeNull();
  expect(await listBids(crypto.randomUUID(), who)).toBeNull();
  expect(await checkBidRate(who, ip)).toBe(0);
  const key = crypto.randomUUID();
  const accepted = await placeBid(id, who, 1000, key);
  expect(accepted.outcome).toBe("accepted");
  expect(accepted.replayed).toBe(false);
  expect(typeof accepted.placed_at).toBe("string");
  expect(accepted.placed_at).toMatch(/Z$/);
  expect((await placeBid(id, who, 1000, key)).replayed).toBe(true);
  expect((await placeBid(id, who, 1100, key)).error_code).toBe(
    "IDEMPOTENCY_MISMATCH",
  );
  expect((await listBids(id, who))?.bids[0]?.id).toBe(accepted.bid_id);
  expect((await payOffer(id, who)).error_code).toBe("NOT_PAYABLE");
  if (!before) throw new Error("Missing fixture state");
  try {
    await setTestClock(Date.parse(before.ends_at) - Date.now() + 1000);
    expect((await auctionState(id, who))?.status).toBe("closed");
    const paid = await payOffer(id, who);
    expect(paid).toMatchObject({
      outcome: "accepted",
      status: "settled",
      payment_state: "paid",
      amount: 1000,
    });
    expect(typeof paid.server_now).toBe("string");
  } finally {
    await setTestClock(0);
  }
  const sandbox = await createSandbox(who, ip, 42);
  expect(sandbox.outcome).toBe("accepted");
  expect(typeof sandbox.expires_at).toBe("string");
  if (!sandbox.sandbox_id) throw new Error("Missing sandbox fixture");
  expect(
    (await sandboxBots(who, sandbox.sandbox_id))?.bots.map((b) => b.persona),
  ).toEqual(["cautious", "steady", "sniper"]);
  expect(await sandboxBots(crypto.randomUUID(), sandbox.sandbox_id)).toBeNull();
  expect((await listAuctions(who)).sandbox?.id).toBe(sandbox.auction_id);
  expect((await listAuctions(null)).public.kind).toBe("public");
  expect((await getMe(who))?.active_sandbox?.sandbox_id).toBe(
    sandbox.sandbox_id,
  );
  expect((await stats()).active_sandboxes).toBeGreaterThanOrEqual(1);
  expect(typeof (await serverNow())).toBe("string");
});
test("TC-128: SQL integer and strict nested response boundaries reject invalid values", async () => {
  expect(Cents.safeParse(1000).success).toBe(true);
  for (const value of [1.1, 0, 100000001, Number.MAX_SAFE_INTEGER + 1])
    expect(Cents.safeParse(value).success).toBe(false);
  const bidder = await createBidder(crypto.randomUUID().replaceAll("-", ""));
  if (bidder.outcome !== "accepted") throw new Error("Expected guest fixture");
  const me = await getMe(bidder.bidder_id);
  if (!me) throw new Error("Missing guest fixture");
  expect(Me.safeParse({ ...me, extra: true }).success).toBe(false);
  expect(Me.safeParse({ ...me, server_now: "yesterday" }).success).toBe(false);
  expect(
    Me.safeParse({
      ...me,
      active_sandbox: {
        sandbox_id: crypto.randomUUID(),
        auction_id: crypto.randomUUID(),
        expires_at: me.server_now,
        status: "live",
        ends_at: me.server_now,
        extra: true,
      },
    }).success,
  ).toBe(false);
  await expect(
    sql`select ${"9007199254740992"}::bigint as value`,
  ).rejects.toThrow("int8 out of safe range");
});
