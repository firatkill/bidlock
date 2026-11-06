import Link from "next/link";
import { bidCountCopy, fillCopy, lobbyCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import { formatCountdown, remainingMs } from "@/domain/clock";
import type { AuctionState } from "@/domain/schemas";
export function PublicRoomCard({
  auction,
  now,
  viewerId,
  error = false,
}: {
  auction: AuctionState | null;
  now: number;
  viewerId: string | null;
  error?: boolean;
}) {
  if (error)
    return (
      <section className="rounded-md border border-rule bg-surface p-6">
        <p role="status">{copy.error}</p>
      </section>
    );
  if (!auction)
    return (
      <section className="rounded-md border border-rule bg-surface p-6">
        <p className="font-mono text-sm">{copy.public}</p>
        <p className="sr-only" role="status">
          {copy.loading}
        </p>
        <div aria-hidden="true" className="h-64" />
      </section>
    );
  const scheduled = auction.status === "scheduled";
  const left = remainingMs(
    scheduled ? auction.starts_at : auction.ends_at,
    now,
  );
  return (
    <section className="flex flex-col gap-4 rounded-md border border-rule bg-surface p-6">
      <p className="font-mono text-xs tracking-wide text-ink-3">
        {scheduled ? copy.next : copy.live}
      </p>
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-[78px] w-[104px] shrink-0 items-center justify-center rounded border border-rule-strong bg-ground font-mono text-3xl text-ink-2"
        >
          {String(auction.lot_no).padStart(4, "0")}
        </div>
        <div>
          <p className="font-mono text-sm text-ink-3">
            {fillCopy(copy.lot, {
              lot: String(auction.lot_no).padStart(4, "0"),
            })}
          </p>
          <h2 className="mt-2 text-2xl font-medium">{auction.title}</h2>
        </div>
      </div>
      <div>
        <p className="text-sm text-ink-2">
          {auction.current_price === null ? copy.starting : copy.current}
        </p>
        <p className="price mt-1">
          {formatCents(auction.current_price ?? auction.starting_price)}
        </p>
      </div>
      <p className="text-sm text-ink-2">
        {auction.bid_count === 0
          ? copy.noBids
          : fillCopy(
              auction.leader?.id === viewerId ? copy.leading : copy.leader,
              {
                bids: bidCountCopy(auction.bid_count),
                name: auction.leader?.display_name ?? "",
              },
            )}
      </p>
      <progress
        aria-hidden="true"
        max={1}
        value={Math.min(
          1,
          left /
            Math.max(
              1,
              Date.parse(auction.ends_at) - Date.parse(auction.starts_at),
            ),
        )}
        className={`fuse ${left <= 60000 ? "fuse-warn" : ""}`}
      />
      <p
        className={`font-mono ${!scheduled && left <= 60000 ? "text-warn" : ""}`}
      >
        {left === 0 && !scheduled
          ? copy.closing
          : fillCopy(scheduled ? copy.opens : copy.closes, {
              time: formatCountdown(left),
            })}
      </p>
      <Link
        className="button button-primary mt-auto self-start"
        href={`/a/${auction.id}`}
      >
        {copy.enter}
      </Link>
    </section>
  );
}
