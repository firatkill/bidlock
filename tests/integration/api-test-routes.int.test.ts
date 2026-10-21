import { afterAll, afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  POST as clock,
  DELETE as resetClock,
} from "@/app/api/test/clock/route";
import { POST as auction } from "@/app/api/test/auctions/route";
import { POST as unknownRoute } from "@/app/api/[...path]/route";
import { GET as health } from "@/app/api/health/route";
import { serverNow } from "@/server/repo/testSupport";
import * as healthDb from "@/server/health";
import { resetEnvCacheForTests } from "@/server/env";
import { sql } from "@/server/db";
import { ErrorBody, Id, Iso } from "@/domain/schemas";
import { testEnv } from "../fixtures/env";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEnvCacheForTests();
});
afterAll(async () => {
  await sql.end();
  globalThis.__bidlockSql = undefined;
});
function request(
  path: string,
  body?: unknown,
  secret: string = testEnv.TEST_API_SECRET,
  method = "POST",
) {
  return new Request(`http://localhost:3000/api/${path}`, {
    method,
    headers: { "x-test-secret": secret, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
for (const mode of ["on", "readonly", "off"] as const) {
  for (const scenario of ["development", "wrong-secret"] as const) {
    test(`TC-160: ${scenario} test route matches unknown route in ${mode}`, async () => {
      vi.stubEnv(
        "APP_ENV",
        scenario === "development" ? "development" : "test",
      );
      vi.stubEnv("DEMO_MODE", mode);
      resetEnvCacheForTests();
      const secret =
        scenario === "development" ? testEnv.TEST_API_SECRET : "wrong-secret";
      const actual = await clock(
        request("test/clock", { offset_ms: 0 }, secret),
      );
      const missing = unknownRoute(request("does-not-exist", {}));
      expect(actual.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(actual.headers.get("content-type")).toBe(
        missing.headers.get("content-type"),
      );
      const a = ErrorBody.parse(await actual.json()),
        b = ErrorBody.parse(await missing.json());
      expect(a.error).toEqual(b.error);
      expect(a.error.code).toBe("NOT_FOUND");
    });
  }
}
test("TC-161: authorized test support creates auctions and validates clock/body ranges", async () => {
  const created = await auction(request("test/auctions", {}));
  expect(created.status).toBe(201);
  z.object({ auction_id: Id })
    .strict()
    .parse(await created.json());
  try {
    const before = Date.parse(await serverNow());
    const changed = await clock(request("test/clock", { offset_ms: 60_000 }));
    expect(changed.status).toBe(200);
    const now = z
      .object({ server_now: Iso })
      .strict()
      .parse(await changed.json());
    expect(Date.parse(now.server_now)).toBeGreaterThanOrEqual(before + 60_000);
    expect(Date.parse(now.server_now)).toBeLessThanOrEqual(
      Date.parse(await serverNow()),
    );
    for (const body of [
      { offset_ms: 86_400_001 },
      { offset_ms: -86_400_001 },
      { offset_ms: 0, extra: true },
    ])
      expect((await clock(request("test/clock", body))).status).toBe(400);
    for (const body of [
      { duration_s: 4 },
      { snipe_window_s: 30, extend_by_s: 10 },
      { extra: true },
    ])
      expect((await auction(request("test/auctions", body))).status).toBe(400);
  } finally {
    const reset = await resetClock(
      request("test/clock", undefined, testEnv.TEST_API_SECRET, "DELETE"),
    );
    expect(reset.status).toBe(200);
    const now = z
      .object({ server_now: Iso })
      .strict()
      .parse(await reset.json());
    expect(Math.abs(Date.parse(now.server_now) - Date.now())).toBeLessThan(
      3000,
    );
  }
});
test("TC-162: health bypasses off mode and reports database success or failure", async () => {
  vi.stubEnv("DEMO_MODE", "off");
  vi.stubEnv("GIT_SHA", "test-version");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", undefined);
  resetEnvCacheForTests();
  const schema = z
    .object({
      status: z.enum(["ok", "degraded"]),
      db: z.enum(["ok", "error"]),
      demo_mode: z.literal("off"),
      version: z.literal("test-version"),
      server_now: Iso,
    })
    .strict();
  const good = await health(
    request("health?db=1", undefined, testEnv.TEST_API_SECRET, "GET"),
  );
  expect(good.status).toBe(200);
  expect(good.headers.get("cache-control")).toBe("no-store");
  expect(schema.parse(await good.json())).toMatchObject({
    status: "ok",
    db: "ok",
  });
  vi.spyOn(healthDb, "healthTime").mockRejectedValueOnce(
    new Error("Injected database outage"),
  );
  const before = Date.now();
  const bad = await health(
    request("health", undefined, testEnv.TEST_API_SECRET, "GET"),
  );
  expect(bad.status).toBe(503);
  expect(bad.headers.get("cache-control")).toBe("no-store");
  const result = schema.parse(await bad.json());
  expect(result).toMatchObject({ status: "degraded", db: "error" });
  expect(Date.parse(result.server_now)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(result.server_now)).toBeLessThanOrEqual(Date.now());
});
