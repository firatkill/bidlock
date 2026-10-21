import { z } from "zod";
import { afterAll, expect, test, vi } from "vitest";
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
test("TC-159: missing session and invalid bot token fail closed", async () => {
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

// T-34: contracts from TRD 10.8–10.9 / 13.2, rules remain in SQL.
import { POST as create } from "@/app/api/sandboxes/route";
import { POST as issue } from "@/app/api/bot-tokens/route";
import { SandboxCreated, BotTokens } from "@/domain/schemas";
import { createSandbox } from "@/server/repo/sandboxes";
import { verifyBotToken } from "@/server/botTokens";
import { resetEnvCacheForTests } from "@/server/env";
import { ipHash } from "@/server/ip";
function sandboxRequest(endpoint: string, owner: string | null, body: unknown) {
  return request("unused", owner, body, {}, endpoint);
}
async function sandboxFixture() {
  const [owner, stranger] = await makeBidders(2);
  if (!owner || !stranger) throw new Error("Missing bidders");
  const result = await createSandbox(
    owner,
    crypto.randomUUID().replaceAll("-", ""),
    42,
  );
  const room = SandboxCreated.parse({
    sandbox_id: result.sandbox_id,
    auction_id: result.auction_id,
    expires_at: result.expires_at,
    bot_seed: result.bot_seed,
  });
  const response = await issue(
    sandboxRequest("bot-tokens", owner, { sandbox_id: room.sandbox_id }),
  );
  expect(response.status).toBe(200);
  return {
    owner,
    stranger,
    room,
    tokens: BotTokens.parse(await response.json()),
  };
}
test("TC-213: sandbox creation returns test seed and existing sandbox details", async () => {
  const [owner] = await makeBidders(1);
  if (!owner) throw new Error("Missing owner");
  vi.stubEnv("BOT_SEED_OVERRIDE", "42");
  resetEnvCacheForTests();
  try {
    const response = await create(sandboxRequest("sandboxes", owner, {}));
    expect(response.status).toBe(201);
    const room = SandboxCreated.parse(await response.json());
    expect(room.bot_seed).toBe(42);
    const existing = await create(sandboxRequest("sandboxes", owner, {}));
    expect(existing.status).toBe(409);
    expect(await error(existing)).toMatchObject({
      code: "SANDBOX_EXISTS",
      details: room,
    });
    expect(
      (await create(sandboxRequest("sandboxes", owner, { unknown: true })))
        .status,
    ).toBe(400);
    expect((await create(sandboxRequest("sandboxes", null, {}))).status).toBe(
      401,
    );
  } finally {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  }
});
test("TC-214: sandbox capacity and IP limit map to specified HTTP errors", async () => {
  const [owner] = await makeBidders(1);
  if (!owner) throw new Error("Missing owner");
  const settings = z
    .tuple([z.object({ max_active_sandboxes: z.number().int() }).strict()])
    .parse(await admin`select max_active_sandboxes from bidlock.settings`);
  const bucket = "sandbox_ip_3600s:" + ipHash("local");
  const counters =
    await admin`select bucket,window_start,hits from bidlock.rate_counters where bucket=${bucket}`;
  try {
    await admin`delete from bidlock.rate_counters where bucket=${bucket}`;
    await admin`update bidlock.settings set max_active_sandboxes=0`;
    const capacity = await create(sandboxRequest("sandboxes", owner, {}));
    expect(capacity.status).toBe(503);
    expect((await error(capacity)).code).toBe("SANDBOX_CAPACITY");
    await admin`delete from bidlock.rate_counters where bucket=${bucket}`;
    await admin`insert into bidlock.rate_counters(bucket,window_start,hits) select ${bucket},date_trunc('hour',bidlock.bidlock_now())+n*interval '1 hour',max_hits from bidlock.rate_limits cross join generate_series(0,1) n where name='sandbox_ip_3600s'`;
    const limited = await create(sandboxRequest("sandboxes", owner, {}));
    expect(limited.status).toBe(429);
    expect((await error(limited)).code).toBe("RATE_LIMITED");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      await admin`select id from bidlock.sandboxes where owner_id=${owner}`,
    ).toHaveLength(0);
  } finally {
    await admin`update bidlock.settings set max_active_sandboxes=${settings[0].max_active_sandboxes}`;
    await admin`delete from bidlock.rate_counters where bucket=${bucket}`;
    if (counters.length)
      await admin`insert into bidlock.rate_counters ${admin(counters, "bucket", "window_start", "hits")}`;
  }
});
test("TC-215: token issuer requires owner and live sandbox TTL", async () => {
  const { owner, stranger, room, tokens } = await sandboxFixture();
  expect(tokens.bot_seed).toBe(42);
  expect(tokens.auction_id).toBe(room.auction_id);
  expect(Date.parse(tokens.expires_at)).toBe(Date.parse(room.expires_at));
  expect(tokens.bots.map((b) => b.persona)).toEqual([
    "cautious",
    "steady",
    "sniper",
  ]);
  for (const bot of tokens.bots)
    expect(verifyBotToken(bot.token, room.auction_id, owner)).toMatchObject({
      sub: bot.id,
      sid: room.sandbox_id,
      own: owner,
    });
  for (const [who, sandbox_id] of [
    [stranger, room.sandbox_id],
    [owner, crypto.randomUUID()],
  ] as const) {
    expect(
      (await issue(sandboxRequest("bot-tokens", who, { sandbox_id }))).status,
    ).toBe(404);
  }
  try {
    await setTestClock(Date.parse(room.expires_at) - Date.now() + 1000);
    expect(
      (
        await issue(
          sandboxRequest("bot-tokens", owner, { sandbox_id: room.sandbox_id }),
        )
      ).status,
    ).toBe(404);
  } finally {
    await setTestClock(0);
  }
});
test("TC-216: bot bids use bot identity and require matching auction and owner cookie", async () => {
  const { owner, stranger, room, tokens } = await sandboxFixture();
  const bot = tokens.bots[0];
  if (!bot) throw new Error("Missing bot");
  const body = () => ({ amount: 2000, idempotency_key: crypto.randomUUID() });
  const accepted = await bid(
    request(room.auction_id, owner, body(), {
      authorization: `Bot ${bot.token}`,
    }),
    params(room.auction_id),
  );
  expect(accepted.status).toBe(201);
  expect((await auctionState(room.auction_id, owner))?.leader?.id).toBe(bot.id);
  for (const [id, who, token] of [
    [crypto.randomUUID(), owner, bot.token],
    [room.auction_id, null, bot.token],
    [room.auction_id, stranger, bot.token],
    [room.auction_id, owner, bot.token + "x"],
  ] as const) {
    const rejected = await bid(
      request(id, who, body(), { authorization: `Bot ${token}` }),
      params(id),
    );
    expect(rejected.status).toBe(401);
    expect((await error(rejected)).code).toBe("BOT_TOKEN_INVALID");
  }
  expect((await auctionState(room.auction_id, owner))?.bid_count).toBe(1);
});
test("TC-217: bot winner pays through owner-bound token", async () => {
  const { owner, stranger, room, tokens } = await sandboxFixture();
  const bot = tokens.bots[0];
  if (!bot) throw new Error("Missing bot");
  const auth = { authorization: `Bot ${bot.token}` };
  expect(
    (
      await bid(
        request(
          room.auction_id,
          owner,
          { amount: 2000, idempotency_key: crypto.randomUUID() },
          auth,
        ),
        params(room.auction_id),
      )
    ).status,
  ).toBe(201);
  const state = await auctionState(room.auction_id, owner);
  if (!state) throw new Error("Missing room");
  try {
    await setTestClock(Date.parse(state.ends_at) - Date.now() + 1000);
    const denied = await pay(
      request(room.auction_id, stranger, {}, auth, "pay"),
      params(room.auction_id),
    );
    expect((await error(denied)).code).toBe("BOT_TOKEN_INVALID");
    const paid = await pay(
      request(room.auction_id, owner, {}, auth, "pay"),
      params(room.auction_id),
    );
    expect(paid.status).toBe(200);
    expect(PayAccepted.parse(await paid.json()).replayed).toBe(false);
    expect((await auctionState(room.auction_id, owner))?.status).toBe(
      "settled",
    );
  } finally {
    await setTestClock(0);
  }
});
