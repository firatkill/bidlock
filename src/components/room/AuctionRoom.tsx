"use client";
import Link from "next/link";
import {
  bidErrorCopy,
  type RejectionContext,
  type RejectedBid,
} from "@/domain/bid-feedback";
import { ApiError } from "@/client/api";
import type { PendingBid } from "@/client/idempotency";
import { Experiments } from "@/components/sandbox/Experiments";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BotStrip, SandboxHeader } from "./BotStrip";
const BotRunner = lazy(() =>
  import("@/client/bots/BotRunner").then((module) => ({
    default: module.BotRunner,
  })),
);
import { useLiveAnnouncer } from "@/client/hooks/useLiveAnnouncer";
import type { placeBid } from "@/client/api";
import { formatCents } from "@/domain/money";
import { fillCopy } from "@/domain/copy";
import { PayButton } from "./PayButton";
import { ResultPanel } from "./ResultPanel";
import { refreshMe } from "@/client/hooks/useMe";
import { BidHistory } from "./BidHistory";
import { BidPanel } from "./BidPanel";
import { useAuctionRoom } from "@/client/hooks/useAuctionRoom";
import { roomCopy as copy } from "@/domain/copy";
import type { AuctionState, BidItem } from "@/domain/schemas";
import { LotCard } from "./LotCard";
import { PriceBlock } from "./PriceBlock";
import { Countdown } from "./Countdown";
import { ExtensionBanner } from "./ExtensionBanner";
import { ConnectionBanner } from "./ConnectionBanner";
export function AuctionRoom({
  initial,
  initialBids,
  readonly = false,
}: {
  initial: AuctionState;
  initialBids: BidItem[];
  readonly?: boolean;
}) {
  const [rejected, setRejected] = useState<RejectedBid[]>([]);
  const newestBid = useRef(initial.bid_count);
  const reject = (
    attempt: PendingBid,
    error: ApiError,
    context: RejectionContext = {},
  ) => {
    const anchor = newestBid.current;
    setRejected((rows) =>
      [
        {
          ...context,
          anchor: rows.find((row) => row.key === attempt.key)?.anchor ?? anchor,
          key: attempt.key,
          amount: attempt.amount,
          explanation: bidErrorCopy(error.envelope.error),
        },
        ...rows.filter((row) => row.key !== attempt.key),
      ].slice(0, 100),
    );
  };
  const room = useAuctionRoom(initial.id, initial, initialBids);
  const auction = room.auction ?? initial;
  useEffect(() => {
    newestBid.current = Math.max(newestBid.current, auction.bid_count);
  }, [auction.bid_count]);
  useEffect(() => {
    if (auction.status !== "live" && auction.status !== "scheduled")
      void refreshMe().catch(() => {});
  }, [auction.id, auction.status, auction.payment_state]);
  const { polite, announcePrice } = useLiveAnnouncer();
  useEffect(() => {
    if (auction.leader && auction.current_price !== null)
      announcePrice(
        fillCopy(copy.announcePrice, {
          price: formatCents(auction.current_price),
          name: auction.leader.display_name,
        }),
      );
  }, [auction.current_price, auction.leader, announcePrice]);
  const accepted = (
    result: Awaited<ReturnType<typeof placeBid>>,
    t0: number,
    t1: number,
  ) => {
    newestBid.current = Math.max(newestBid.current, result.bid.bid_no);
    room.clock.addSample(t0, t1, result.server_now);
    if (!room.me) return;
    const bid = {
      ...result.bid,
      bidder_id: result.auction.leader_bidder_id,
      display_name: room.me.display_name,
      is_bot: false,
      extended: result.auction.extended,
    };
    room.apply({
      kind: "change",
      receivedAt: t1,
      change: {
        v: 1,
        auction_id: auction.id,
        version: result.auction.version,
        status: result.auction.status,
        payment_state: auction.payment_state,
        current_price: result.auction.current_price,
        leader: {
          id: result.auction.leader_bidder_id,
          display_name: room.me.display_name,
          is_bot: false,
        },
        bid_count: Math.max(auction.bid_count, bid.bid_no),
        ends_at: result.auction.ends_at,
        extension_count: result.auction.extension_count,
        bid,
        sent_at: result.server_now,
      },
    });
    room.apply({ kind: "bids", bids: [bid] });
  };

  return (
    <main
      className={`space-y-5 ${auction.status === "live" || auction.status === "scheduled" ? "room-bidding" : ""}`}
    >
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-ink-2"
      >
        {auction.kind === "sandbox"
          ? copy.sandboxBreadcrumb
          : copy.publicBreadcrumb}
      </Link>
      <ExtensionBanner
        extension={room.lastExtension}
        max={auction.max_extensions}
      />
      <ConnectionBanner status={room.status} />
      <p className="sr-only" aria-live="polite">
        {polite}
      </p>
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-5">
          <LotCard auction={auction} />
          {(auction.status === "live" || auction.status === "scheduled") && (
            <div className="space-y-5 rounded-md border border-rule bg-surface p-4 md:p-6">
              <div className="price-countdown">
                <PriceBlock auction={auction} isLeader={room.isLeader} />
                <Countdown auction={auction} clock={room.clock} />
              </div>
              <BidPanel
                auction={auction}
                isLeader={room.isLeader}
                readonly={readonly}
                ready={room.me !== null}
                clock={room.clock}
                onAccepted={accepted}
                onRejected={reject}
              />
            </div>
          )}
          {auction.sandbox && room.me?.id === auction.sandbox.owner_id && (
            <>
              <SandboxHeader
                expiresAt={auction.sandbox.expires_at}
                serverNow={auction.server_now}
                clock={room.clock}
              />
              {readonly ? (
                <BotStrip
                  paused
                  view={{ bots: [], hidden: false, error: false }}
                />
              ) : (
                <Suspense
                  fallback={
                    <BotStrip
                      view={{ bots: [], hidden: false, error: false }}
                    />
                  }
                >
                  <BotRunner
                    auction={auction}
                    clock={room.clock}
                    onSnapshot={(snapshot) => {
                      room.apply({ kind: "snapshot", ...snapshot });
                    }}
                  >
                    {(view) => <BotStrip view={view} />}
                  </BotRunner>
                </Suspense>
              )}
            </>
          )}
          <ResultPanel
            auction={auction}
            bids={room.bids}
            viewerId={room.me?.id ?? null}
            clock={room.clock}
            payment={
              <PayButton
                key={`${auction.id}:${String(auction.offer?.rank)}`}
                auctionId={auction.id}
                readonly={readonly}
                onRefresh={room.refresh}
              />
            }
          />
        </div>
        <div className="min-w-0 space-y-6">
          {auction.sandbox && room.me?.id === auction.sandbox.owner_id && (
            <Experiments
              auction={auction}
              clock={room.clock}
              isLeader={room.isLeader}
              readonly={readonly}
              onAccepted={accepted}
              onRejected={reject}
              onRefresh={room.refresh}
            />
          )}
          <BidHistory
            auctionId={auction.id}
            rejected={rejected}
            bids={room.bids}
            viewerId={room.me?.id ?? null}
            extendBySeconds={auction.extend_by_s}
            onBids={(bids) => {
              room.apply({ kind: "bids", bids });
            }}
          />
        </div>
      </div>
    </main>
  );
}
