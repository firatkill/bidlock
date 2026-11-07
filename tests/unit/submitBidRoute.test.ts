import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { testEnv } from "../fixtures/env";
import { resetEnvCacheForTests } from "@/server/env";
import { signSession } from "@/server/session";
import { signBotToken } from "@/server/botTokens";
import { ErrorBody } from "@/domain/schemas";
import { POST } from "@/app/api/auctions/[id]/bids/route";
const query = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(),
);
vi.mock("@/server/db", () => ({ sql: query }));
const owner = "00000000-0000-4000-8000-000000000001";
const bot = "00000000-0000-4000-8000-000000000002";
const auction = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  for (const [k, v] of Object.entries(testEnv)) vi.stubEnv(k, v);
  resetEnvCacheForTests();
  query.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
function request(token?: string) {
  return new Request(`http://localhost:3000/api/auctions/${auction}/bids`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      cookie: `bl_sid=${signSession(owner)}`,
      ...(token ? { authorization: `Bot ${token}` } : {}),
    },
    body: JSON.stringify({
      amount: 1000,
      idempotency_key: crypto.randomUUID(),
    }),
  });
}
test.each(["test", "production"])(
  "TC-279: %s bid makes exactly one SQL call and maps rate details",
  async (mode) => {
    vi.stubEnv("APP_ENV", mode);
    if (mode === "production") vi.stubEnv("TEST_API_SECRET", undefined);
    resetEnvCacheForTests();
    query.mockResolvedValue([
      {
        result: {
          kind: "error",
          error_code: "RATE_LIMITED",
          retry_after_ms: 1500,
        },
      },
    ]);
    const r = await POST(request(), {
      params: Promise.resolve({ id: auction }),
    });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("2");
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).toContain("bidlock.submit_bid");
    expect(query.mock.calls[0]?.slice(1, 4)).toEqual([owner, null, auction]);
  },
);
test("TC-279: signed bot keeps owner identity for SQL existence validation", async () => {
  const token = signBotToken(
    { sub: bot, aid: auction, sid: crypto.randomUUID(), own: owner },
    new Date(Date.now() + 600000).toISOString(),
  );
  query.mockResolvedValue([
    {
      result: {
        kind: "error",
        error_code: "BOT_TOKEN_INVALID",
        retry_after_ms: null,
      },
    },
  ]);
  const r = await POST(request(token), {
    params: Promise.resolve({ id: auction }),
  });
  expect(ErrorBody.parse(await r.json()).error.code).toBe("BOT_TOKEN_INVALID");
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0]?.slice(1, 4)).toEqual([owner, bot, auction]);
});
test("TC-279: invalid bot signature makes no database call", async () => {
  const r = await POST(request("invalid"), {
    params: Promise.resolve({ id: auction }),
  });
  expect(ErrorBody.parse(await r.json()).error.code).toBe("BOT_TOKEN_INVALID");
  expect(query).not.toHaveBeenCalled();
});
