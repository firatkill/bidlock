import Link from "next/link";
import { fillCopy, lobbyCopy as copy } from "@/domain/copy";
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
      <div>
        <p className="font-mono text-sm text-ink-3">
          {fillCopy(copy.lot, { lot: auction.lot_no })}
        </p>
        <h2 className="mt-2 text-2xl font-medium">{auction.title}</h2>
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
                count: auction.bid_count,
                name: auction.leader?.display_name ?? "",
              },
            )}
      </p>
      <p className="font-mono">
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
