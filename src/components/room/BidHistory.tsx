"use client";
import { useState } from "react";
import { fetchOlderBids } from "@/client/api";
import { formatCountdown } from "@/domain/clock";
import { fillCopy, roomCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { BidItem } from "@/domain/schemas";
export function BidHistory({
  auctionId,
  bids,
  viewerId,
  extendBySeconds,
  onBids,
}: {
  auctionId: string;
  bids: BidItem[];
  viewerId: string | null;
  extendBySeconds: number;
  onBids: (bids: BidItem[]) => void;
}) {
  const [visible, setVisible] = useState(20);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const rows = bids.slice(0, visible);
  const oldest = rows.at(-1)?.bid_no ?? 1;
  const earlier = async () => {
    if (loading) return;
    if (bids.length > visible) {
      setVisible(Math.min(100, visible + 20));
      return;
    }
    setLoading(true);
    try {
      const page = await fetchOlderBids(auctionId, oldest);
      onBids(page.bids);
      setVisible(Math.min(100, visible + 20));
      setExhausted(page.next_cursor === null);
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="min-w-0 space-y-4" aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-xl font-medium">
        {copy.history}
      </h2>
      {rows.length === 0 ? (
        <p className="text-ink-3">{copy.noBids}</p>
      ) : (
        <ol className="divide-y divide-rule border-y border-rule">
          {rows.map((bid) => (
            <li
              key={bid.bid_no}
              className="price-flash grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 py-4 text-sm"
            >
              <span className="font-mono text-ink-3">
                {fillCopy(copy.bidNumber, { n: bid.bid_no })}
              </span>
              <span className="min-w-0 break-words">
                {bid.display_name}{" "}
                {bid.bidder_id === viewerId && (
                  <span className="text-accent">{copy.you}</span>
                )}{" "}
                {bid.is_bot && (
                  <span className="rounded border border-rule px-1 font-mono text-xs">
                    {copy.bot}
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums">
                {formatCents(bid.amount)}
              </span>
              <time
                dateTime={bid.placed_at}
                className="col-start-2 font-mono text-xs text-ink-3"
                suppressHydrationWarning
              >
                {new Date(bid.placed_at).toLocaleTimeString(undefined, {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
              {bid.extended && (
                <span
                  className="text-right font-mono text-xs text-ink-3"
                  title={copy.extendedTitle}
                >
                  {fillCopy(copy.extensionTag, {
                    time: formatCountdown(extendBySeconds * 1000),
                  })}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {oldest > 1 &&
        rows.length < 100 &&
        (!exhausted || bids.length > visible) && (
          <button
            className="button"
            disabled={loading}
            onClick={() => {
              void earlier().catch(() => {});
            }}
          >
            {loading ? copy.loading : copy.earlier}
          </button>
        )}
    </section>
  );
}
