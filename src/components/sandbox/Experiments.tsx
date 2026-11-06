"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, localNow, placeBid } from "@/client/api";
import { newBid, type PendingBid } from "@/client/idempotency";
import { bidErrorCopy, RetryDetails } from "@/domain/bid-feedback";
import { type ClockSync, remainingMs } from "@/domain/clock";
import { experimentCopy as copy, fillCopy, roomCopy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { AuctionState } from "@/domain/schemas";

type Accepted = Awaited<ReturnType<typeof placeBid>>;
type Experiment = "race" | "replay" | "late";
export function Experiments({
  auction,
  clock,
  isLeader,
  readonly,
  onAccepted,
  onRejected,
  onRefresh,
}: {
  auction: AuctionState;
  clock: ClockSync;
  isLeader: boolean;
  readonly: boolean;
  onAccepted: (result: Accepted, t0: number, t1: number) => void;
  onRejected: (attempt: PendingBid, error: ApiError) => void;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(localNow);
  const [pending, setPending] = useState<Experiment | null>(null);
  const [outputs, setOutputs] = useState<Partial<Record<Experiment, string>>>(
    {},
  );
  const [retryUntil, setRetryUntil] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(localNow());
    }, 100);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const seconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const live = auction.status === "live";
  const expired = remainingMs(auction.ends_at, clock.serverNow(now)) === 0;
  const disabled = (kind: Experiment) =>
    readonly ||
    pending !== null ||
    seconds > 0 ||
    !live ||
    (kind === "late" ? !expired : isLeader || expired);
  const run = async (kind: Experiment) => {
    if (busy.current || disabled(kind)) return;
    busy.current = true;
    setPending(kind);
    const send = async (attempt: PendingBid) => {
      const t0 = localNow();
      try {
        const result = await placeBid(attempt);
        onAccepted(result, t0, localNow());
        return {
          id: result.bid.id,
          text: fillCopy(copy.accepted, {
            n: result.bid.bid_no,
            id: result.bid.id,
          }),
        };
      } catch (reason) {
        if (reason instanceof ApiError) {
          if (reason.status < 500) onRejected(attempt, reason);
          if (reason.envelope.error.code === "RATE_LIMITED") {
            const rate = RetryDetails.safeParse(reason.envelope.error.details);
            if (rate.success)
              setRetryUntil(localNow() + rate.data.retry_after_ms);
          }
          return {
            id: null,
            text: `${reason.envelope.error.code}\n${bidErrorCopy(reason.envelope.error)}`,
          };
        }
        return { id: null, text: roomCopy.errors.network };
      }
    };
    try {
      const first = newBid(auction.id, auction.min_next_bid);
      let text: string;
      if (kind === "race") {
        const results = await Promise.all([
          send(first),
          send(newBid(auction.id, first.amount)),
        ]);
        text = results
          .map((result, index) => `${index === 0 ? "A" : "B"}  ${result.text}`)
          .join("\n");
      } else if (kind === "replay") {
        const a = await send(first);
        const b = await send(first);
        text = `${a.text}\n${b.text}${a.id !== null && a.id === b.id ? `\n${copy.sameId}` : ""}`;
      } else text = (await send(first)).text;
      setOutputs((previous) => ({ ...previous, [kind]: text }));
      onRefresh();
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <section
      aria-labelledby="experiments-heading"
      className="space-y-4 rounded-md bg-strip-ground p-5 text-strip-ink"
    >
      <h2
        id="experiments-heading"
        className="font-mono text-xs uppercase tracking-widest text-strip-muted"
      >
        {copy.title}
      </h2>
      <p className="text-xl font-medium">{copy.heading}</p>
      <p className="text-sm text-strip-muted">{copy.body}</p>
      {(["race", "replay", "late"] as const).map((kind) => (
        <div key={kind} className="space-y-3 border-t border-strip-rule pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">{copy[kind].title}</h3>
              <p className="text-xs text-strip-muted">
                {fillCopy(copy[kind].body, {
                  amount: formatCents(auction.min_next_bid),
                })}
              </p>
            </div>
            <button
              type="button"
              className="button shrink-0 bg-strip-accent text-strip-ground"
              disabled={disabled(kind)}
              onClick={() => {
                void run(kind);
              }}
            >
              {pending === kind ? roomCopy.pending : copy[kind].button}
            </button>
          </div>
          {kind === "race" && isLeader && (
            <p className="text-sm text-strip-muted">{copy.leading}</p>
          )}
          <output
            className="block whitespace-pre-wrap break-all font-mono text-xs"
            aria-live="polite"
          >
            {outputs[kind]}
          </output>
        </div>
      ))}
      {seconds > 0 && (
        <p role="alert">
          {fillCopy(roomCopy.errors.RATE_LIMITED, { n: seconds })}
        </p>
      )}
    </section>
  );
}
