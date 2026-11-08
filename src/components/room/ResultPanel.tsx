"use client";
import { useTimeZone } from "@/client/hooks/useTimeZone";
import Link from "next/link";
import { useEffect, useState } from "react";
import { localNow } from "@/client/api";
import { useLiveAnnouncer } from "@/client/hooks/useLiveAnnouncer";
import { type ClockSync, formatCountdown, remainingMs } from "@/domain/clock";
import { fillCopy, resultCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import { formatLedgerTime } from "@/domain/bid-feedback";
import type { AuctionState, BidItem } from "@/domain/schemas";

export function ResultPanel({
  auction,
  viewerId,
  clock,
  payment,
  bids = [],
}: {
  auction: AuctionState;
  viewerId: string | null;
  clock: ClockSync;
  payment?: React.ReactNode;
  bids?: BidItem[];
}) {
  const timeZone = useTimeZone();
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
  const winner = bids.find((bid) => bid.bid_no === auction.bid_count);
  const step =
    auction.status === "settled"
      ? 4
      : auction.status === "unsold"
        ? 5
        : auction.payment_state === "awaiting_payment" ||
            auction.payment_state === "offered_to_runner_up"
          ? 3
          : 2;
  return (
    <section className="space-y-5 rounded-md border border-rule bg-surface p-5 md:p-7">
      <p className="sr-only" aria-live="assertive">
        {assertive}
      </p>
      <ol
        aria-label={copy.lifecycle}
        className="flex flex-wrap gap-x-4 gap-y-2 border-b border-rule pb-4 font-mono text-xs text-ink-3"
      >
        {copy.stages.map((label, index) =>
          (index === 4 && step === 5) || (index === 5 && step !== 5) ? null : (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={index === step ? "font-medium text-accent" : ""}
            >
              {label}
            </li>
          ),
        )}
      </ol>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-3">
        {copy.result}
      </p>
      {heading && <h2 className="text-xl font-medium">{heading}</h2>}
      <p className={auction.status === "settled" ? "text-ok" : "text-ink-2"}>
        {text}
      </p>
      {open && yours && payment}
      <dl className="divide-y divide-rule border-y border-rule font-mono text-sm [&>div]:flex [&>div]:flex-wrap [&>div]:justify-between [&>div]:gap-2 [&>div]:py-3 [&_dt]:text-ink-3">
        <div>
          <dt>{copy.lot}</dt>
          <dd>
            {String(auction.lot_no).padStart(4, "0")} · {auction.title}
          </dd>
        </div>
        {winner && (
          <div>
            <dt>{copy.winningBid}</dt>
            <dd>
              #{winner.bid_no} · {formatCents(winner.amount)} ·{" "}
              <time dateTime={winner.placed_at}>
                {formatLedgerTime(winner.placed_at, timeZone)}
              </time>
            </dd>
          </div>
        )}
        {offer?.rank === 2 && (
          <div>
            <dt>{copy.runner}</dt>
            <dd>
              {offer.display_name} · {formatCents(offer.amount)}
            </dd>
          </div>
        )}
        <div>
          <dt>{copy.bids}</dt>
          <dd>{auction.bid_count}</dd>
        </div>
        <div>
          <dt>{copy.extensions}</dt>
          <dd>
            {fillCopy(copy.extensionValue, {
              n: auction.extension_count,
              max: auction.max_extensions,
            })}
          </dd>
        </div>
      </dl>
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
              className="inline-flex min-h-11 items-center text-accent"
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
