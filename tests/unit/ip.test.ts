import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getClientIp, ipHash } from "@/server/ip";
import { resetEnvCacheForTests } from "@/server/env";
import { AppError } from "@/domain/errors";
import { ErrorBody } from "@/domain/schemas";
import { route } from "@/server/http";
import { testEnv } from "../fixtures/env";
vi.mock("@/server/repo/me", () => ({ getMe: vi.fn() }));
beforeEach(() => {
  for (const [k, v] of Object.entries(testEnv)) vi.stubEnv(k, v);
  resetEnvCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
// RFC 5737 / RFC 3849 documentation addresses, never real visitor addresses.
function request(value?: string) {
  return new Request("http://localhost/api/fixture", {
    headers: value ? { "x-forwarded-for": value } : {},
  });
}
test("TC-147 UT-10: proxy trust and first trimmed XFF", () => {
  expect(getClientIp(request(" 192.0.2.4, 192.0.2.5"))).toBe("local");
  vi.stubEnv("TRUST_PROXY", "vercel");
  resetEnvCacheForTests();
  expect(getClientIp(request(" 192.0.2.4, 192.0.2.5"))).toBe("192.0.2.4");
  expect(getClientIp(request())).toBe("local");
});
test("TC-148 UT-10: IPv6 addresses share only their /64 prefix", () => {
  vi.stubEnv("TRUST_PROXY", "vercel");
  resetEnvCacheForTests();
  const hash = (ip: string) => ipHash(getClientIp(request(ip)));
  expect(hash("2001:db8:1:2::1")).toBe(
    hash("2001:0db8:0001:0002:abcd:ef01:2345:6789"),
  );
  expect(hash("2001:db8:1:2::1")).not.toBe(hash("2001:db8:1:3::1"));
  expect(getClientIp(request("2001:db8::1"))).toBe("2001:0db8:0000:0000::");
  expect(hash("192.0.2.1")).not.toBe(hash("192.0.2.2"));
});
test("TC-149 UT-10: stable salted 32-character hash", () => {
  const hash = ipHash("local");
  expect(hash).toMatch(/^[0-9a-f]{32}$/);
  expect(ipHash("local")).toBe(hash);
  vi.stubEnv("IP_HASH_SALT", "another-placeholder-salt");
  resetEnvCacheForTests();
  expect(ipHash("local")).not.toBe(hash);
});
test.each([
  [1, "1"],
  [1000, "1"],
  [1001, "2"],
] as const)(
  "TC-169: %i milliseconds produces Retry-After %s",
  async (ms, seconds) => {
    const handler = route(
      { name: "rate.fixture", auth: "none", mutating: false },
      () =>
        Promise.reject(new AppError("RATE_LIMITED", { retry_after_ms: ms })),
    );
    const response = await handler(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(seconds);
    expect(
      ErrorBody.parse(await response.json()).error.details?.retry_after_ms,
    ).toBe(ms);
  },
);
