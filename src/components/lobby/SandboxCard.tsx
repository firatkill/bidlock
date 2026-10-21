"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, request } from "@/client/api";
import { SandboxCreated } from "@/domain/schemas";
import Link from "next/link";
import { fillCopy, sandboxCopy as copy, lobbyCopy } from "@/domain/copy";
import { formatCountdown, remainingMs } from "@/domain/clock";
import type { AuctionState } from "@/domain/schemas";
export type SandboxCardState =
  "default" | "creating" | "capacity" | "rate" | "readonly" | "error";
export function SandboxCard({
  auction = null,
  now,
  state = "default",
  retryMinutes = 1,
  onStart,
  disabled = false,
}: {
  auction?: AuctionState | null;
  now: number;
  state?: SandboxCardState;
  retryMinutes?: number;
  onStart?: () => void;
  disabled?: boolean;
}) {
  const left = auction ? remainingMs(auction.ends_at, now) : 0;
  const status =
    auction?.status === "live"
      ? left > 0
        ? fillCopy(lobbyCopy.closes, { time: formatCountdown(left) })
        : lobbyCopy.closing
      : auction?.status === "closed"
        ? copy.payment
        : copy.finished;
  return (
    <section className="flex flex-col gap-4 rounded-md border border-rule bg-surface p-6">
      <h2 className="text-2xl font-medium">
        {auction ? copy.active : copy.title}
      </h2>
      <p className="text-ink-2">
        {auction
          ? fillCopy(copy.lotStatus, { lot: auction.lot_no, status })
          : copy.body}
      </p>
      {auction ? (
        <Link className="button mt-auto self-start" href={`/a/${auction.id}`}>
          {copy.return}
        </Link>
      ) : (
        <button
          className="button mt-auto self-start"
          onClick={onStart}
          disabled={
            disabled || !onStart || state === "creating" || state === "readonly"
          }
        >
          {state === "creating" ? copy.starting : copy.start}
        </button>
      )}
      {state === "capacity" && (
        <p role="status" className="text-sm text-ink-2">
          {copy.capacity}
        </p>
      )}
      {state === "rate" && (
        <p role="status" className="text-sm text-ink-2">
          {fillCopy(copy.rate, { n: retryMinutes })}
        </p>
      )}
      {state === "readonly" && (
        <p className="text-sm text-ink-2">{copy.readonly}</p>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-warn">
          {copy.error}
        </p>
      )}
    </section>
  );
}

/** Creation stays separate from the read-only active card and its feed. */
export function SandboxStart({
  now,
  readonly = false,
}: {
  now: number;
  readonly?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<SandboxCardState>("default");
  const [retryMinutes, setRetryMinutes] = useState(1);
  const [cooldown, setCooldown] = useState(false);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const start = async () => {
    if (inFlight.current || readonly || cooldown) return;
    inFlight.current = true;
    setState("creating");
    try {
      const created = await request("/api/sandboxes", SandboxCreated, {
        method: "POST",
        body: "{}",
      });
      router.push(`/a/${created.auction_id}`);
    } catch (failure: unknown) {
      if (failure instanceof ApiError) {
        const { code, details } = failure.envelope.error;
        if (code === "SANDBOX_EXISTS") {
          const existing = SandboxCreated.safeParse(details);
          if (existing.success) {
            router.push(`/a/${existing.data.auction_id}`);
            return;
          }
        }
        if (code === "SANDBOX_CAPACITY") {
          setState("capacity");
          setCooldown(true);
          timer.current = setTimeout(() => {
            setCooldown(false);
          }, 30000);
          return;
        }
        if (
          code === "RATE_LIMITED" &&
          typeof details?.retry_after_ms === "number"
        ) {
          setState("rate");
          setRetryMinutes(Math.ceil(details.retry_after_ms / 60000));
          return;
        }
      }
      setState("error");
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <SandboxCard
      now={now}
      state={readonly ? "readonly" : state}
      retryMinutes={retryMinutes}
      disabled={cooldown}
      onStart={() => {
        void start();
      }}
    />
  );
}
