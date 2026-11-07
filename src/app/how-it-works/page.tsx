import { readFileSync } from "node:fs";
import { join } from "node:path";
import { howCopy as copy, fillCopy } from "@/domain/copy";
import { INCREMENT_BANDS } from "@/domain/increments";
import { formatCents } from "@/domain/money";
import { RULE_DEFAULTS } from "@/domain/rules";
import { benchmarkNumber as number } from "@/domain/numbers";
import { readBenchmark } from "@/server/benchmark";
import { cachedStats } from "@/server/repo/stats";
import { BenchmarkTable } from "@/components/how/BenchmarkTable";
import { StatsStrip } from "@/components/how/StatsStrip";
import { StateMachine } from "@/components/how/StateMachine";
import { ConcurrencyTimeline } from "@/components/how/ConcurrencyTimeline";
export const dynamic = "force-dynamic";
export const metadata = { title: `${copy.title} · Bidlock` };
export default async function HowItWorks() {
  const snapshot = await cachedStats().catch(() => null);
  const svg = readFileSync(
    join(process.cwd(), "src/components/how/state-machine.svg"),
    "utf8",
  );
  const sections: readonly (readonly [string, string])[] = [
    ["rules", copy.rules],
    ["state-machine", copy.lifecycle],
    ["concurrency", copy.concurrency],
    ["benchmark", copy.benchmark],
    ["stats", copy.stats],
    ["run-it", copy.run],
  ];
  const defaults = {
    steps: number.format(RULE_DEFAULTS.maxSteps),
    cap: formatCents(RULE_DEFAULTS.maxCents),
    window: number.format(RULE_DEFAULTS.snipeWindowSeconds),
    extension: number.format(RULE_DEFAULTS.extendBySeconds),
    max: number.format(RULE_DEFAULTS.maxExtensions),
    payment: number.format(RULE_DEFAULTS.paymentWindowSeconds),
  };
  // Server rendering captures a request timestamp; no client render reads the clock.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  return (
    <main className="how-page">
      <header className="border-b border-rule pb-8">
        <h1 className="lobby-headline">{copy.title}</h1>
      </header>
      <div className="how-layout">
        <nav aria-label={copy.navigation} className="how-nav">
          {sections.map(([id, label], index) => (
            <a key={id} href={`#${id}`}>
              <span className="font-mono text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              {label}
            </a>
          ))}
        </nav>
        <div className="min-w-0 space-y-12">
          <section id="rules" className="how-section">
            <h2>{copy.rules}</h2>
            <ul className="list-disc space-y-3 pl-5 text-ink-2">
              {copy.ruleItems.map((text) => (
                <li key={text}>{fillCopy(text, defaults)}</li>
              ))}
            </ul>
            <table className="how-table w-full">
              <thead>
                <tr>
                  <th scope="col">{copy.priceFrom}</th>
                  <th scope="col">{copy.increment}</th>
                </tr>
              </thead>
              <tbody>
                {INCREMENT_BANDS.map(([lower, step]) => (
                  <tr key={lower}>
                    <td className="font-mono">{formatCents(lower)}</td>
                    <td className="font-mono">{formatCents(step)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <StateMachine svg={svg} />
          <section id="concurrency" className="how-section">
            <h2>{copy.concurrency}</h2>
            <ConcurrencyTimeline />
            {copy.explanation.map((text) => (
              <p key={text} className="text-ink-2">
                {text}
              </p>
            ))}
            <figure>
              <figcaption className="mb-2 text-sm text-ink-3">
                {copy.coreLabel}
              </figcaption>
              <pre
                className="overflow-x-auto rounded border border-rule bg-surface p-4 text-xs"
                tabIndex={0}
              >
                <code>{copy.core}</code>
              </pre>
            </figure>
          </section>
          <BenchmarkTable result={readBenchmark()} />
          <StatsStrip snapshot={snapshot} now={renderedAt} />
          <section id="run-it" className="how-section">
            <h2>{copy.run}</h2>
            <pre className="overflow-x-auto rounded border border-rule bg-surface p-4 text-sm">
              <code>{copy.commands}</code>
            </pre>
          </section>
        </div>
      </div>
    </main>
  );
}
