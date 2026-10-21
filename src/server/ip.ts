import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { env } from "./env";
export function getClientIp(req: Request): string {
  const ip =
    env().TRUST_PROXY === "vercel"
      ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
      : "local";
  if (isIP(ip) !== 6) return ip;
  // URL canonicalizes embedded IPv4 and expanded IPv6 before /64 reduction.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const before = left ? left.split(":") : [];
  const after = right ? right.split(":") : [];
  const groups = canonical.includes("::")
    ? [
        ...before,
        ...Array<string>(8 - before.length - after.length).fill("0"),
        ...after,
      ]
    : before;
  return (
    groups
      .slice(0, 4)
      .map((group) => group.padStart(4, "0"))
      .join(":") + "::"
  );
}
export function ipHash(ip: string): string {
  return createHmac("sha256", env().IP_HASH_SALT)
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}
