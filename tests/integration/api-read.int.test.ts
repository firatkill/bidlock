import { afterAll, expect, test } from "vitest";
import { GET as state } from "@/app/api/auctions/[id]/state/route";
import { GET as bids } from "@/app/api/auctions/[id]/bids/route";
import { GET as lobby } from "@/app/api/auctions/route";
import { AuctionState, AuctionList, BidsPage } from "@/domain/schemas";
import { sql } from "@/server/db";
import { createTestAuction, setTestClock } from "@/server/repo/testSupport";
import { createSandbox } from "@/server/repo/sandboxes";
import { placeBid } from "@/server/repo/bids";
import { signSession } from "@/server/session";
import { makeBidders } from "../fixtures/db";
afterAll(async () => {
  await sql.end();
  globalThis.__bidlockSql = undefined;
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function request(
  path: string,
  who?: string,
  extra: Record<string, string> = {},
) {
  return new Request("http://localhost:3000/api/" + path, {
    headers: {
      ...(who ? { cookie: `bl_sid=${signSession(who)}` } : {}),
      ...extra,
    },
  });
}
async function owner() {
  const who = (await makeBidders(1))[0];
  if (!who) throw new Error("Missing fixture bidder");
  return who;
}
test("TC-150: state ETag saves body but still executes lazy transitions", async () => {
  const id = await createTestAuction({ snipe_window_s: 0 });
  const first = await state(request(`auctions/${id}/state`), params(id));
  expect(first.status).toBe(200);
  const value = AuctionState.parse(await first.json());
  const etag = first.headers.get("etag");
  if (!etag) throw new Error("Missing ETag");
  expect(etag).toBe(`W/"${String(value.version)}.0"`);
  const unchanged = await state(
    request(`auctions/${id}/state`, undefined, { "if-none-match": etag }),
    params(id),
  );
  expect(unchanged.status).toBe(304);
  expect(await unchanged.text()).toBe("");
  expect(unchanged.headers.get("cache-control")).toBe("no-store");
  try {
    await setTestClock(Date.parse(value.ends_at) - Date.now() + 1000);
    const changed = await state(
      request(`auctions/${id}/state`, undefined, { "if-none-match": etag }),
      params(id),
    );
    expect(changed.status).toBe(200);
    expect(AuctionState.parse(await changed.json()).status).toBe("unsold");
    expect(changed.headers.get("etag")).not.toBe(etag);
  } finally {
    await setTestClock(0);
  }
});
test("TC-151: missing and private auctions return 404 to strangers", async () => {
  const who = await owner();
  const sandbox = await createSandbox(
    who,
    crypto.randomUUID().replaceAll("-", ""),
    42,
  );
  if (!sandbox.auction_id) throw new Error("Missing sandbox");
  const id = sandbox.auction_id;
  expect(
    (await state(request(`auctions/${id}/state`), params(id))).status,
  ).toBe(404);
  expect((await bids(request(`auctions/${id}/bids`), params(id))).status).toBe(
    404,
  );
  expect(
    (await state(request(`auctions/${id}/state`, who), params(id))).status,
  ).toBe(200);
  const missing = crypto.randomUUID();
  expect(
    (await state(request(`auctions/${missing}/state`), params(missing))).status,
  ).toBe(404);
});
test("TC-152: bid pagination and exclusive cursor/after", async () => {
  const who = await makeBidders(2);
  const id = await createTestAuction({ snipe_window_s: 0 });
  for (let i = 0; i < 3; i++) {
    const bidder = who[i % 2];
    if (!bidder) throw new Error("Missing fixture");
    expect(
      (await placeBid(id, bidder, 1000 + i * 100, crypto.randomUUID())).outcome,
    ).toBe("accepted");
  }
  const get = (query: string) =>
    bids(request(`auctions/${id}/bids?${query}`), params(id));
  const newest = BidsPage.parse(await (await get("limit=2")).json());
  expect(newest.bids.map((b) => b.bid_no)).toEqual([3, 2]);
  expect(newest.next_cursor).toBe(2);
  const older = BidsPage.parse(await (await get("cursor=2")).json());
  expect(older.bids.map((b) => b.bid_no)).toEqual([1]);
  expect(older.next_cursor).toBeNull();
  expect(
    BidsPage.parse(await (await get("after=1")).json()).bids.map(
      (b) => b.bid_no,
    ),
  ).toEqual([2, 3]);
  expect((await get("after=1&cursor=2")).status).toBe(400);
  expect((await get("extra=1")).status).toBe(400);
});
test("TC-153: lobby returns public state and only the owner sandbox", async () => {
  const who = await owner();
  const sandbox = await createSandbox(
    who,
    crypto.randomUUID().replaceAll("-", ""),
    42,
  );
  const anonymous = AuctionList.parse(
    await (await lobby(request("auctions"))).json(),
  );
  expect(anonymous.public.kind).toBe("public");
  expect(anonymous.sandbox).toBeNull();
  const own = AuctionList.parse(
    await (await lobby(request("auctions", who))).json(),
  );
  expect(own.sandbox?.id).toBe(sandbox.auction_id);
});
