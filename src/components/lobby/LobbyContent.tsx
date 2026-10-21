import { fillCopy, lobbyCopy as copy } from "@/domain/copy";
import type { BenchResult } from "@/domain/schemas";
export function LobbyIntro() {
  return (
    <header className="max-w-3xl space-y-5">
      <h1>{copy.headline}</h1>
      <p className="text-ink-2">{copy.intro}</p>
    </header>
  );
}
export function BenchmarkHeadline({ result }: { result: BenchResult }) {
  if ("empty" in result)
    return (
      <section className="border-y border-rule py-6 text-sm text-ink-3">
        <p>{copy.emptyBenchmark}</p>
      </section>
    );
  return (
    <section className="space-y-2 border-y border-rule py-6">
      <p>
        {fillCopy(copy.benchmark, {
          accepted: result.outcomes.accepted,
          vus: result.config.vus,
          duration_s: result.config.duration_s,
          violations: result.invariants.reduce(
            (sum, value) => sum + value.violations,
            0,
          ),
          p95_ms: result.latency_ms.p95,
        })}
      </p>
      <p className="text-sm text-ink-3">
        {fillCopy(copy.measured, { date: result.date })}
      </p>
      <a href="/how-it-works#benchmark" className="text-accent">
        {copy.results}
      </a>
    </section>
  );
}
export function LobbyTeaser() {
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-medium">{copy.teaser}</h2>
      <ul className="grid gap-6 text-ink-2 md:grid-cols-3">
        {copy.principles.map((principle) => (
          <li key={principle}>{principle}</li>
        ))}
      </ul>
      <a href="/how-it-works" className="inline-block text-accent">
        {copy.readMore}
      </a>
    </section>
  );
}
