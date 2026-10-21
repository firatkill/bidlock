"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, fetchBidsAfter, fetchSnapshot } from "@/client/api";
import { roomCopy as copy } from "@/domain/copy";
import type { AuctionState, BidItem } from "@/domain/schemas";
import { AuctionRoom } from "./AuctionRoom";
export function AuctionNotFound() {
  return (
    <main className="space-y-4">
      <h1>{copy.notFound}</h1>
      <p className="text-ink-2">{copy.deleted}</p>
      <Link href="/" className="text-accent">
        {copy.lobby}
      </Link>
    </main>
  );
}
export function AuctionLoadState({
  auctionId,
  initialError = false,
}: {
  auctionId: string;
  initialError?: boolean;
}) {
  const [error, setError] = useState(initialError);
  const [missing, setMissing] = useState(false);
  const [data, setData] = useState<{
    auction: AuctionState;
    bids: BidItem[];
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const snapshot = await fetchSnapshot(
          auctionId,
          null,
          controller.signal,
        );
        if (!snapshot) throw new Error("Initial snapshot must contain a body");
        const history = await fetchBidsAfter(
          auctionId,
          Math.max(0, snapshot.state.bid_count - 20),
          controller.signal,
        );
        if (!controller.signal.aborted)
          setData({
            auction: snapshot.state,
            bids: history.bids.sort((a, b) => b.bid_no - a.bid_no),
          });
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setMissing(true);
          return;
        }
        setError(true);
        timer = setTimeout(() => {
          void load();
        }, 3000);
      }
    };
    if (initialError)
      timer = setTimeout(() => {
        void load();
      }, 3000);
    else void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [auctionId, initialError]);
  if (missing) return <AuctionNotFound />;
  if (data)
    return <AuctionRoom initial={data.auction} initialBids={data.bids} />;
  return (
    <main>
      <p role="status" className={error ? "text-ink-2" : "sr-only"}>
        {error ? copy.loadError : copy.loadingAuction}
      </p>
      {!error && (
        <div
          aria-hidden="true"
          className="h-96 rounded-md border border-rule bg-surface"
        />
      )}
    </main>
  );
}
