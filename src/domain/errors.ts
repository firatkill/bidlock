import { z } from "zod";
export const ErrorCode = z.enum([
  "VALIDATION",
  "NO_SESSION",
  "BOT_TOKEN_INVALID",
  "FORBIDDEN_ORIGIN",
  "NOT_FOUND",
  "AUCTION_NOT_LIVE",
  "AUCTION_CLOSED",
  "ALREADY_LEADING",
  "BID_TOO_LOW",
  "BID_TOO_HIGH",
  "IDEMPOTENCY_MISMATCH",
  "NAME_INVALID",
  "NOT_PAYABLE",
  "OFFER_EXPIRED",
  "SANDBOX_EXISTS",
  "SANDBOX_CAPACITY",
  "RATE_LIMITED",
  "BIDDING_PAUSED",
  "DEMO_READONLY",
  "DEMO_OFF",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  NO_SESSION: 401,
  BOT_TOKEN_INVALID: 401,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  AUCTION_NOT_LIVE: 409,
  AUCTION_CLOSED: 409,
  ALREADY_LEADING: 409,
  BID_TOO_LOW: 409,
  BID_TOO_HIGH: 422,
  IDEMPOTENCY_MISMATCH: 422,
  NAME_INVALID: 422,
  NOT_PAYABLE: 409,
  OFFER_EXPIRED: 409,
  SANDBOX_EXISTS: 409,
  SANDBOX_CAPACITY: 503,
  RATE_LIMITED: 429,
  BIDDING_PAUSED: 503,
  DEMO_READONLY: 503,
  DEMO_OFF: 503,
  INTERNAL: 500,
};
/** Stable keys consumed by copy.ts when UI copy is introduced in T-26. */
export const ERROR_COPY_KEY = Object.fromEntries(
  ErrorCode.options.map((code) => [code, code]),
);
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "AppError";
  }
  get status(): number {
    return ERROR_STATUS[this.code];
  }
}
