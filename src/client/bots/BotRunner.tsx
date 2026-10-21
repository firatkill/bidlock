"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, fetchSnapshot, localNow, request } from "@/client/api";
import {
  AuctionState,
  BidAccepted,
  BotTokens,
  PayAccepted,
} from "@/domain/schemas";
import { sandboxCopy } from "@/domain/copy";
import type { ClockSync } from "@/domain/clock";
import type { Persona } from "./personas";
import { mulberry32 } from "./prng";
import {
  clampWait,
  createMemory,
  decide,
  preparePayment,
  thinkInterval,
  type BotMemory,
} from "./scheduler";
export interface BotView {
  id: string;
  persona: Persona;
  status: BotMemory["status"];
  outAt: number | null;
}
export interface RunnerView {
  bots: BotView[];
  hidden: boolean;
  error: boolean;
}
interface Loop {
  mem: BotMemory;
  token: string;
  rng: () => number;
  timer: ReturnType<typeof setTimeout> | null;
  blockedUntil: number;
  outAt: number | null;
  inFlight: boolean;
  needsRefresh: boolean;
}
interface Options {
  sandboxId: string;
  auctionId: string;
  now: () => number;
  room: () => AuctionState;
  snapshot: (
    snapshot: NonNullable<Awaited<ReturnType<typeof fetchSnapshot>>>,
  ) => void;
  view: (view: RunnerView) => void;
}
/** One lifetime per mounted owner room. Timers never run concurrently for a bot. */
export function startBotLoops(options: Options) {
  const controller = new AbortController();
  const loops: Loop[] = [];
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let visibilityGeneration = 0;
  let resuming = false;
  let stopped = false,
    hidden = document.visibilityState === "hidden",
    error = false,
    expiresAt = Infinity;
  const paused = () => stopped || hidden || resuming;
  const terminal = () => ["settled", "unsold"].includes(options.room().status);
  const publish = () => {
    if (!stopped)
      options.view({
        hidden,
        error,
        bots: loops.map((loop) => ({
          id: loop.mem.id,
          persona: loop.mem.persona,
          status: hidden ? "paused" : loop.mem.status,
          outAt: loop.outAt,
        })),
      });
  };
  const clear = () => {
    if (resumeTimer !== null) clearTimeout(resumeTimer);
    resumeTimer = null;
    for (const loop of loops) {
      if (loop.timer !== null) clearTimeout(loop.timer);
      loop.timer = null;
    }
  };
  const stop = () => {
    stopped = true;
    clear();
    controller.abort();
    document.removeEventListener("visibilitychange", visibility);
  };
  const refresh = async () => {
    const snapshot = await fetchSnapshot(
      options.auctionId,
      null,
      controller.signal,
    );
    if (!stopped && snapshot) options.snapshot(snapshot);
  };
  const schedule = (loop: Loop, ms: number) => {
    if (stopped || hidden || resuming || loop.mem.status === "done") return;
    if (terminal() || options.now() >= expiresAt) {
      stop();
      return;
    }
    loop.timer = setTimeout(() => {
      loop.timer = null;
      void tick(loop);
    }, clampWait(ms));
  };
  const tick = async (loop: Loop) => {
    if (paused() || loop.inFlight) return;
    if (loop.needsRefresh) {
      loop.inFlight = true;
      try {
        await refresh();
        loop.needsRefresh = false;
      } catch {
        schedule(loop, 1000);
        return;
      } finally {
        loop.inFlight = false;
      }
      if (paused()) return;
    }
    const now = options.now();
    if (terminal() || now >= expiresAt) {
      stop();
      return;
    }
    if (now < loop.blockedUntil) {
      schedule(loop, loop.blockedUntil - now);
      return;
    }
    loop.mem = preparePayment(loop.mem, options.room(), now, loop.rng);
    const decision = decide(loop.mem, options.room(), now, loop.rng);
    if (decision.type === "stop") {
      loop.mem.status = "done";
      publish();
      return;
    }
    if (decision.type === "drop") {
      loop.mem.status = "out";
      loop.outAt = options.room().current_price;
      publish();
      schedule(loop, 6000);
      return;
    }
    if (decision.type === "wait") {
      if (loop.mem.status === "bidding") loop.mem.status = "watching";
      publish();
      schedule(loop, decision.ms);
      return;
    }
    loop.inFlight = true;
    if (decision.type === "bid") {
      loop.mem.lastBidAt = now;
      loop.mem.openingBidDone = true;
      loop.mem.status = "bidding";
    }
    publish();
    let next = thinkInterval(loop.mem.persona, options.room(), now, loop.rng);
    try {
      const init = {
        method: "POST",
        headers: { Authorization: `Bot ${loop.token}` },
        signal: controller.signal,
      };
      if (decision.type === "bid") {
        await request(`/api/auctions/${options.auctionId}/bids`, BidAccepted, {
          ...init,
          body: JSON.stringify({
            amount: decision.amount,
            idempotency_key: crypto.randomUUID(),
          }),
        });
      } else {
        await request(`/api/auctions/${options.auctionId}/pay`, PayAccepted, {
          ...init,
          body: "{}",
        });
        loop.mem.status = "done";
      }
      await refresh();
    } catch (failure: unknown) {
      if (failure instanceof ApiError) {
        const { code, details } = failure.envelope.error;
        if (
          code === "RATE_LIMITED" &&
          typeof details?.retry_after_ms === "number"
        ) {
          loop.blockedUntil = options.now() + details.retry_after_ms;
          next = details.retry_after_ms;
        }
        if (code === "BOT_TOKEN_INVALID") {
          error = true;
          loop.mem.status = "done";
        }
        // Refresh stale bids and closure; reevaluation happens on the next tick.
        if (code === "AUCTION_CLOSED") loop.needsRefresh = true;
        if (code === "BID_TOO_LOW" || code === "AUCTION_CLOSED")
          await refresh()
            .then(() => {
              loop.needsRefresh = false;
            })
            .catch(() => undefined);
      }
    } finally {
      loop.inFlight = false;
      publish();
      schedule(loop, next);
    }
  };
  const visibility = () => {
    hidden = document.visibilityState === "hidden";
    const generation = ++visibilityGeneration;
    resuming = !hidden;
    clear();
    publish();
    const resume = async () => {
      try {
        await refresh();
        if (stopped || hidden || generation !== visibilityGeneration) return;
        resuming = false;
        for (const loop of loops) if (!loop.inFlight) schedule(loop, 1000);
      } catch {
        if (!stopped && !hidden && generation === visibilityGeneration)
          resumeTimer = setTimeout(() => {
            void resume();
          }, 1000);
      }
    };
    if (!hidden && !stopped) void resume();
  };
  document.addEventListener("visibilitychange", visibility);
  void request("/api/bot-tokens", BotTokens, {
    method: "POST",
    body: JSON.stringify({ sandbox_id: options.sandboxId }),
    signal: controller.signal,
  })
    .then((tokens) => {
      if (stopped) return;
      expiresAt = Date.parse(tokens.expires_at);
      tokens.bots.forEach((bot, index) => {
        const rng = mulberry32(tokens.bot_seed + index);
        const loop: Loop = {
          mem: createMemory(bot.id, bot.persona, options.room(), rng),
          token: bot.token,
          rng,
          timer: null,
          blockedUntil: 0,
          outAt: null,
          inFlight: false,
          needsRefresh: false,
        };
        loops.push(loop);
        schedule(loop, 1000);
      });
      publish();
    })
    .catch(() => {
      if (!stopped) {
        error = true;
        publish();
      }
    });
  return {
    stop,
    sync: () => {
      if (terminal() || options.now() >= expiresAt) stop();
    },
  };
}
export function BotRunner({
  auction,
  clock,
  onSnapshot,
  children,
}: {
  auction: AuctionState;
  clock: ClockSync;
  onSnapshot: Options["snapshot"];
  children?: (view: RunnerView) => ReactNode;
}) {
  const latest = useRef({ auction, onSnapshot });
  const active = useRef<ReturnType<typeof startBotLoops> | null>(null);
  const [view, setView] = useState<RunnerView>({
    bots: [],
    hidden: false,
    error: false,
  });
  useEffect(() => {
    latest.current = { auction, onSnapshot };
    active.current?.sync();
  }, [auction, onSnapshot]);
  const sandboxId = auction.sandbox?.id;
  useEffect(() => {
    if (!sandboxId) return;
    const runner = startBotLoops({
      sandboxId,
      auctionId: auction.id,
      now: () => clock.serverNow(localNow()),
      room: () => latest.current.auction,
      snapshot: (snapshot) => {
        if (snapshot.state.version >= latest.current.auction.version)
          latest.current.auction = snapshot.state;
        latest.current.onSnapshot(snapshot);
      },
      view: setView,
    });
    active.current = runner;
    return () => {
      runner.stop();
      active.current = null;
    };
  }, [sandboxId, auction.id, clock]);
  return (
    <>
      {view.error && (
        <p role="alert" className="text-sm text-warn">
          {sandboxCopy.tokenError}
        </p>
      )}
      {children?.(view)}
    </>
  );
}
