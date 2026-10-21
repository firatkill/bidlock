"use client";
import Link from "next/link";
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
}: {
  initial: AuctionState;
  initialBids: BidItem[];
}) {
  const room = useAuctionRoom(initial.id, initial, initialBids);
  const auction = room.auction ?? initial;
  return (
    <main className="space-y-6">
      <Link href="/" className="text-sm text-ink-2">
        {auction.kind === "sandbox"
          ? copy.sandboxBreadcrumb
          : copy.publicBreadcrumb}
      </Link>
      <ConnectionBanner status={room.status} />
      <div className="grid gap-10 md:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <LotCard auction={auction} />
          <PriceBlock auction={auction} isLeader={room.isLeader} />
          <Countdown auction={auction} clock={room.clock} />
          <ExtensionBanner
            extension={room.lastExtension}
            max={auction.max_extensions}
          />
        </div>
      </div>
    </main>
  );
}
