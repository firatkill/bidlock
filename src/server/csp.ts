import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "./env";
export function securityHeaders(): { nonce: string; headers: Headers } {
  const nonce = randomBytes(16).toString("base64");
  const config = env();
  const host = config.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(config.NEXT_PUBLIC_SUPABASE_URL).host
    : undefined;
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${host ? ` https://${host} wss://${host}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  const headers = new Headers({
    "content-security-policy": policy,
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "cross-origin-opener-policy": "same-origin",
  });
  if (config.APP_ENV === "production")
    headers.set(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains",
    );
  return { nonce, headers };
}
