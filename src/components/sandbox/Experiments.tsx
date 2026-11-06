"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, localNow, placeBid } from "@/client/api";
import { newBid, type PendingBid } from "@/client/idempotency";
import {
  bidErrorCopy,
  formatLedgerTime,
  RetryDetails,
  type RejectionContext,
} from "@/domain/bid-feedback";
import { type ClockSync, remainingMs } from "@/domain/clock";
import { experimentCopy as copy, fillCopy, roomCopy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { AuctionState } from "@/domain/schemas";

type Accepted = Awaited<ReturnType<typeof placeBid>>;
type Outcome = {
  id: string | null;
  bidNo?: number;
  text: string;
  error?: ApiError;
  attempt: PendingBid;
  origin: string;
};
type Run = {
  time: string;
  amount: number;
  results: Outcome[];
  sameId: boolean;
  raceExplanation: string | null;
};
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
  onRejected: (
    attempt: PendingBid,
    error: ApiError,
    context?: RejectionContext,
  ) => void;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(localNow);
  const [pending, setPending] = useState<Experiment | null>(null);
  const [outputs, setOutputs] = useState<Partial<Record<Experiment, Run>>>({});
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
    const runTime = formatLedgerTime(new Date().toISOString()).slice(0, 8);
    const runAmount = auction.min_next_bid;
    setOutputs((previous) => {
      const next = { ...previous };
      Reflect.deleteProperty(next, kind);
      return next;
    });
    const send = async (
      attempt: PendingBid,
      origin: string,
    ): Promise<Outcome> => {
      const t0 = localNow();
      try {
        const result = await placeBid(attempt);
        onAccepted(result, t0, localNow());
        return {
          attempt,
          origin,
          bidNo: result.bid.bid_no,
          id: result.bid.id,
          text: fillCopy(copy.accepted, {
            n: result.bid.bid_no,
            id: result.bid.id.slice(0, 8),
          }),
        };
      } catch (reason) {
        if (reason instanceof ApiError) {
          if (reason.status < 500) onRejected(attempt, reason, { origin });
          if (reason.envelope.error.code === "RATE_LIMITED") {
            const rate = RetryDetails.safeParse(reason.envelope.error.details);
            if (rate.success)
              setRetryUntil(localNow() + rate.data.retry_after_ms);
          }
          return {
            attempt,
            origin,
            error: reason,
            id: null,
            text: `${reason.envelope.error.code}\n${bidErrorCopy(reason.envelope.error)}`,
          };
        }
        return { attempt, origin, id: null, text: roomCopy.errors.network };
      }
    };
    try {
      const first = newBid(auction.id, auction.min_next_bid);
      let results: Outcome[];
      if (kind === "race") {
        results = await Promise.all([
          send(first, copy.origins.raceA),
          send(newBid(auction.id, first.amount), copy.origins.raceB),
        ]);
        const accepted = results.find((result) => result.id !== null);
        for (const rejected of results) {
          if (
            rejected.error &&
            rejected.error.status < 500 &&
            accepted?.bidNo !== undefined
          )
            onRejected(rejected.attempt, rejected.error, {
              origin: rejected.origin,
              sameAs: accepted.bidNo,
            });
        }
      } else if (kind === "replay") {
        results = [
          await send(first, copy.origins.replay),
          await send(first, copy.origins.replay),
        ];
      } else results = [await send(first, copy.origins.late)];
      const a = results[0];
      const b = results[1];
      const winner = results.findIndex((result) => result.id !== null);
      const loser = results.findIndex(
        (result) =>
          result.error !== undefined &&
          result.error.status >= 400 &&
          result.error.status < 500,
      );
      const explainRace =
        kind === "race" &&
        results.length === 2 &&
        winner >= 0 &&
        loser >= 0 &&
        winner !== loser;
      setOutputs((previous) => ({
        ...previous,
        [kind]: {
          time: runTime,
          amount: runAmount,
          results,
          sameId: kind === "replay" && a?.id !== null && a?.id === b?.id,
          raceExplanation: explainRace
            ? fillCopy(copy.raceExplanation, {
                winner: winner === 0 ? "A" : "B",
                loser: loser === 0 ? "A" : "B",
              })
            : null,
        },
      }));
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
      {!live && auction.status !== "scheduled" && (
        <p className="text-sm text-strip-muted">{copy.closed}</p>
      )}
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
            {outputs[kind] && (
              <>
                <span className="block">
                  {outputs[kind].time} · {formatCents(outputs[kind].amount)}
                </span>
                {outputs[kind].results.map((result, index) => (
                  <span
                    key={index}
                    className="block"
                    title={result.id ?? undefined}
                  >
                    {result.origin} · {result.text}
                  </span>
                ))}
                {outputs[kind].sameId && (
                  <span className="block">{copy.sameId}</span>
                )}
                {outputs[kind].raceExplanation && (
                  <span className="block">{outputs[kind].raceExplanation}</span>
                )}
              </>
            )}
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
