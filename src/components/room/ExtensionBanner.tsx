"use client";
import { useEffect, useState } from "react";
import { localNow } from "@/client/api";
import { formatCountdown } from "@/domain/clock";
import { fillCopy, roomCopy as copy } from "@/domain/copy";
import type { RoomState } from "@/domain/reconcile";
export function ExtensionBanner({
  extension,
  max,
}: {
  extension: RoomState["lastExtension"];
  max: number;
}) {
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!extension) return;
    const timer = setTimeout(
      () => {
        setHidden(extension.n);
      },
      Math.max(0, extension.at + 5000 - localNow()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [extension]);
  return (
    <div
      aria-live="polite"
      className={!extension || hidden === extension.n ? "sr-only" : undefined}
    >
      {extension && hidden !== extension.n && (
        <div
          key={extension.n}
          className="extension-enter flex flex-wrap items-center justify-between gap-3 rounded bg-strip-ground px-5 py-3 text-strip-ink"
        >
          <span
            aria-hidden="true"
            className="rounded bg-stamp-ground px-2 py-1 font-mono text-stamp-ink"
          >
            {fillCopy(copy.extensionTag, {
              time: formatCountdown(extension.durationMs),
            })}
          </span>
          <p className="flex-1 font-medium">
            {fillCopy(copy.extension, {
              time: formatCountdown(extension.durationMs),
            })}
          </p>
          <p className="font-mono text-xs text-strip-muted">
            {fillCopy(copy.extensionCount, { n: extension.n, max })}
          </p>
        </div>
      )}
    </div>
  );
}
