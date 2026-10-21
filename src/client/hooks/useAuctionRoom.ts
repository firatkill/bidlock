"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { fetchBidsAfter } from "@/client/api";
import { createFeed } from "@/client/feed/createFeed";
import type {
  AuctionFeed,
  FeedEvent,
  FeedStatus,
} from "@/client/feed/AuctionFeed";
import { reduce, type RoomState } from "@/domain/reconcile";
import type { AuctionState, BidItem } from "@/domain/schemas";
import { useMe } from "./useMe";
import { useServerClock } from "./useServerClock";

export function useAuctionRoom(
  auctionId: string,
  initial: AuctionState | null,
  initialBids: BidItem[] = [],
) {
  const [state, dispatch] = useReducer(reduce, {
    auction: initial,
    bids: initialBids,
    lastBidNo: Math.max(0, ...initialBids.map((bid) => bid.bid_no)),
    pendingRefetch: false,
    pendingBidsAfter: null,
    lastExtension: null,
  } satisfies RoomState);
  const [status, setStatus] = useState<FeedStatus>("connecting");
  const feed = useRef<AuctionFeed | null>(null);
  const clock = useServerClock();
  const me = useMe();
  const apply = useCallback(
    (event: FeedEvent) => {
      if (event.kind === "snapshot" && event.rttMs !== null) {
        clock.addSample(
          event.receivedAt - event.rttMs,
          event.receivedAt,
          event.state.server_now,
        );
      }
      dispatch(event);
    },
    [clock],
  );
  useEffect(() => {
    const current = createFeed(auctionId);
    feed.current = current;
    const stop = current.subscribe(auctionId, {
      onEvent: apply,
      onStatus: setStatus,
    });
    return () => {
      stop();
      feed.current = null;
    };
  }, [auctionId, apply]);
  useEffect(() => {
    if (state.pendingRefetch) feed.current?.refresh();
  }, [state.pendingRefetch]);
  useEffect(() => {
    if (state.pendingBidsAfter === null) return;
    const controller = new AbortController();
    const fill = async () => {
      let after = state.pendingBidsAfter ?? 0;
      const bids: BidItem[] = [];
      while (!controller.signal.aborted) {
        const page = await fetchBidsAfter(auctionId, after, controller.signal);
        bids.push(...page.bids);
        const next = Math.max(after, ...page.bids.map((bid) => bid.bid_no));
        if (page.bids.length < 50 || next === after) break;
        after = next;
      }
      if (!controller.signal.aborted) apply({ kind: "bids", bids });
    };
    void fill().catch(() => {
      if (!controller.signal.aborted) feed.current?.refresh();
    });
    return () => {
      controller.abort();
    };
  }, [auctionId, state.pendingBidsAfter, apply]);
  const refresh = useCallback(() => {
    feed.current?.refresh();
  }, []);
  return {
    ...state,
    status,
    clock,
    me,
    apply,
    refresh,
    isLeader: !!me && state.auction?.leader?.id === me.id,
    bids: state.bids.map((bid) => ({
      ...bid,
      isYou: bid.bidder_id === me?.id,
    })),
  };
}
