import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";
import { z } from "zod";
import { Id, Me, SandboxBots } from "../../src/domain/schemas";
import { test, expect, headers } from "./fixtures";
test("TC-201 E2E-01 cookie Origin validation idempotency and ETag", async ({
  request,
  createAuction,
}) => {
  const id = await createAuction();
  const meResponse = await request.get("/api/me");
  expect(meResponse.status()).toBe(200);
  expect(meResponse.headers()["set-cookie"]).toMatch(/bl_sid=.*HttpOnly/i);
  const url = `/api/auctions/${id}/bids`;
  const key = randomUUID();
  expect(
    (
      await request.post(url, {
        data: { amount: 1000, idempotency_key: key },
        headers: { "idempotency-key": key },
      })
    ).status(),
  ).toBe(403);
  const invalid = await request.post(url, {
    headers: { ...headers, "idempotency-key": key },
    data: { amount: "1000", idempotency_key: key },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: { code: "VALIDATION" } });
  const options = {
    headers: { ...headers, "idempotency-key": key },
    data: { amount: 1000, idempotency_key: key },
  };
  expect((await request.post(url, options)).status()).toBe(201);
  const replay = await request.post(url, options);
  expect(replay.status()).toBe(200);
  expect(replay.headers()["idempotent-replayed"]).toBe("true");
  expect(
    (
      await request.post(url, {
        ...options,
        data: { amount: 1100, idempotency_key: key },
      })
    ).status(),
  ).toBe(422);
  const state = await request.get(`/api/auctions/${id}/state`);
  expect(state.status()).toBe(200);
  const etag = state.headers().etag;
  expect(etag).toBeTruthy();
  expect(
    (
      await request.get(`/api/auctions/${id}/state`, {
        headers: { "if-none-match": etag ?? "" },
      })
    ).status(),
  ).toBe(304);
  expect(
    (
      await request.post("/api/test/clock", { headers, data: { offset_ms: 1 } })
    ).status(),
  ).toBe(404);
});
test("TC-201 E2E-01 signed owner-bound bot token cannot bid on another auction", async ({
  request,
  createAuction,
}) => {
  const owner = Me.parse(await (await request.get("/api/me")).json()).id;
  const db = postgres(
    process.env.DATABASE_URL ??
      "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
    { max: 1 },
  );
  try {
    // T-34 exposes token issuance over HTTP. Use the existing SQL sandbox fixture
    // and the TRD 13.2 signing format to test scope rejection before that route exists.
    const rows =
      await db`select sandbox_id,auction_id from bidlock.create_sandbox(${owner},${randomUUID()},42)`;
    const sandbox = z
      .object({ sandbox_id: Id, auction_id: Id })
      .strict()
      .parse(rows[0]);
    const botsRows =
      await db`select bidlock.sandbox_bots(${owner},${sandbox.sandbox_id}) as result`;
    const bots = SandboxBots.parse(botsRows[0]?.result);
    const bot = bots.bots[0];
    if (!bot) throw new Error("Sandbox must contain three bots");
    const iat = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        sub: bot.id,
        aid: sandbox.auction_id,
        sid: sandbox.sandbox_id,
        own: owner,
        iat,
        exp: iat + 900,
      }),
    ).toString("base64url");
    const signature = createHmac(
      "sha256",
      "e2e-bot-secret-0123456789abcdef01234567",
    )
      .update(`bt1.${payload}`)
      .digest("base64url");
    const response = await request.post(
      `/api/auctions/${await createAuction()}/bids`,
      {
        headers: {
          ...headers,
          authorization: `Bot bt1.${payload}.${signature}`,
          "idempotency-key": randomUUID(),
        },
        data: { amount: 1000, idempotency_key: randomUUID() },
      },
    );
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "BOT_TOKEN_INVALID" },
    });
  } finally {
    await db.end();
  }
});
