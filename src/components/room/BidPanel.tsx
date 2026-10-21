"use client";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { z } from "zod";
import { ApiError, localNow, placeBid } from "@/client/api";
import { newBid, type PendingBid } from "@/client/idempotency";
import { ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
import { fillCopy, roomCopy as copy } from "@/domain/copy";
import { quickBidAmounts } from "@/domain/increments";
import { formatCents, parseDollarInput } from "@/domain/money";
import { BidRejectionDetails, type AuctionState } from "@/domain/schemas";

type Accepted = Awaited<ReturnType<typeof placeBid>>;
const RetryDetails = z
  .object({ retry_after_ms: z.number().int().nonnegative() })
  .strict();
export function BidPanel({
  auction,
  isLeader,
  readonly = false,
  ready = true,
  clock,
  onAccepted,
}: {
  auction: AuctionState;
  isLeader: boolean;
  readonly?: boolean;
  ready?: boolean;
  clock: ClockSync;
  onAccepted: (result: Accepted, t0: number, t1: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [retry, setRetry] = useState<PendingBid | null>(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState("");
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(localNow);
  const [override, setOverride] = useState<{
    minimum: number;
    version: number;
  } | null>(null);
  const [previousLeader, setPreviousLeader] = useState(isLeader);
  const [outbid, setOutbid] = useState("");
  const busy = useRef(false);
  if (previousLeader !== isLeader) {
    setPreviousLeader(isLeader);
    if (
      previousLeader &&
      !isLeader &&
      auction.leader &&
      auction.current_price !== null
    ) {
      setOutbid(
        fillCopy(copy.outbid, {
          name: auction.leader.display_name,
          amount: formatCents(auction.current_price),
        }),
      );
      setAccepted("");
    } else if (isLeader) setOutbid("");
  }
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(localNow());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const rateSeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const minimum =
    override && auction.version <= override.version
      ? override.minimum
      : auction.min_next_bid;
  const amounts = quickBidAmounts({ ...auction, min_next_bid: minimum });
  const disabled =
    !ready ||
    pending !== null ||
    readonly ||
    isLeader ||
    auction.status !== "live" ||
    rateSeconds > 0;
  const opens = formatCountdown(
    remainingMs(auction.starts_at, clock.serverNow(now)),
  );
  const send = async (attempt: PendingBid, source: string) => {
    if (busy.current || disabled) return;
    busy.current = true;
    setPending(source);
    setError("");
    setAccepted("");
    setOutbid("");
    if (source !== "retry") setRetry(null);
    const t0 = localNow();
    try {
      const result = await placeBid(attempt);
      setRetry(null);
      onAccepted(result, t0, localNow());
      setAccepted(
        fillCopy(copy.accepted, { amount: formatCents(result.bid.amount) }),
      );
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status >= 500)
        setRetry(attempt);
      if (!(reason instanceof ApiError)) {
        setError(copy.errors.network);
        return;
      }
      if (reason.status < 500) setRetry(null);
      const code = reason.envelope.error.code;
      const details = BidRejectionDetails.safeParse(
        reason.envelope.error.details,
      );
      if (code === "RATE_LIMITED") {
        const parsed = RetryDetails.safeParse(reason.envelope.error.details);
        if (parsed.success)
          setRetryUntil(localNow() + parsed.data.retry_after_ms);
      }
      if (
        code === "BID_TOO_LOW" &&
        details.success &&
        details.data.min_next_bid !== null
      ) {
        setOverride({
          minimum: details.data.min_next_bid,
          version: details.data.version ?? auction.version,
        });
      }
      const values = {
        minimum: formatCents(
          details.success && details.data.min_next_bid !== null
            ? details.data.min_next_bid
            : minimum,
        ),
        maximum: formatCents(
          details.success && details.data.max_bid !== null
            ? details.data.max_bid
            : auction.max_bid,
        ),
        time: opens,
      };
      if (code === "RATE_LIMITED") setError("");
      else if (code in copy.errors)
        setError(
          fillCopy(copy.errors[code as keyof typeof copy.errors], values),
        );
      else
        setError(
          reason.status >= 500
            ? copy.errors.network
            : copy.errors.IDEMPOTENCY_MISMATCH,
        );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseDollarInput(custom);
    if (!parsed.ok) {
      setError(
        parsed.reason === "decimals"
          ? copy.errors.decimals
          : copy.errors.VALIDATION,
      );
      return;
    }
    void send(newBid(auction.id, parsed.cents), "custom");
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
        )
      )
        return;
      const index = ["1", "2", "3"].indexOf(event.key);
      const amount = amounts[index];
      if (index < 0 || amount === undefined || disabled) return;
      event.preventDefault();
      void send(newBid(auction.id, amount), String(index));
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
    };
  });
  if (auction.status !== "live" && auction.status !== "scheduled") return null;
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {amounts.map((amount, index) => (
          <button
            key={amount}
            type="button"
            className="button button-primary flex-col px-2"
            disabled={disabled}
            aria-keyshortcuts={String(index + 1)}
            onClick={() => {
              void send(newBid(auction.id, amount), String(index));
            }}
          >
            <span>
              {pending === String(index)
                ? copy.pending
                : fillCopy(copy.bid, { amount: formatCents(amount) })}
            </span>{" "}
            <span className="text-xs">{copy.steps[index]}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="custom-bid" className="block text-sm font-medium">
          {copy.custom}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span aria-hidden="true" className="absolute left-3 top-2">
              $
            </span>
            <input
              id="custom-bid"
              className="field money-field font-mono"
              inputMode="decimal"
              value={custom}
              onChange={(event) => {
                setCustom(event.target.value);
              }}
              placeholder={formatCents(minimum).slice(1)}
              disabled={disabled}
              aria-describedby="bid-help"
            />
          </div>
          <button className="button" type="submit" disabled={disabled}>
            {pending === "custom" ? copy.pending : copy.place}
          </button>
        </div>
        <p id="bid-help" className="text-sm text-ink-3">
          {fillCopy(copy.minimum, { amount: formatCents(minimum) })}
        </p>
      </form>
      {readonly ? (
        <p className="text-sm text-ink-2">{copy.readonly}</p>
      ) : auction.status === "scheduled" ? (
        <p className="text-sm text-ink-2">
          {fillCopy(copy.scheduled, { time: opens })}
        </p>
      ) : isLeader ? (
        <p className="text-sm text-accent">{copy.leadingNote}</p>
      ) : null}
      <div role="status" className="text-accent">
        {accepted}
      </div>
      <div role="alert" className="text-warn">
        {rateSeconds > 0
          ? fillCopy(copy.errors.RATE_LIMITED, { n: rateSeconds })
          : error || outbid}
      </div>
      {retry && (
        <button
          type="button"
          className="button"
          disabled={disabled}
          onClick={() => {
            void send(retry, "retry");
          }}
        >
          {pending === "retry" ? copy.pending : copy.errors.retry}
        </button>
      )}
    </section>
  );
}
