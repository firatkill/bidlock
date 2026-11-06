import { fillCopy, roomCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
import type { AuctionState } from "@/domain/schemas";
export function LotCard({ auction }: { auction: AuctionState }) {
  return (
    <section className="flex items-center gap-4">
      <div
        aria-hidden="true"
        className="flex h-[78px] w-[104px] shrink-0 items-center justify-center rounded border border-rule-strong bg-surface font-mono text-3xl text-ink-2"
      >
        {String(auction.lot_no).padStart(4, "0")}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-mono text-xs text-ink-3">
          {fillCopy(copy.lot, { lot: String(auction.lot_no).padStart(4, "0") })}
        </p>
        <h1 className="break-words">{auction.title}</h1>
        <p className="text-xs text-ink-3">{copy.noPhoto}</p>
        <p className="text-xs text-ink-2">
          {fillCopy(copy.startingAmount, {
            amount: formatCents(auction.starting_price),
          })}
        </p>
      </div>
    </section>
  );
}
