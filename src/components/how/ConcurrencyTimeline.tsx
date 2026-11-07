import { fillCopy, howCopy as copy } from "@/domain/copy";
import { formatCents } from "@/domain/money";
export function ConcurrencyTimeline() {
  const amount = formatCents(4800);
  return (
    <figure
      aria-label={copy.timeline}
      className="space-y-4 rounded border border-rule bg-surface p-4 md:p-6"
    >
      <figcaption className="font-medium">{copy.timeline}</figcaption>
      <div className="how-timeline font-mono text-xs">
        <p className="font-bold">{fillCopy(copy.bidA, { amount })}</p>
        {copy.timelineSteps.map((step) => (
          <p key={step} className="rounded bg-accent p-2 text-accent-contrast">
            {step}
          </p>
        ))}
        <span aria-hidden="true" />
        <p className="font-bold">{fillCopy(copy.bidB, { amount })}</p>
        <p className="how-wait rounded border border-dashed border-rule-strong p-2 text-ink-2">
          {copy.wait}
        </p>
        <p className="rounded bg-ink p-2 text-ground">
          {fillCopy(copy.lockPrice, { amount })}
        </p>
        <p className="rounded border border-warn p-2 text-warn">
          {copy.tooLow}
        </p>
      </div>
    </figure>
  );
}
