import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { signBotToken, verifyBotToken } from "@/server/botTokens";
import { resetEnvCacheForTests } from "@/server/env";
import { testEnv } from "../fixtures/env";
const now = 1800000000;
const scope = {
  sub: crypto.randomUUID(),
  aid: crypto.randomUUID(),
  sid: crypto.randomUUID(),
  own: crypto.randomUUID(),
};
const expires = (seconds: number) =>
  new Date((now + seconds) * 1000).toISOString();
beforeEach(() => {
  for (const [key, value] of Object.entries(testEnv)) vi.stubEnv(key, value);
  resetEnvCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
test("TC-211 UT-06: round trip and earlier-of sandbox/15-minute expiry", () => {
  for (const lifetime of [60, 900, 1800]) {
    const token = signBotToken(scope, expires(lifetime), now);
    const exp = now + Math.min(lifetime, 900);
    expect(verifyBotToken(token, scope.aid, scope.own, now)).toEqual({
      v: 1,
      ...scope,
      iat: now,
      exp,
    });
    expect(verifyBotToken(token, scope.aid, scope.own, exp - 1)).not.toBeNull();
    expect(verifyBotToken(token, scope.aid, scope.own, exp)).toBeNull();
  }
});
test("TC-212 UT-06: owner/auction mismatch, tampering and malformed signed claims fail closed", () => {
  const token = signBotToken(scope, expires(900), now);
  expect(verifyBotToken(token, crypto.randomUUID(), scope.own, now)).toBeNull();
  expect(verifyBotToken(token, scope.aid, crypto.randomUUID(), now)).toBeNull();
  expect(verifyBotToken(token, scope.aid, null, now)).toBeNull();
  const raw = (payload: string) =>
    `bt1.${payload}.${createHmac("sha256", testEnv.BOT_TOKEN_SECRET).update(`bt1.${payload}`).digest("base64url")}`;
  const malformed = [
    "not json",
    JSON.stringify({ v: 2, ...scope, iat: now, exp: now + 900 }),
    JSON.stringify({ v: 1, ...scope, iat: now, exp: now + 900, extra: true }),
  ].map((s) => raw(Buffer.from(s).toString("base64url")));
  for (const bad of [
    "",
    "bt1",
    token + ".extra",
    token.replace("bt1.", "bt2."),
    token.slice(0, -1),
    token.replace(/.$/, token.endsWith("a") ? "b" : "a"),
    token.replace("bt1.", "bt1.a"),
    ...malformed,
  ]) {
    expect(verifyBotToken(bad, scope.aid, scope.own, now)).toBeNull();
  }
});
