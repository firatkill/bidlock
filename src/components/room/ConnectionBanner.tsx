"use client";
import { useEffect, useState } from "react";
import { roomCopy as copy } from "@/domain/copy";
import type { FeedStatus } from "@/domain/feed";
export function ConnectionBanner({ status }: { status: FeedStatus }) {
  const [previous, setPrevious] = useState(status);
  const [recovered, setRecovered] = useState(false);
  if (previous !== status) {
    setPrevious(status);
    setRecovered(previous === "reconnecting" && status === "live");
  }
  useEffect(() => {
    if (!recovered) return;
    const timer = setTimeout(() => {
      setRecovered(false);
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [recovered]);
  return (
    <div role="status">
      {status === "reconnecting" ? (
        <p className="rounded border border-rule p-4 text-warn">
          {copy.reconnecting}
        </p>
      ) : recovered ? (
        <p className="text-ok">{copy.recovered}</p>
      ) : null}
    </div>
  );
}
