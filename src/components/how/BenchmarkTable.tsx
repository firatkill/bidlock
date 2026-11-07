import { fillCopy, howCopy as copy } from "@/domain/copy";
import { benchmarkNumber as number } from "@/domain/numbers";
import type { BenchResult, FullBenchResult } from "@/domain/schemas";

function failureText(result: FullBenchResult) {
  const p95 = result.latency_ms.p95 >= result.thresholds.p95_ms;
  const p99 = result.latency_ms.p99 >= result.thresholds.p99_ms;
  const template = p95
    ? p99
      ? copy.failedBoth
      : copy.failedP95
    : p99
      ? copy.failedP99
      : copy.failedOther;
  return fillCopy(template, {
    p95: number.format(result.latency_ms.p95),
    p95Target: number.format(result.thresholds.p95_ms),
    p99: number.format(result.latency_ms.p99),
    p99Target: number.format(result.thresholds.p99_ms),
    errors: number.format(result.outcomes.OTHER),
    violations: number.format(
      result.invariants.reduce((sum, row) => sum + row.violations, 0),
    ),
  });
}
export function BenchmarkTable({ result }: { result: BenchResult }) {
  const fields = copy.fields;
  const rows: [string, string][] =
    "empty" in result
      ? []
      : [
          [fields.date, result.date],
          [fields.commit, result.commit],
          [fields.runner, `${result.runner.os} · ${result.runner.cpu_model}`],
          [fields.cpus, number.format(result.runner.cpus)],
          [fields.memory, number.format(result.runner.memory_gb)],
          [fields.vus, number.format(result.config.vus)],
          [fields.duration, number.format(result.config.duration_s)],
          [fields.requests, number.format(result.requests.bids)],
          [fields.accepted, number.format(result.outcomes.accepted)],
          ...(
            [
              "BID_TOO_LOW",
              "ALREADY_LEADING",
              "AUCTION_CLOSED",
              "RATE_LIMITED",
            ] as const
          ).map((code): [string, string] => [
            code,
            number.format(result.outcomes[code]),
          ]),
          [fields.errors, number.format(result.outcomes.OTHER)],
          [fields.errorRate, String(result.unexpected_error_rate)],
          [fields.errorTarget, String(result.thresholds.unexpected_error_rate)],
          [fields.p50, number.format(result.latency_ms.p50)],
          [fields.p95, number.format(result.latency_ms.p95)],
          [fields.p95Target, number.format(result.thresholds.p95_ms)],
          [fields.p99, number.format(result.latency_ms.p99)],
          [fields.p99Target, number.format(result.thresholds.p99_ms)],
          [fields.throughput, number.format(result.requests.rps)],
          [fields.extensions, number.format(result.auction.extension_count)],
          [
            fields.maxExtensions,
            number.format(result.config.auction.max_extensions),
          ],
          [
            fields.thresholds,
            result.thresholds.passed ? copy.passed : copy.failed,
          ],
        ];
  return (
    <section id="benchmark" className="how-section">
      <h2>{copy.benchmark}</h2>
      {"empty" in result ? (
        <p>{copy.empty}</p>
      ) : (
        <>
          {!result.thresholds.passed && (
            <p className="border-l-2 border-warn pl-4">{failureText(result)}</p>
          )}
          <table
            className="how-table w-full table-fixed"
            aria-label={copy.benchmark}
          >
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className="w-1/2">
                    {label}
                  </th>
                  <td className="font-mono tabular-nums break-words">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            className="how-scroll"
            role="region"
            aria-label={copy.invariantHeaders[0]}
            tabIndex={0}
          >
            <table className="how-table min-w-full">
              <thead>
                <tr>
                  {copy.invariantHeaders.map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.invariants.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="whitespace-nowrap font-mono">
                      {row.id}
                    </th>
                    <td>{row.check}</td>
                    <td className="font-mono">
                      {number.format(row.violations)}
                    </td>
                    <td className={row.violations ? "text-warn" : "text-ok"}>
                      {row.violations ? copy.fail : copy.pass}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-sm text-ink-2">{copy.benchmarkNote}</p>
      <a
        className="inline-flex min-h-11 items-center text-accent"
        href="https://github.com/firatkill/bidlock/tree/main/bench/results"
      >
        {copy.allRuns}
      </a>
    </section>
  );
}
