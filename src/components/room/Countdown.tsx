"use client";
import { useEffect, useState } from "react";
import { localNow } from "@/client/api";
import { ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
import { fillCopy, roomCopy as copy } from "@/domain/copy";
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
      <section>
        <p className="font-mono text-xl">{copy.closing}</p>
        <p className="mt-2 text-sm text-ink-3">{copy.waiting}</p>
      </section>
    );
  return (
    <section>
      <p
        className={`font-mono text-xl ${!scheduled && left <= 60000 ? "text-warn" : "text-ink"}`}
      >
        {fillCopy(scheduled ? copy.opens : copy.closes, {
          time: formatCountdown(left),
        })}
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
