import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { route, json } from "@/server/http";
import { AppError } from "@/domain/errors";
import { ErrorBody, IdParams } from "@/domain/schemas";
import { resetEnvCacheForTests } from "@/server/env";
import { testEnv } from "../fixtures/env";
vi.mock("@/server/repo/me", () => ({ getMe: vi.fn() }));
import { getMe } from "@/server/repo/me";
import { signSession } from "@/server/session";

const Ok = z.object({ ok: z.literal(true) }).strict();
const handler = vi.fn(() => Promise.resolve(json(Ok, { ok: true })));
const body = z.object({ text: z.string() }).strict();
const options = {
  name: "fixture",
  auth: "none",
  mutating: true,
  body,
} as const;
let lines: string[] = [];
beforeEach(() => {
  for (const [key, value] of Object.entries(testEnv)) vi.stubEnv(key, value);
  vi.stubEnv("LOG_LEVEL", "info");
  resetEnvCacheForTests();
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  handler.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
function request(
  content = '{"text":"hello"}',
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost:3000/api/fixture", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: content,
  });
}
async function errorCode(response: Response) {
  return ErrorBody.parse(await response.json()).error.code;
}
test.each(["off", "readonly"] as const)(
  "TC-129 UT-13: %s gate precedes Origin and body parsing",
  async (mode) => {
    vi.stubEnv("DEMO_MODE", mode);
    resetEnvCacheForTests();
    const response = await route(
      options,
      handler,
    )(request("not json", { origin: "https://foreign.invalid" }));
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe(
      mode === "off" ? "DEMO_OFF" : "DEMO_READONLY",
    );
    expect(handler).not.toHaveBeenCalled();
  },
);
test("TC-129 UT-13: health bypasses off and reads bypass readonly", async () => {
  vi.stubEnv("DEMO_MODE", "off");
  resetEnvCacheForTests();
  expect(
    (
      await route(
        { name: "health", auth: "none", mutating: false },
        handler,
      )(new Request("http://localhost:3000/api/health"))
    ).status,
  ).toBe(200);
  vi.stubEnv("DEMO_MODE", "readonly");
  resetEnvCacheForTests();
  expect(
    (await route({ ...options, mutating: false }, handler)(request())).status,
  ).toBe(200);
});
test.each([null, "null", "https://foreign.invalid"])(
  "TC-130 UT-13: rejects Origin %s",
  async (origin) => {
    const req = request();
    if (origin === null) req.headers.delete("origin");
    else req.headers.set("origin", origin);
    const response = await route(options, handler)(req);
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("FORBIDDEN_ORIGIN");
    expect(handler).not.toHaveBeenCalled();
  },
);
test("TC-130 UT-13: accepts configured normalized origin", async () => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000/");
  resetEnvCacheForTests();
  expect((await route(options, handler)(request())).status).toBe(200);
});
test.each([
  ["wrong media type", '{"text":"ok"}', { "content-type": "text/plain" }, 415],
  ["declared bytes", '{"text":"ok"}', { "content-length": "4097" }, 413],
  ["actual bytes", JSON.stringify({ text: "é".repeat(2100) }), {}, 413],
  ["invalid JSON", "{", {}, 400],
  ["extra key", '{"text":"ok","extra":1}', {}, 400],
] as const)("TC-131 UT-13: %s", async (_title, content, headers, status) => {
  const response = await route(options, handler)(request(content, headers));
  expect(response.status).toBe(status);
  expect(await errorCode(response)).toBe("VALIDATION");
  expect(handler).not.toHaveBeenCalled();
});
test("TC-131 UT-13: accepts exactly 4096 UTF-8 bytes", async () => {
  const content = JSON.stringify({ text: "x".repeat(4085) });
  expect(new TextEncoder().encode(content)).toHaveLength(4096);
  expect((await route(options, handler)(request(content))).status).toBe(200);
});
test("TC-132 UT-13: strict params and query validation", async () => {
  const wrapped = route(
    {
      ...options,
      params: IdParams,
      query: z.object({ limit: z.coerce.number().int().positive() }).strict(),
    },
    handler,
  );
  const invalid = await wrapped(request(), {
    params: Promise.resolve({ id: "bad" }),
  });
  expect(invalid.status).toBe(400);
  expect(ErrorBody.parse(await invalid.json()).error.details).toHaveProperty(
    "issues",
  );
  const req = new Request(
    "http://localhost:3000/api/fixture?limit=1&extra=2",
    request(),
  );
  expect(
    (
      await wrapped(req, {
        params: Promise.resolve({ id: crypto.randomUUID() }),
      })
    ).status,
  ).toBe(400);
  expect(handler).not.toHaveBeenCalled();
});
test("TC-133 UT-13: request id, headers and one structured log", async () => {
  const id = crypto.randomUUID();
  const response = await route(
    options,
    handler,
  )(request(undefined, { "x-request-id": id }));
  expect(response.headers.get("x-request-id")).toBe(id);
  expect(response.headers.get("content-type")).toBe(
    "application/json; charset=utf-8",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  const records = lines.map((line) =>
    z
      .object({
        ts: z.string(),
        level: z.string(),
        msg: z.string(),
        request_id: z.uuid(),
        route: z.string(),
        method: z.string(),
        status: z.number(),
        duration_ms: z.number().nonnegative(),
      })
      .strict()
      .parse(JSON.parse(line)),
  );
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    msg: "request",
    request_id: id,
    route: "fixture",
    method: "POST",
    status: 200,
  });
  const generated = await route(
    options,
    handler,
  )(request(undefined, { "x-request-id": "invalid" }));
  expect(
    z.uuid().safeParse(generated.headers.get("x-request-id")).success,
  ).toBe(true);
});
test("TC-134 UT-13: known and unexpected errors use envelope without leaking stack", async () => {
  const known = await route(options, () =>
    Promise.reject(new AppError("BID_TOO_LOW", { min_next_bid: 1100 })),
  )(request());
  expect(known.status).toBe(409);
  expect(ErrorBody.parse(await known.json()).error.details).toEqual({
    min_next_bid: 1100,
  });
  const failure = Object.assign(new Error("private database detail"), {
    code: "BLK10",
  });
  const unknown = await route(options, () => Promise.reject(failure))(
    request(),
  );
  expect(unknown.status).toBe(500);
  const text = await unknown.text();
  expect(text).not.toContain("private database detail");
  expect(text).not.toContain("stack");
  expect(ErrorBody.parse(JSON.parse(text)).error.code).toBe("INTERNAL");
  const errors = lines
    .map((line) => z.record(z.string(), z.unknown()).parse(JSON.parse(line)))
    .filter((line) => line.msg === "request_error");
  expect(errors[0]?.sqlstate).toBe("BLK10");
  expect(lines.filter((line) => line.includes('"msg":"request"'))).toHaveLength(
    2,
  );
});

test("TC-134 UT-13: output schema failures are internal errors", async () => {
  const response = await route(options, () =>
    Promise.resolve(json(Ok, { ok: false } as unknown as z.input<typeof Ok>)),
  )(request());
  expect(response.status).toBe(500);
  expect(await errorCode(response)).toBe("INTERNAL");
});

test("TC-168: session auth requires valid signature and existing guest", async () => {
  const id = crypto.randomUUID();
  const me = {
    id,
    display_name: "Fixture",
    payment_strikes: 0,
    active_sandbox: null,
    open_offers: [],
    server_now: new Date().toISOString(),
  };
  vi.mocked(getMe).mockResolvedValue(me);
  const seen = z.object({ bidder: z.uuid().nullable() }).strict();
  const secured = route(
    { name: "auth", auth: "session", mutating: false },
    (ctx) => Promise.resolve(json(seen, { bidder: ctx.bidderId })),
  );
  const req = (cookie?: string) =>
    new Request("http://localhost:3000/api/auth", {
      headers: cookie ? { cookie } : {},
    });
  expect((await secured(req())).status).toBe(401);
  expect((await secured(req(`bl_sid=${signSession(id)}x`))).status).toBe(401);
  expect(
    await (await secured(req(`bl_sid=${signSession(id)}`))).json(),
  ).toEqual({ bidder: id });
  vi.mocked(getMe).mockResolvedValue(null);
  expect((await secured(req(`bl_sid=${signSession(id)}`))).status).toBe(401);
  const optional = route(
    { name: "auth", auth: "optional-session", mutating: false },
    (ctx) => Promise.resolve(json(seen, { bidder: ctx.bidderId })),
  );
  expect(await (await optional(req("bl_sid=bad"))).json()).toEqual({
    bidder: null,
  });
  const bot = route(
    { name: "auth", auth: "session-or-bot", mutating: false },
    handler,
  );
  expect(
    await errorCode(
      await bot(
        new Request("http://localhost:3000/api/auth", {
          headers: { authorization: "Bot invalid" },
        }),
      ),
    ),
  ).toBe("BOT_TOKEN_INVALID");
});
