import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  unstable_doesMiddlewareMatch,
  getRewrittenUrl,
  isRewrite,
} from "next/experimental/testing/server";
import { securityHeaders } from "@/server/csp";
import { resetEnvCacheForTests } from "@/server/env";
import { proxy, config } from "@/proxy";
import { testEnv } from "../fixtures/env";
beforeEach(() => {
  for (const [key, value] of Object.entries(testEnv)) vi.stubEnv(key, value);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("TEST_API_SECRET", undefined);
  vi.stubEnv("BOT_SEED_OVERRIDE", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  resetEnvCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
test("TC-164: UT-14 production nonce and security headers match the contract", () => {
  const { nonce, headers } = securityHeaders();
  expect(Buffer.from(nonce, "base64")).toHaveLength(16);
  expect(securityHeaders().nonce).not.toBe(nonce);
  expect(headers.get("content-security-policy")?.split("; ")).toEqual([
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ]);
  expect(headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(headers.get("x-content-type-options")).toBe("nosniff");
  expect(headers.get("permissions-policy")).toBe(
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
  expect(headers.get("strict-transport-security")).toBe(
    "max-age=63072000; includeSubDomains",
  );
});
test("TC-164: UT-14 development eval and optional Supabase connection hosts", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  resetEnvCacheForTests();
  const { headers } = securityHeaders();
  expect(headers.get("content-security-policy")).toContain("'unsafe-eval'");
  expect(headers.get("content-security-policy")).toContain(
    "connect-src 'self' https://project.supabase.co wss://project.supabase.co",
  );
  expect(headers.has("strict-transport-security")).toBe(false);
});
test("TC-165: UT-14 forwards the same CSP and nonce to Next rendering", () => {
  const response = proxy(
    new NextRequest("http://localhost:3000/", {
      headers: {
        "x-nonce": "untrusted",
        "content-security-policy": "untrusted",
      },
    }),
  );
  const csp = response.headers.get("content-security-policy");
  const nonce = response.headers.get("x-middleware-request-x-nonce");
  expect(nonce).toBeTruthy();
  expect(nonce).not.toBe("untrusted");
  expect(csp).toContain(`'nonce-${String(nonce)}'`);
  expect(
    response.headers.get("x-middleware-request-content-security-policy"),
  ).toBe(csp);
  expect(response.headers.get("x-middleware-override-headers")).toContain(
    "content-security-policy",
  );
});
test("TC-166: UT-14 off mode rewrites pages while excluding API and assets", () => {
  vi.stubEnv("DEMO_MODE", "off");
  resetEnvCacheForTests();
  const response = proxy(new NextRequest("http://localhost:3000/a/example"));
  expect(getRewrittenUrl(response)).toBe("http://localhost:3000/offline");
  expect(response.headers.get("content-security-policy")).toBe(
    response.headers.get("x-middleware-request-content-security-policy"),
  );
  expect(
    isRewrite(proxy(new NextRequest("http://localhost:3000/offline"))),
  ).toBe(false);
  for (const url of [
    "/api/health",
    "/api/test/clock",
    "/api",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
  ])
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      false,
    );
  for (const url of ["/", "/a/example", "/offline"])
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      true,
    );
});
