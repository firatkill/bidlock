"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { localNow } from "@/client/api";
import { useLiveAnnouncer } from "@/client/hooks/useLiveAnnouncer";
import { type ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
import { fillCopy, resultCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { AuctionState } from "@/domain/schemas";

export function ResultPanel({
  auction,
  viewerId,
  clock,
  payment,
}: {
  auction: AuctionState;
  viewerId: string | null;
  clock: ClockSync;
  payment?: React.ReactNode;
}) {
  const [now, setNow] = useState(() => Date.parse(auction.server_now));
  const { assertive, announceEvent } = useLiveAnnouncer();
  const offer = auction.offer;
  const yours = !!viewerId && offer?.bidder_id === viewerId;
  const open = auction.status === "closed" && offer?.status === "open";
  const values = {
    lot: auction.lot_no,
    amount: offer ? formatCents(offer.amount) : "",
    name: offer?.display_name ?? "",
    time: formatCountdown(
      remainingMs(offer?.deadline ?? auction.server_now, now),
    ),
  };
  const heading =
    open && yours
      ? offer.rank === 1
        ? fillCopy(copy.won, values)
        : copy.secondChance
      : "";
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(clock.serverNow(localNow()));
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [clock]);
  useEffect(() => {
    if (heading && offer)
      announceEvent(
        `${auction.id}:${String(offer.rank)}:${offer.opened_at}`,
        heading,
      );
  }, [auction.id, offer, heading, announceEvent]);
  if (auction.status === "live" || auction.status === "scheduled") return null;
  let text = "";
  if (auction.status === "unsold") {
    text =
      auction.payment_state === null
        ? copy.noBids
        : auction.expired_offers.some((expired) => expired.rank === 2)
          ? copy.expiredBoth
          : copy.expiredOnly;
  } else if (auction.status === "settled" && offer) {
    text = fillCopy(
      yours
        ? offer.rank === 1
          ? copy.paid
          : copy.paidRunner
        : offer.rank === 1
          ? copy.sold
          : copy.soldRunner,
      values,
    );
  } else if (open) {
    if (offer.rank === 1)
      text = fillCopy(yours ? copy.payWithin : copy.pending, values);
    else if (yours) text = fillCopy(copy.secondChanceBody, values);
    else if (
      auction.expired_offers.some(
        (expired) => expired.rank === 1 && expired.bidder_id === viewerId,
      )
    )
      text = copy.expiredWinner;
    else text = fillCopy(copy.offered, values);
  }
  return (
    <section className="space-y-4 rounded-md border border-rule p-5">
      <p className="sr-only" aria-live="assertive">
        {assertive}
      </p>
      {heading && <h2 className="text-xl font-medium">{heading}</h2>}
      <p className={auction.status === "settled" ? "text-ok" : "text-ink-2"}>
        {text}
      </p>
      {open && yours && payment}
      {auction.kind === "public" && auction.closed_at && (
        <div className="space-y-2 border-t border-rule pt-4">
          <p>
            {fillCopy(copy.next, {
              time: formatCountdown(
                Math.max(0, Date.parse(auction.closed_at) + 15000 - now),
              ),
            })}
          </p>
          {auction.next_public_auction_id && (
            <Link
              className="text-accent"
              href={`/a/${auction.next_public_auction_id}`}
            >
              {copy.nextLink}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
