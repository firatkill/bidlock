import Link from "next/link";
import { fillCopy, sandboxCopy as copy, lobbyCopy } from "@/domain/copy";
import { formatCountdown, remainingMs } from "@/domain/clock";
import type { AuctionState } from "@/domain/schemas";
export type SandboxCardState =
  "default" | "creating" | "capacity" | "rate" | "readonly" | "error";
export function SandboxCard({
  auction = null,
  now,
  state = "default",
  retryMinutes = 1,
}: {
  auction?: AuctionState | null;
  now: number;
  state?: SandboxCardState;
  retryMinutes?: number;
}) {
  const left = auction ? remainingMs(auction.ends_at, now) : 0;
  const status =
    auction?.status === "live"
      ? left > 0
        ? fillCopy(lobbyCopy.closes, { time: formatCountdown(left) })
        : lobbyCopy.closing
      : auction?.status === "closed"
        ? copy.payment
        : copy.finished;
  return (
    <section className="flex flex-col gap-4 rounded-md border border-rule bg-surface p-6">
      <h2 className="text-2xl font-medium">
        {auction ? copy.active : copy.title}
      </h2>
      <p className="text-ink-2">
        {auction
          ? fillCopy(copy.lotStatus, { lot: auction.lot_no, status })
          : copy.body}
      </p>
      {auction ? (
        <Link className="button mt-auto self-start" href={`/a/${auction.id}`}>
          {copy.return}
        </Link>
      ) : (
        <button className="button mt-auto self-start" disabled>
          {state === "creating" ? copy.starting : copy.start}
        </button>
      )}
      {state === "capacity" && (
        <p role="status" className="text-sm text-ink-2">
          {copy.capacity}
        </p>
      )}
      {state === "rate" && (
        <p role="status" className="text-sm text-ink-2">
          {fillCopy(copy.rate, { n: retryMinutes })}
        </p>
      )}
      {state === "readonly" && (
        <p className="text-sm text-ink-2">{copy.readonly}</p>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-warn">
          {copy.error}
        </p>
      )}
    </section>
  );
}
