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
      <ul className="flex flex-wrap gap-2">
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
              className="rounded-md border border-rule px-3 py-2 text-sm"
            >
              <span>{copy.bots[index]}</span>
              <span className="ml-2 text-ink-3">{status}</span>
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
