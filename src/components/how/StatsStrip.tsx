import type { z } from "zod";
import type { Stats } from "@/domain/schemas";
import { fillCopy, howCopy as copy } from "@/domain/copy";
import { benchmarkNumber as number } from "@/domain/numbers";
export type StatsSnapshot = { value: z.infer<typeof Stats>; fetchedAt: number };
export function StatsStrip({
  snapshot,
  now,
}: {
  snapshot: StatsSnapshot | null;
  now: number;
}) {
  return (
    <section id="stats" className="how-section">
      <h2>{copy.stats}</h2>
      {snapshot ? (
        <>
          <p className="font-mono">
            {fillCopy(copy.statsLine, {
              bids: number.format(snapshot.value.bids_today),
              sandboxes: number.format(snapshot.value.active_sandboxes),
              lots: number.format(snapshot.value.public_lots_today),
            })}
          </p>
          <p className="text-sm text-ink-3">
            {fillCopy(copy.updated, {
              n: number.format(
                Math.max(0, Math.floor((now - snapshot.fetchedAt) / 1000)),
              ),
            })}
          </p>
        </>
      ) : (
        <p>{copy.unavailable}</p>
      )}
    </section>
  );
}
