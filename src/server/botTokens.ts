import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";

const Claims = z
  .object({
    v: z.literal(1),
    sub: z.uuid(),
    aid: z.uuid(),
    sid: z.uuid(),
    own: z.uuid(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().nonnegative(),
  })
  .strict();
type Scope = { sub: string; aid: string; sid: string; own: string };
function signature(payload: string) {
  return createHmac("sha256", env().BOT_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
}
export function signBotToken(
  scope: Scope,
  sandboxExpiresAt: string,
  now = Math.floor(Date.now() / 1000),
) {
  const claims = Claims.parse({
    ...scope,
    v: 1,
    iat: now,
    exp: Math.min(now + 900, Math.floor(Date.parse(sandboxExpiresAt) / 1000)),
  });
  const payload = `bt1.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}
export function verifyBotToken(
  token: string,
  auctionId: string,
  ownerId: string | null,
  now = Math.floor(Date.now() / 1000),
) {
  const parts = token.split(".");
  const [prefix, payload, sig] = parts;
  if (
    parts.length !== 3 ||
    prefix !== "bt1" ||
    !payload ||
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !sig ||
    !/^[A-Za-z0-9_-]{43}$/.test(sig)
  )
    return null;
  if (
    !timingSafeEqual(Buffer.from(sig), Buffer.from(signature(`bt1.${payload}`)))
  )
    return null;
  try {
    const claims = Claims.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown,
    );
    if (claims.exp <= now || claims.aid !== auctionId || claims.own !== ownerId)
      return null;
    return claims;
  } catch {
    return null;
  }
}
