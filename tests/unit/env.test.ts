import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { env, resetEnvCacheForTests } from "../../src/server/env";
import { demoMode } from "../../src/server/demoMode";
import { testEnv } from "../fixtures/env";
beforeEach(() => {
  for (const [key, value] of Object.entries(testEnv)) vi.stubEnv(key, value);
  vi.stubEnv("SESSION_SECRET_PREVIOUS", "");
  vi.stubEnv("BOT_SEED_OVERRIDE", undefined);
  resetEnvCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
test("TC-003: valid runtime configuration and empty previous secret", () => {
  expect(env().DB_POOL_MAX).toBe(10);
  expect(env().SESSION_SECRET_PREVIOUS).toBeUndefined();
  expect(demoMode()).toBe("on");
});
test.each(["SESSION_SECRET", "BOT_TOKEN_SECRET", "IP_HASH_SALT"])(
  "TC-003: missing or short %s is rejected",
  (key) => {
    vi.stubEnv(key, undefined);
    expect(() => env()).toThrow();
    vi.stubEnv(key, "short");
    expect(() => env()).toThrow();
  },
);
test("TC-003: only PostgreSQL database URLs accepted", () => {
  vi.stubEnv("DATABASE_URL", "https://example.invalid");
  expect(() => env()).toThrow();
});
test.each(["TEST_API_SECRET", "BOT_SEED_OVERRIDE"])(
  "TC-004: production rejects %s",
  (key) => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("TEST_API_SECRET", undefined);
    vi.stubEnv(key, key === "BOT_SEED_OVERRIDE" ? "42" : "test-placeholder");
    expect(() => env()).toThrow();
  },
);
test("TC-004: production without test variables is valid", () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("TEST_API_SECRET", undefined);
  expect(env().APP_ENV).toBe("production");
});
test("TC-005: parses exact origin allowlist and caches until reset", () => {
  vi.stubEnv(
    "APP_ORIGIN",
    "http://localhost:3000, https://preview.example.invalid",
  );
  expect(env().APP_ORIGIN).toEqual([
    "http://localhost:3000",
    "https://preview.example.invalid",
  ]);
  vi.stubEnv("DEMO_MODE", "off");
  expect(demoMode()).toBe("on");
  resetEnvCacheForTests();
  expect(demoMode()).toBe("off");
});
test.each([
  "https://example.invalid/path",
  "https://example.invalid?x=1",
  "not-url",
])("TC-005: rejects invalid origin %s", (value) => {
  vi.stubEnv("APP_ORIGIN", value);
  expect(() => env()).toThrow();
});
test("TC-005: reset is unavailable outside Vitest", () => {
  vi.stubEnv("VITEST", undefined);
  expect(() => {
    resetEnvCacheForTests();
  }).toThrow("test-only");
});
