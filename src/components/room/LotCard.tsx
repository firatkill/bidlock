import { fillCopy, roomCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { AuctionState } from "@/domain/schemas";
export function LotCard({ auction }: { auction: AuctionState }) {
  return (
    <section className="space-y-4">
      <p className="font-mono text-sm text-ink-3">
        {fillCopy(copy.lot, { lot: auction.lot_no })}
      </p>
      <h1>{auction.title}</h1>
      <figure>
        <div
          aria-hidden="true"
          className="flex aspect-[4/3] items-center justify-center rounded-md border border-rule bg-surface font-mono text-6xl text-ink-3"
        >
          {auction.lot_no}
        </div>
        <figcaption className="mt-2 text-sm text-ink-3">
          {copy.noPhoto}
        </figcaption>
      </figure>
      <p className="text-sm text-ink-2">
        {fillCopy(copy.startingAmount, {
          amount: formatCents(auction.starting_price),
        })}
      </p>
    </section>
  );
}
