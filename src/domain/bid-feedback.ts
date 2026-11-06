import { z } from "zod";
import { fillCopy, roomCopy } from "./copy";
import { formatCents } from "./money";
import { BidRejectionDetails, type ErrorBody } from "./schemas";

export type RejectionContext = { origin?: string; sameAs?: number };
export type RejectedBid = RejectionContext & {
  key: string;
  amount: number;
  explanation: string;
  anchor: number;
};
export const RetryDetails = z
  .object({ retry_after_ms: z.number().int().nonnegative() })
  .strict();
export function bidErrorCopy(error: z.infer<typeof ErrorBody>["error"]) {
  const details = BidRejectionDetails.safeParse(error.details);
  if (error.code === "RATE_LIMITED") {
    const rate = RetryDetails.safeParse(error.details);
    return rate.success
      ? fillCopy(roomCopy.errors.RATE_LIMITED, {
          n: Math.ceil(rate.data.retry_after_ms / 1000),
        })
      : roomCopy.errors.network;
  }
  if (
    error.code === "BID_TOO_LOW" &&
    details.success &&
    details.data.min_next_bid !== null
  )
    return fillCopy(roomCopy.rejectedLow, {
      minimum: formatCents(details.data.min_next_bid),
    });
  if (
    error.code === "BID_TOO_HIGH" &&
    details.success &&
    details.data.max_bid !== null
  )
    return fillCopy(roomCopy.errors.BID_TOO_HIGH, {
      maximum: formatCents(details.data.max_bid),
    });
  const text =
    error.code in roomCopy.errors
      ? roomCopy.errors[error.code as keyof typeof roomCopy.errors]
      : undefined;
  return text && !text.includes("{") ? text : roomCopy.errors.network;
}
export function formatLedgerTime(iso: string) {
  const date = new Date(iso);
  return `${[date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}
