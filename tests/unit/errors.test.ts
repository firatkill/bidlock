import { expect, test } from "vitest";
import {
  AppError,
  ERROR_STATUS,
  ERROR_COPY_KEY,
  ErrorCode,
} from "../../src/domain/errors";
// Expected mapping is taken from TRD §10.12, not derived from implementation.
const expected = {
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
test("TC-007 / UT-09: documented codes, statuses and copy keys", () => {
  expect(ERROR_STATUS).toEqual(expected);
  expect(ErrorCode.options).toEqual(Object.keys(expected));
  for (const code of ErrorCode.options) {
    const error = new AppError(code, { field: "test" });
    expect(error.status).toBe(expected[code]);
    expect(error.code).toBe(code);
    expect(error.details).toEqual({ field: "test" });
    expect(ERROR_COPY_KEY[code]).toBe(code);
  }
});
