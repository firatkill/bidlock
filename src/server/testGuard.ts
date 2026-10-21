import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { notFoundResponse } from "./http";
export function assertTestEnv(
  req: Request,
  requestId: string,
): Response | null {
  if (env().APP_ENV !== "test") return notFoundResponse(requestId);
  const expected = env().TEST_API_SECRET,
    actual = req.headers.get("x-test-secret");
  if (!expected || !actual) return notFoundResponse(requestId);
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b)
    ? null
    : notFoundResponse(requestId);
}
