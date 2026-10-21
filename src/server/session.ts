import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
const DAY = 86400;
function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
export function signSession(
  bidderId: string,
  issuedAt = Math.floor(Date.now() / 1000),
): string {
  const value = `s1.${z.uuid().parse(bidderId)}.${String(z.number().int().nonnegative().parse(issuedAt))}`;
  return `${value}.${signature(value, env().SESSION_SECRET)}`;
}
export function verifySession(
  value: string | null | undefined,
  now = Math.floor(Date.now() / 1000),
) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [prefix, id, iat, sig] = parts;
  if (
    prefix !== "s1" ||
    !z.uuid().safeParse(id).success ||
    !id ||
    !iat ||
    !/^\d+$/.test(iat) ||
    !sig ||
    !/^[A-Za-z0-9_-]{43}$/.test(sig)
  )
    return null;
  const issuedAt = Number(iat);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > now + 300 ||
    now - issuedAt > 400 * DAY
  )
    return null;
  const payload = `s1.${id}.${iat}`;
  const matches = (secret: string) =>
    timingSafeEqual(Buffer.from(sig), Buffer.from(signature(payload, secret)));
  const previous = env().SESSION_SECRET_PREVIOUS;
  let old = false;
  if (!matches(env().SESSION_SECRET)) {
    if (!previous || !matches(previous)) return null;
    old = true;
  }
  return { bidderId: id, issuedAt, renew: old || now - issuedAt > 30 * DAY };
}
export function readSession(req: Request) {
  const value = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("bl_sid="))
    ?.slice(7);
  return verifySession(value);
}
export function sessionCookie(bidderId: string): string {
  return `bl_sid=${signSession(bidderId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000${env().APP_ENV === "production" ? "; Secure" : ""}`;
}
