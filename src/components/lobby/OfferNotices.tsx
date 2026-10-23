import Link from "next/link";
import { fillCopy, lobbyCopy as copy } from "@/domain/copy";
import { formatCountdown, remainingMs } from "@/domain/clock";
import { formatCents } from "@/domain/money";
import type { Me } from "@/domain/schemas";
export function OfferNotices({
  offers,
  now,
}: {
  offers: Me["open_offers"];
  now: number;
}) {
  return (
    <div className="space-y-3">
      {offers
        .filter((offer) => Date.parse(offer.deadline) > now)
        .map((offer) => (
          <section
            key={offer.auction_id}
            className="rounded-md border border-rule bg-accent-tint p-4"
          >
            <p>
              {fillCopy(
                offer.rank === 1 ? copy.winnerNotice : copy.runnerNotice,
                {
                  lot: offer.lot_no,
                  amount: formatCents(offer.amount),
                  time: formatCountdown(remainingMs(offer.deadline, now)),
                },
              )}
            </p>
            <Link
              href={`/a/${offer.auction_id}`}
              className="mt-2 inline-block text-accent"
            >
              {copy.auctionLink}
            </Link>
          </section>
        ))}
    </div>
  );
}
