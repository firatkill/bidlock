"use client";
import { useEffect, useState } from "react";
import { localNow } from "@/client/api";
import { ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
import { roomCopy as copy } from "@/domain/copy";
import type { AuctionState } from "@/domain/schemas";
export function Countdown({
  auction,
  clock,
}: {
  auction: AuctionState;
  clock: ClockSync;
}) {
  const [now, setNow] = useState(() => Date.parse(auction.server_now));
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(clock.serverNow(localNow()));
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [clock]);
  if (auction.status !== "live" && auction.status !== "scheduled") return null;
  const scheduled = auction.status === "scheduled";
  const left = remainingMs(
    scheduled ? auction.starts_at : auction.ends_at,
    now,
  );
  const capped = auction.extension_count >= auction.max_extensions;
  if (!scheduled && left === 0)
    return (
      <section className="countdown">
        <progress
          aria-hidden="true"
          className="fuse fuse-warn mb-3"
          value={0}
          max={1}
        />
        <p className="countdown-text font-mono text-xl">{copy.closing}</p>
        <p className="mt-2 text-sm text-ink-3">{copy.waiting}</p>
      </section>
    );
  return (
    <section className="countdown">
      <progress
        aria-hidden="true"
        className={`fuse mb-3 ${left <= 60000 ? "fuse-warn" : ""}`}
        max={1}
        value={Math.min(
          1,
          left /
            Math.max(
              1,
              Date.parse(auction.ends_at) - Date.parse(auction.starts_at),
            ),
        )}
      />
      <p
        className={`countdown-text font-mono text-xl ${!scheduled && left <= 60000 ? "text-warn" : "text-ink"}`}
      >
        <span className="countdown-label">
          {(scheduled ? copy.opens : copy.closes).split("{time}")[0]}
        </span>
        <span>{formatCountdown(left)}</span>
      </p>
      {!scheduled && capped && (
        <p className="mt-2 text-sm text-ink-3">{copy.cap}</p>
      )}
      {!scheduled && !capped && left <= auction.snipe_window_s * 1000 && (
        <p className="mt-2 text-sm text-ink-3">{copy.softClose}</p>
      )}
    </section>
  );
}
