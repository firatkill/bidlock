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
    <div aria-live="polite">
      {extension && hidden !== extension.n && (
        <div
          key={extension.n}
          className="extension-enter rounded-md border border-rule bg-accent-tint p-4"
        >
          <p>
            {fillCopy(copy.extension, {
              time: formatCountdown(extension.durationMs),
            })}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {fillCopy(copy.extensionCount, { n: extension.n, max })}
          </p>
        </div>
      )}
    </div>
  );
}
