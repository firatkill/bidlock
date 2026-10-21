"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { localNow, request } from "@/client/api";
import { createFeed } from "@/client/feed/createFeed";
import { useMe } from "@/client/hooks/useMe";
import { useServerClock } from "@/client/hooks/useServerClock";
import { AuctionList, type AuctionState } from "@/domain/schemas";
import type { z } from "zod";
import type { ClockSync } from "@/domain/clock";
import { PublicRoomCard } from "./PublicRoomCard";
import { SandboxCard } from "./SandboxCard";
import { OfferNotices } from "./OfferNotices";
function LiveCard({
  initial,
  clock,
  now,
  viewerId,
  readonly,
  refresh,
}: {
  initial: AuctionState;
  clock: ClockSync;
  now: number;
  viewerId: string | null;
  readonly: boolean;
  refresh: () => void;
}) {
  const [auction, setAuction] = useState(initial);
  useEffect(() => {
    const feed = createFeed(initial.id);
    return feed.subscribe(initial.id, {
      onStatus: () => {},
      onEvent: (event) => {
        if (event.kind === "change") {
          feed.refresh();
          return;
        }
        if (event.kind !== "snapshot") return;
        if (event.rttMs !== null)
          clock.addSample(
            event.receivedAt - event.rttMs,
            event.receivedAt,
            event.state.server_now,
          );
        setAuction((held) =>
          event.state.version >= held.version ? event.state : held,
        );
        if (
          event.state.kind === "public" &&
          (event.state.status === "settled" ||
            event.state.status === "unsold" ||
            event.state.next_public_auction_id)
        )
          refresh();
      },
    });
  }, [initial.id, clock, refresh]);
  return auction.kind === "public" ? (
    <PublicRoomCard auction={auction} now={now} viewerId={viewerId} />
  ) : (
    <SandboxCard
      auction={auction}
      now={now}
      state={readonly ? "readonly" : "default"}
    />
  );
}
export function Lobby({
  initial,
  readonly = false,
}: {
  initial: z.infer<typeof AuctionList> | null;
  readonly?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(initial === null);
  const [now, setNow] = useState(() =>
    initial ? Date.parse(initial.public.server_now) : 0,
  );
  const clock = useServerClock();
  const me = useMe();
  const inFlight = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  const refresh = useCallback(
    function refreshList() {
      if (inFlight.current) return;
      inFlight.current = true;
      const t0 = localNow();
      void request("/api/auctions", AuctionList)
        .then((next) => {
          if (!alive.current) return;
          clock.addSample(t0, localNow(), next.public.server_now);
          setData(next);
          setError(false);
        })
        .catch(() => {
          if (!alive.current) return;
          setError(true);
          retry.current = setTimeout(refreshList, 3000);
        })
        .finally(() => {
          inFlight.current = false;
        });
    },
    [clock],
  );
  useEffect(() => {
    alive.current = true;
    if (!initial) retry.current = setTimeout(refresh, 3000);
    const timer = setInterval(() => {
      setNow(clock.serverNow(localNow()));
    }, 250);
    return () => {
      alive.current = false;
      clearTimeout(retry.current);
      clearInterval(timer);
    };
  }, [initial, clock, refresh]);
  return (
    <div className="space-y-6">
      <OfferNotices offers={me?.open_offers ?? []} now={now} />
      <div className="grid gap-6 md:grid-cols-2">
        {data && !error ? (
          <LiveCard
            key={data.public.id}
            initial={data.public}
            clock={clock}
            now={now}
            viewerId={me?.id ?? null}
            readonly={readonly}
            refresh={refresh}
          />
        ) : (
          <PublicRoomCard
            auction={null}
            now={now}
            viewerId={null}
            error={error}
          />
        )}
        {data?.sandbox ? (
          <LiveCard
            key={data.sandbox.id}
            initial={data.sandbox}
            clock={clock}
            now={now}
            viewerId={me?.id ?? null}
            readonly={readonly}
            refresh={refresh}
          />
        ) : (
          <SandboxCard now={now} state={readonly ? "readonly" : "default"} />
        )}
      </div>
    </div>
  );
}
