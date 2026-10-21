import { setTimeout as delay } from "node:timers/promises";
import { afterAll, expect, test } from "vitest";
import { z } from "zod";
import {
  adminSql,
  appSql,
  makeAuction,
  makeBidders,
  withNow,
  BidResultRow,
} from "../fixtures/db";
const admin = adminSql();
const app = appSql();
afterAll(async () => {
  await Promise.all([admin.end(), app.end()]);
});
const countRows = z.array(z.object({ n: z.number().int() }).strict()).length(1);
const statusRows = z.array(z.object({ status: z.string() }).strict()).length(1);
const ids = z.array(z.object({ id: z.uuid() }).strict()).length(1);
async function bidder(): Promise<string> {
  const id = (await makeBidders(1))[0];
  if (!id) throw new Error("Missing bidder");
  return id;
}
async function endOf(id: string): Promise<Date> {
  const end = z
    .array(z.object({ ends_at: z.date() }).strict())
    .length(1)
    .parse(
      await admin`select ends_at from bidlock.auctions where id=${id}`,
    )[0]?.ends_at;
  if (!end) throw new Error("Missing end");
  return end;
}
async function bid(
  id: string,
  who: string,
  amount = 1000,
  key = crypto.randomUUID(),
) {
  const row = z
    .array(BidResultRow)
    .length(1)
    .parse(
      await app`select * from bidlock.place_bid(${id},${who},${amount},${key})`,
    )[0];
  if (!row) throw new Error("Missing bid result");
  return row;
}
async function locked(id: string, fn: () => Promise<void>): Promise<void> {
  const locker = adminSql();
  const reserved = await locker.reserve();
  try {
    await reserved`begin`;
    ids.parse(
      await reserved`select id from bidlock.auctions where id=${id} for update`,
    );
    await fn();
  } finally {
    await reserved`rollback`;
    reserved.release();
    await locker.end();
  }
}
test("TC-123 INT-02: scheduler skips locked due auction", async () => {
  const id = await makeAuction({ duration_s: 2, snipe_window_s: 0 });
  const future = new Date((await endOf(id)).getTime() + 1).toISOString();
  await locked(id, async () => {
    const started = performance.now();
    await withNow(admin, future, async (tx) => {
      await tx`select bidlock.close_due_auctions()`;
    });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(
      statusRows.parse(
        await admin`select status from bidlock.auctions where id=${id}`,
      )[0]?.status,
    ).toBe("live");
  });
  await withNow(admin, future, async (tx) => {
    await tx`select bidlock.close_due_auctions()`;
  });
  expect(
    statusRows.parse(
      await admin`select status from bidlock.auctions where id=${id}`,
    )[0]?.status,
  ).toBe("unsold");
});
test("TC-123 INT-02: twenty post-deadline bids close exactly once", async () => {
  const [winner, other] = await makeBidders(2);
  if (!winner || !other) throw new Error("Missing bidders");
  const id = await makeAuction({ duration_s: 2, snipe_window_s: 0 });
  await bid(id, winner);
  await delay(Math.max(0, (await endOf(id)).getTime() + 50 - Date.now()));
  const rows = await Promise.all(
    Array.from({ length: 20 }, () => bid(id, other, 1100)),
  );
  expect(rows.every((r) => r.error_code === "AUCTION_CLOSED")).toBe(true);
  expect(
    countRows.parse(
      await admin`select count(*)::integer as n from bidlock.auction_events where auction_id=${id} and type='auction_closed'`,
    )[0]?.n,
  ).toBe(1);
  expect(
    countRows.parse(
      await admin`select count(*)::integer as n from bidlock.offers where auction_id=${id}`,
    )[0]?.n,
  ).toBe(1);
});
test("TC-123 INT-02: ten identical keys write one bid", async () => {
  const id = await makeAuction();
  const who = await bidder();
  const key = crypto.randomUUID();
  const rows = await Promise.all(
    Array.from({ length: 10 }, () => bid(id, who, 1000, key)),
  );
  expect(rows.filter((r) => r.replayed)).toHaveLength(9);
  expect(rows.every((r) => r.outcome === "accepted")).toBe(true);
  expect(new Set(rows.map((r) => r.bid_id)).size).toBe(1);
  expect(
    countRows.parse(
      await admin`select count(*)::integer as n from bidlock.bids where auction_id=${id}`,
    )[0]?.n,
  ).toBe(1);
});
test("TC-123 INT-02: same key on two auctions processes once", async () => {
  const [a, b] = await Promise.all([makeAuction(), makeAuction()]);
  const who = await bidder();
  const key = crypto.randomUUID();
  const rows = await Promise.all([
    bid(a, who, 1000, key),
    bid(b, who, 1000, key),
  ]);
  expect(rows.filter((r) => r.outcome === "accepted")).toHaveLength(1);
  expect(
    rows.filter((r) => r.error_code === "IDEMPOTENCY_MISMATCH"),
  ).toHaveLength(1);
});
test("TC-123 INT-02: parallel winner payments settle once", async () => {
  const id = await makeAuction({ snipe_window_s: 0 });
  const who = await bidder();
  await bid(id, who);
  const future = new Date((await endOf(id)).getTime() + 1).toISOString();
  await withNow(admin, future, async (tx) => {
    await tx`select bidlock.advance_auction_locked(a,bidlock.bidlock_now()) from bidlock.auctions a where id=${id}`;
  });
  const schema = z
    .array(
      z
        .object({ replayed: z.boolean(), outcome: z.literal("accepted") })
        .strict(),
    )
    .length(1);
  const rows = await Promise.all(
    Array.from({ length: 2 }, () =>
      withNow(
        app,
        future,
        async (tx) =>
          schema.parse(
            await tx`select replayed,outcome from bidlock.pay_offer(${id},${who})`,
          )[0],
      ),
    ),
  );
  expect(rows.map((r) => r?.replayed).sort()).toEqual([false, true]);
  expect(
    countRows.parse(
      await admin`select count(*)::integer as n from bidlock.offers where auction_id=${id} and status='paid'`,
    )[0]?.n,
  ).toBe(1);
});
test("TC-123 INT-02: ten public creators return one auction", async () => {
  const open = z
    .array(z.object({ ends_at: z.date() }).strict())
    .parse(
      await admin`select ends_at from bidlock.auctions where kind='public' and status in ('scheduled','live')`,
    );
  for (const row of open)
    await withNow(
      admin,
      new Date(row.ends_at.getTime() + 1).toISOString(),
      async (tx) => {
        await tx`select bidlock.close_due_auctions()`;
      },
    );
  const rows = await Promise.all(
    Array.from(
      { length: 10 },
      async () =>
        ids.parse(await admin`select bidlock.ensure_public_auction() as id`)[0]
          ?.id,
    ),
  );
  expect(rows.every((id) => typeof id === "string")).toBe(true);
  expect(new Set(rows).size).toBe(1);
  expect(
    countRows.parse(
      await admin`select count(*)::integer as n from bidlock.auctions where kind='public' and status in ('scheduled','live')`,
    )[0]?.n,
  ).toBe(1);
});
test("TC-123 INT-02: five sandbox creators serialize per owner", async () => {
  const who = await bidder();
  const ip = crypto.randomUUID().replaceAll("-", "");
  const schema = z
    .array(
      z
        .object({
          outcome: z.string(),
          error_code: z.string().nullable(),
          sandbox_id: z.uuid(),
        })
        .strict(),
    )
    .length(1);
  const rows = await Promise.all(
    Array.from(
      { length: 5 },
      async () =>
        schema.parse(
          await app`select outcome,error_code,sandbox_id from bidlock.create_sandbox(${who},${ip},42)`,
        )[0],
    ),
  );
  expect(rows.filter((r) => r?.outcome === "accepted")).toHaveLength(1);
  expect(rows.filter((r) => r?.error_code === "SANDBOX_EXISTS")).toHaveLength(
    4,
  );
  expect(new Set(rows.map((r) => r?.sandbox_id)).size).toBe(1);
});
test("TC-123 INT-02: locked due public auction stays visible without waiting", async () => {
  const id = ids.parse(
    await admin`select bidlock.ensure_public_auction() as id`,
  )[0]?.id;
  if (!id) throw new Error("Missing public auction");
  const future = new Date((await endOf(id)).getTime() + 1).toISOString();
  await locked(id, async () => {
    const started = performance.now();
    const seen = await withNow(admin, future, async (tx) => {
      const ensured = ids.parse(
        await tx`select bidlock.ensure_public_auction() as id`,
      )[0]?.id;
      const listed = z
        .array(z.object({ id: z.uuid() }).strict())
        .length(1)
        .parse(
          await tx`select bidlock.list_auctions(null)->'public'->>'id' as id`,
        )[0]?.id;
      return { ensured, listed };
    });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(seen).toEqual({ ensured: id, listed: id });
  });
  await withNow(admin, future, async (tx) => {
    await tx`select bidlock.ensure_public_auction()`;
  });
  expect(
    statusRows.parse(
      await admin`select status from bidlock.auctions where id=${id}`,
    )[0]?.status,
  ).toBe("unsold");
});
