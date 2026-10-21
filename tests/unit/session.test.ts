import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  signSession,
  verifySession,
  readSession,
  sessionCookie,
} from "@/server/session";
import { resetEnvCacheForTests } from "@/server/env";
import { testEnv } from "../fixtures/env";
const now = 1800000000,
  day = 86400,
  id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  for (const [k, v] of Object.entries(testEnv)) vi.stubEnv(k, v);
  vi.stubEnv("SESSION_SECRET_PREVIOUS", "");
  resetEnvCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
test("TC-135 UT-05: signed round trip and cookie attributes", () => {
  const value = signSession(id, now);
  expect(verifySession(value, now)).toEqual({
    bidderId: id,
    issuedAt: now,
    renew: false,
  });
  const cookie = sessionCookie(id);
  expect(cookie).toMatch(/^bl_sid=s1\./);
  for (const attr of ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=34560000"])
    expect(cookie).toContain(attr);
  expect(cookie).not.toContain("Secure");
  expect(
    readSession(
      new Request("http://localhost", {
        headers: { cookie: `other=x; ${cookie.split(";")[0] ?? ""}` },
      }),
    )?.bidderId,
  ).toBe(id);
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("TEST_API_SECRET", undefined);
  vi.stubEnv("BOT_SEED_OVERRIDE", undefined);
  resetEnvCacheForTests();
  expect(sessionCookie(id)).toContain("Secure");
});
test("TC-136 UT-05: tampering and malformed fields rejected", () => {
  const good = signSession(id, now);
  const cases = [
    null,
    "",
    good + ".extra",
    good.replace("s1.", "s2."),
    good.replace(id, crypto.randomUUID()),
    good.replace(String(now), String(now - 1)),
    good.slice(0, -1),
    good.replace(/.$/, good.endsWith("a") ? "b" : "a"),
    `s1.${id}.1.5.signature`,
    `s1.${id}.notint.signature`,
  ];
  for (const value of cases) expect(verifySession(value, now)).toBeNull();
});
test("TC-137 UT-05: future and age boundaries", () => {
  expect(verifySession(signSession(id, now + 300), now)).not.toBeNull();
  expect(verifySession(signSession(id, now + 301), now)).toBeNull();
  expect(verifySession(signSession(id, now - 400 * day), now)).not.toBeNull();
  expect(verifySession(signSession(id, now - 400 * day - 1), now)).toBeNull();
});
test("TC-138 UT-05: previous secret and 30-day sliding renewal", () => {
  const previous = "previous-placeholder-session-key-0123456789";
  vi.stubEnv("SESSION_SECRET_PREVIOUS", previous);
  resetEnvCacheForTests();
  const payload = `s1.${id}.${String(now)}`;
  const value =
    payload +
    "." +
    createHmac("sha256", previous).update(payload).digest("base64url");
  expect(verifySession(value, now)?.renew).toBe(true);
  expect(verifySession(signSession(id, now - 30 * day), now)?.renew).toBe(
    false,
  );
  expect(verifySession(signSession(id, now - 30 * day - 1), now)?.renew).toBe(
    true,
  );
});
