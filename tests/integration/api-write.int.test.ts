import { afterAll, expect, test } from "vitest";
import { POST as bid } from "@/app/api/auctions/[id]/bids/route";
import { POST as pay } from "@/app/api/auctions/[id]/pay/route";
import {
  BidAccepted,
  BidRejectionDetails,
  ErrorBody,
  PayAccepted,
} from "@/domain/schemas";
import { createTestAuction, setTestClock } from "@/server/repo/testSupport";
import { auctionState } from "@/server/repo/auctions";
import { sql } from "@/server/db";
import { signSession } from "@/server/session";
import { adminSql, makeBidders } from "../fixtures/db";
const admin = adminSql();
afterAll(async () => {
  await Promise.all([sql.end(), admin.end()]);
  globalThis.__bidlockSql = undefined;
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function request(
  id: string,
  who: string | null,
  body: unknown,
  headers: Record<string, string> = {},
  endpoint = "bids",
) {
  return new Request(`http://localhost:3000/api/auctions/${id}/${endpoint}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...(who ? { cookie: `bl_sid=${signSession(who)}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
async function fixture() {
  const [one, two] = await makeBidders(2);
  if (!one || !two) throw new Error("Missing bidders");
  return { one, two, id: await createTestAuction({ snipe_window_s: 0 }) };
}
async function error(response: Response) {
  return ErrorBody.parse(await response.json()).error;
}
test("TC-154: accepted bid returns 201 and exact replay returns 200", async () => {
  const { id, one } = await fixture();
  const body = { amount: 1000, idempotency_key: crypto.randomUUID() };
  const first = await bid(request(id, one, body), params(id));
  expect(first.status).toBe(201);
  const accepted = BidAccepted.parse(await first.json());
  expect(accepted.replayed).toBe(false);
  const replay = await bid(request(id, one, body), params(id));
  expect(replay.status).toBe(200);
  expect(replay.headers.get("idempotent-replayed")).toBe("true");
  expect(BidAccepted.parse(await replay.json())).toEqual({
    ...accepted,
    replayed: true,
  });
});
test("TC-155: low/high rejections expose strict SQL details and rejection replay", async () => {
  const { id, one, two } = await fixture();
  await bid(
    request(id, one, { amount: 1000, idempotency_key: crypto.randomUUID() }),
    params(id),
  );
  const body = { amount: 1000, idempotency_key: crypto.randomUUID() };
  const low = await bid(request(id, two, body), params(id));
  expect(low.status).toBe(409);
  const rejected = await error(low);
  expect(rejected.code).toBe("BID_TOO_LOW");
  expect(BidRejectionDetails.parse(rejected.details).min_next_bid).toBe(1100);
  const replay = await bid(request(id, two, body), params(id));
  expect(replay.status).toBe(409);
  expect(
    BidRejectionDetails.parse((await error(replay)).details).replayed,
  ).toBe(true);
  const state = await auctionState(id, two);
  if (!state) throw new Error("Missing fixture");
  const high = await bid(
    request(id, two, {
      amount: state.max_bid + 1,
      idempotency_key: crypto.randomUUID(),
    }),
    params(id),
  );
  expect(high.status).toBe(422);
  expect((await error(high)).code).toBe("BID_TOO_HIGH");
});
test("TC-156: reused key with changed amount returns mismatch", async () => {
  const { id, one } = await fixture();
  const key = crypto.randomUUID();
  await bid(
    request(id, one, { amount: 1000, idempotency_key: key }),
    params(id),
  );
  const mismatch = await bid(
    request(id, one, { amount: 1100, idempotency_key: key }),
    params(id),
  );
  expect(mismatch.status).toBe(422);
  expect((await error(mismatch)).code).toBe("IDEMPOTENCY_MISMATCH");
  expect((await auctionState(id, one))?.bid_count).toBe(1);
});
test("TC-157: bidder rate limit maps to 429 and Retry-After", async () => {
  const { id, one } = await fixture();
  const bucket = "bid_bidder_60s:" + one;
  // Seed both minute buckets to keep this fixture stable across a minute boundary.
  try {
    await admin`insert into bidlock.rate_counters(bucket,window_start,hits) select ${bucket},date_trunc('minute',bidlock.bidlock_now())+n*interval '1 minute',max_hits from bidlock.rate_limits cross join generate_series(0,1) n where name='bid_bidder_60s'`;
    const response = await bid(
      request(id, one, { amount: 1000, idempotency_key: crypto.randomUUID() }),
      params(id),
    );
    expect(response.status).toBe(429);
    expect((await error(response)).code).toBe("RATE_LIMITED");
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await auctionState(id, one))?.bid_count).toBe(0);
  } finally {
    await admin`delete from bidlock.rate_counters where bucket=${bucket}`;
  }
});
test("TC-158: winner payment settles and replays; non-payable returns 409", async () => {
  const { id, one, two } = await fixture();
  const live = await pay(request(id, one, {}, {}, "pay"), params(id));
  expect(live.status).toBe(409);
  expect((await error(live)).code).toBe("NOT_PAYABLE");
  await bid(
    request(id, one, { amount: 1000, idempotency_key: crypto.randomUUID() }),
    params(id),
  );
  const state = await auctionState(id, one);
  if (!state) throw new Error("Missing fixture");
  try {
    await setTestClock(Date.parse(state.ends_at) - Date.now() + 1000);
    const wrong = await pay(request(id, two, {}, {}, "pay"), params(id));
    expect(wrong.status).toBe(409);
    const paid = await pay(request(id, one, {}, {}, "pay"), params(id));
    expect(paid.status).toBe(200);
    expect(PayAccepted.parse(await paid.json()).replayed).toBe(false);
    expect(
      PayAccepted.parse(
        await (await pay(request(id, one, {}, {}, "pay"), params(id))).json(),
      ).replayed,
    ).toBe(true);
  } finally {
    await setTestClock(0);
  }
});
test("TC-159: missing session and unsupported bot token fail closed", async () => {
  const { id } = await fixture();
  const body = { amount: 1000, idempotency_key: crypto.randomUUID() };
  const anonymous = await bid(request(id, null, body), params(id));
  expect(anonymous.status).toBe(401);
  expect((await error(anonymous)).code).toBe("NO_SESSION");
  const bot = await bid(
    request(id, null, body, { authorization: "Bot invalid" }),
    params(id),
  );
  expect(bot.status).toBe(401);
  expect((await error(bot)).code).toBe("BOT_TOKEN_INVALID");
});
