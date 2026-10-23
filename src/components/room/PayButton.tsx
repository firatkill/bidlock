"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, localNow, request } from "@/client/api";
import { refreshMe } from "@/client/hooks/useMe";
import { PayAccepted } from "@/domain/schemas";
import { fillCopy, resultCopy as copy, roomCopy } from "@/domain/copy";
const RetryDetails = z
  .object({ retry_after_ms: z.number().int().nonnegative() })
  .strict();
export function PayButton({
  auctionId,
  readonly = false,
  onRefresh,
}: {
  auctionId: string;
  readonly?: boolean;
  onRefresh: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(localNow);
  const busy = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(localNow());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const seconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const pay = async () => {
    if (busy.current || readonly || seconds > 0) return;
    busy.current = true;
    setPending(true);
    setError("");
    setRetry(false);
    try {
      await refreshMe();
      await request(`/api/auctions/${auctionId}/pay`, PayAccepted, {
        method: "POST",
        body: "{}",
      });
      onRefresh();
      void refreshMe().catch(() => {});
    } catch (reason) {
      const code =
        reason instanceof ApiError ? reason.envelope.error.code : null;
      if (code === "OFFER_EXPIRED" || code === "NOT_PAYABLE") {
        setError(copy[code]);
        onRefresh();
      } else if (code === "RATE_LIMITED" && reason instanceof ApiError) {
        const details = RetryDetails.safeParse(reason.envelope.error.details);
        if (details.success)
          setRetryUntil(localNow() + details.data.retry_after_ms);
        else {
          setError(copy.network);
          setRetry(true);
        }
      } else if (code === "DEMO_READONLY" || code === "BIDDING_PAUSED") {
        setError(roomCopy.errors.BIDDING_PAUSED);
      } else {
        setError(copy.network);
        setRetry(true);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div className="space-y-3">
      <button
        className="button button-primary"
        disabled={pending || readonly || seconds > 0}
        onClick={() => {
          void pay();
        }}
      >
        {pending ? copy.paying : retry ? copy.retry : copy.pay}
      </button>
      <p role="alert" className="text-warn">
        {seconds > 0 ? fillCopy(copy.rateLimited, { n: seconds }) : error}
      </p>
    </div>
  );
}
