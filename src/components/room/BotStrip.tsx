"use client";
import { useEffect, useState } from "react";
import { localNow } from "@/client/api";
import type { RunnerView } from "@/client/bots/BotRunner";
import { ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
import { fillCopy, sandboxCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
export function SandboxHeader({
  expiresAt,
  serverNow,
  clock,
}: {
  expiresAt: string;
  serverNow: string;
  clock: ClockSync;
}) {
  const [now, setNow] = useState(() => Date.parse(serverNow));
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(clock.serverNow(localNow()));
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [clock]);
  return (
    <p className="font-mono text-sm text-ink-2">
      {fillCopy(copy.expires, {
        time: formatCountdown(remainingMs(expiresAt, now)),
      })}
    </p>
  );
}
export function BotStrip({
  view,
  paused = false,
}: {
  view: RunnerView;
  paused?: boolean;
}) {
  return (
    <section className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-3">
        {(["cautious", "steady", "sniper"] as const).map((persona, index) => {
          const bot = view.bots.find((item) => item.persona === persona);
          const status =
            paused ||
            view.hidden ||
            view.error ||
            bot?.status === "paused" ||
            bot?.status === "done"
              ? copy.paused
              : bot?.status === "out" && bot.outAt !== null
                ? fillCopy(copy.out, { amount: formatCents(bot.outAt) })
                : bot?.status === "bidding"
                  ? copy.bidding
                  : copy.watching;
          return (
            <li
              key={persona}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule bg-surface px-4 py-3 text-sm"
            >
              <div>
                <p>{copy.bots[index]}</p>
                <p className="mt-1 text-xs text-ink-2">
                  {copy.personalities[index]}
                </p>
              </div>
              <span className="font-mono text-xs text-ink-3">{status}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-3">{copy.note}</p>
      {view.hidden && (
        <p role="status" className="text-sm text-ink-2">
          {copy.hidden}
        </p>
      )}
    </section>
  );
}
