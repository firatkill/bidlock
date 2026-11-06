"use client";
import { useState } from "react";
import { bidCountCopy, fillCopy, roomCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { AuctionState } from "@/domain/schemas";
export function PriceBlock({
  auction,
  isLeader = false,
}: {
  auction: AuctionState;
  isLeader?: boolean;
}) {
  const price = auction.current_price ?? auction.starting_price;
  const [previous, setPrevious] = useState(price);
  const [changed, setChanged] = useState(false);
  if (price !== previous) {
    setPrevious(price);
    setChanged(true);
  }
  return (
    <section className="space-y-2">
      <p className="text-sm text-ink-2">
        {auction.current_price === null ? copy.starting : copy.current}
      </p>
      <p
        key={price}
        onAnimationEnd={() => {
          setChanged(false);
        }}
        className={`price break-words ${changed ? "price-flash" : ""}`}
      >
        {formatCents(auction.current_price ?? auction.starting_price)}
      </p>
      <p className={isLeader ? "text-accent" : "text-ink-2"}>
        {auction.current_price === null
          ? copy.firstBid
          : isLeader
            ? copy.leading
            : fillCopy(copy.leader, {
                name: auction.leader?.display_name ?? "",
              })}
        {!isLeader && auction.leader?.is_bot && (
          <span className="ml-2 rounded border border-rule px-1 font-mono text-xs">
            {copy.bot}
          </span>
        )}
      </p>
      <p className="text-sm text-ink-3">
        {fillCopy(copy.meta, {
          bids: bidCountCopy(auction.bid_count),
          minimum: formatCents(auction.min_next_bid),
          increment: formatCents(auction.increment),
        })}
      </p>
    </section>
  );
}
