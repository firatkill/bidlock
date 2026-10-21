"use client";
import Link from "next/link";
import { lazy, Suspense, useEffect } from "react";
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
  const room = useAuctionRoom(initial.id, initial, initialBids);
  const auction = room.auction ?? initial;
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
    <main className="space-y-6">
      <Link href="/" className="text-sm text-ink-2">
        {auction.kind === "sandbox"
          ? copy.sandboxBreadcrumb
          : copy.publicBreadcrumb}
      </Link>
      <ConnectionBanner status={room.status} />
      {auction.sandbox && room.me?.id === auction.sandbox.owner_id && (
        <>
          <SandboxHeader
            expiresAt={auction.sandbox.expires_at}
            serverNow={auction.server_now}
            clock={room.clock}
          />
          {readonly ? (
            <BotStrip paused view={{ bots: [], hidden: false, error: false }} />
          ) : (
            <Suspense
              fallback={
                <BotStrip view={{ bots: [], hidden: false, error: false }} />
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
      <p className="sr-only" aria-live="polite">
        {polite}
      </p>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <LotCard auction={auction} />
          <PriceBlock auction={auction} isLeader={room.isLeader} />
          <Countdown auction={auction} clock={room.clock} />
          <BidPanel
            auction={auction}
            isLeader={room.isLeader}
            readonly={readonly}
            ready={room.me !== null}
            clock={room.clock}
            onAccepted={accepted}
          />
          <ExtensionBanner
            extension={room.lastExtension}
            max={auction.max_extensions}
          />
        </div>
        <BidHistory
          auctionId={auction.id}
          bids={room.bids}
          viewerId={room.me?.id ?? null}
          extendBySeconds={auction.extend_by_s}
          onBids={(bids) => {
            room.apply({ kind: "bids", bids });
          }}
        />
      </div>
    </main>
  );
}
