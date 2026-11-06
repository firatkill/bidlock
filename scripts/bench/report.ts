import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { cpus, platform, totalmem } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { BenchResult, FullBenchResult } from "../../src/domain/schemas";
import { adminConnection, assertLocal, runIfMain } from "../db/common";
import { Summary, Verification } from "./verify";

const count = z.number().int().nonnegative();
const measurement = z.number().nonnegative();
const counter = z.object({ count, rate: measurement }).strict();
// k6 owns this extensible envelope. Our config and every consumed metric are strict.
const metric = z
  .object({
    type: z.enum(["counter", "gauge", "rate", "trend"]),
    contains: z.string(),
    values: z.record(z.string(), z.number()),
    thresholds: z
      .record(z.string(), z.object({ ok: z.boolean() }).strict())
      .optional(),
  })
  .strict();
export const ReportSummary = Summary.extend({
  bench_config: FullBenchResult.shape.config.omit({
    db_pool_max: true,
    postgres: true,
  }),
  metrics: z.record(z.string(), metric),
});
const Outcome = z.enum(["success", "failure"]);
const Environment = z
  .object({
    GITHUB_SHA: z
      .string()
      .regex(/^[a-f0-9]{7,40}$/)
      .optional(),
    RUNNER_OS: z.string().min(1).optional(),
    DB_POOL_MAX: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(count)
      .optional(),
    DATABASE_URL_ADMIN: z.url(),
  })
  .strict();

export function makeResult(
  rawSummary: unknown,
  rawVerify: unknown,
  metadata: {
    date: string;
    commit: string;
    runner: FullBenchResult["runner"];
    db_pool_max: number;
    postgres: string;
  },
  outcome: z.infer<typeof Outcome>,
): FullBenchResult {
  const summary = ReportSummary.parse(rawSummary);
  const verify = Verification.parse(rawVerify);
  if (summary.setup_data.auctionId !== verify.auction_id)
    throw new Error("Summary and verification refer to different auctions");
  const metrics = summary.metrics;
  function readCounter(name: string, optional = false) {
    const value = metrics[name];
    // k6 omits counters that never received a sample (zero outcomes).
    if (!value && optional) return { count: 0, rate: 0 };
    if (value?.type !== "counter") throw new Error(`Missing counter ${name}`);
    return counter.parse(value.values);
  }
  const bids = readCounter("bid_requests");
  const replays = readCounter("replay_requests");
  const latency = z
    .object({
      avg: measurement,
      min: measurement,
      med: measurement,
      "p(90)": measurement,
      "p(95)": measurement,
      "p(99)": measurement,
      max: measurement,
    })
    .strict()
    .parse(metrics.bid_latency?.values);
  const errors = z
    .object({ rate: measurement.max(1), passes: count, fails: count })
    .strict()
    .parse(metrics.unexpected_errors?.values);
  const requiredThresholds = {
    bid_latency: ["p(95)<250", "p(99)<600"],
    unexpected_errors: ["rate<0.01"],
    replay_mismatch: ["count==0"],
  };
  const complete = Object.entries(requiredThresholds).every(([name, rules]) =>
    rules.every((rule) => metrics[name]?.thresholds?.[rule]?.ok === true),
  );
  const allPassed = Object.values(metrics).every((value) =>
    Object.values(value.thresholds ?? {}).every(({ ok }) => ok),
  );
  return FullBenchResult.parse({
    schema: 1,
    date: metadata.date,
    commit: metadata.commit,
    runner: metadata.runner,
    config: {
      ...summary.bench_config,
      db_pool_max: metadata.db_pool_max,
      postgres: metadata.postgres,
    },
    requests: { bids: bids.count, replays: replays.count, rps: bids.rate },
    outcomes: {
      accepted: readCounter("outcome_accepted", true).count,
      BID_TOO_LOW: readCounter("outcome_bid_too_low", true).count,
      ALREADY_LEADING: readCounter("outcome_already_leading", true).count,
      AUCTION_CLOSED: readCounter("outcome_auction_closed", true).count,
      RATE_LIMITED: readCounter("outcome_rate_limited", true).count,
      OTHER: readCounter("outcome_other", true).count,
    },
    unexpected_error_rate: errors.rate,
    latency_ms: {
      p50: latency.med,
      p90: latency["p(90)"],
      p95: latency["p(95)"],
      p99: latency["p(99)"],
      max: latency.max,
    },
    auction: {
      final_price: verify.final_price,
      bid_count: verify.bid_count,
      extension_count: verify.extension_count,
      status: verify.status,
    },
    invariants: verify.checks,
    thresholds: {
      p95_ms: 250,
      p99_ms: 600,
      unexpected_error_rate: 0.01,
      passed: Outcome.parse(outcome) === "success" && complete && allPassed,
    },
  });
}

export const summaryHeader =
  "| Date | Commit | VUs | Bid requests | Accepted | p95 ms | p99 ms | Unexpected errors | Invariant violations | Thresholds |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
export function summaryMarkdown(
  entries: { name: string; result: FullBenchResult }[],
): string {
  return (
    summaryHeader +
    [...entries]
      .sort(
        (a, b) =>
          b.name.slice(0, 10).localeCompare(a.name.slice(0, 10)) ||
          Number(b.name.slice(10).match(/^-(\d+)\.json$/)?.[1] ?? 1) -
            Number(a.name.slice(10).match(/^-(\d+)\.json$/)?.[1] ?? 1),
      )
      .map(
        ({ result: r }) =>
          `| ${r.date} | ${r.commit} | ${String(r.config.vus)} | ${String(r.requests.bids)} | ${String(r.outcomes.accepted)} | ${String(r.latency_ms.p95)} | ${String(r.latency_ms.p99)} | ${String(r.unexpected_error_rate)} | ${String(r.invariants.reduce((sum, row) => sum + row.violations, 0))} | ${r.thresholds.passed ? "PASS" : "FAIL"} |\n`,
      )
      .join("")
  );
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
export async function initResults(root = ".") {
  await mkdir(join(root, "bench/results"), { recursive: true });
  try {
    await writeFile(
      join(root, "bench/results/latest.json"),
      json(BenchResult.parse({ schema: 1, empty: true })),
      { flag: "wx" },
    );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
}
export async function writeReport(
  rawResult: unknown,
  noCommit: boolean,
  root = ".",
) {
  const result = FullBenchResult.parse(rawResult); // Never turn the sentinel into a dated result.
  if (noCommit) {
    await mkdir(join(root, "bench/out"), { recursive: true });
    await writeFile(join(root, "bench/out/result.json"), json(result));
    await writeFile(
      join(root, "bench/out/SUMMARY.md"),
      summaryMarkdown([{ name: result.date, result }]),
    );
    return;
  }
  const dir = join(root, "bench/results");
  await mkdir(dir, { recursive: true });
  const names = await readdir(dir);
  const entries: { name: string; result: FullBenchResult }[] = [];
  for (const name of names.filter((name) =>
    /^\d{4}-\d{2}-\d{2}(?:-\d+)?\.json$/.test(name),
  )) {
    entries.push({
      name,
      result: FullBenchResult.parse(
        JSON.parse(await readFile(join(dir, name), "utf8")) as unknown,
      ),
    });
  }
  let suffix = 1;
  let name: string;
  for (;;) {
    name = `${result.date}${suffix === 1 ? "" : `-${String(suffix)}`}.json`;
    try {
      await writeFile(join(dir, name), json(result), { flag: "wx" });
      break;
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ))
        throw error;
      suffix++;
    }
  }
  await writeFile(join(dir, "latest.json"), json(result));
  await writeFile(
    join(root, "bench/SUMMARY.md"),
    summaryMarkdown([...entries, { name, result }]),
  );
}

export function poolFromCompose(raw: unknown): number {
  // Docker owns other service/config keys; validate our consumed nested boundary strictly.
  const config = z
    .object({
      services: z
        .object({
          app: z
            .object({ environment: z.record(z.string(), z.unknown()) })
            .catchall(z.unknown()),
        })
        .catchall(z.unknown()),
    })
    .catchall(z.unknown())
    .parse(raw);
  return z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(count)
    .parse(config.services.app.environment.DB_POOL_MAX);
}

runIfMain(import.meta.url, async () => {
  const { values } = parseArgs({
    options: {
      "no-commit": { type: "boolean" },
      init: { type: "boolean" },
      "k6-outcome": { type: "string" },
    },
  });
  if (values.init) {
    if (values["no-commit"] || values["k6-outcome"])
      throw new Error("--init cannot be combined with report flags");
    await initResults();
    return;
  }
  const outcome = Outcome.parse(values["k6-outcome"]);
  const env = Environment.safeParse({
    GITHUB_SHA: process.env.GITHUB_SHA,
    RUNNER_OS: process.env.RUNNER_OS,
    DB_POOL_MAX: process.env.DB_POOL_MAX,
    DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN,
  });
  if (!env.success) throw new Error("Invalid report environment");
  assertLocal(env.data.DATABASE_URL_ADMIN);
  const summary: unknown = JSON.parse(
    await readFile("bench/out/k6-summary.json", "utf8"),
  );
  const verification: unknown = JSON.parse(
    await readFile("bench/out/verify.json", "utf8"),
  );
  // Never print k6 validation inputs: setup_data contains session cookies.
  if (
    !ReportSummary.safeParse(summary).success ||
    !Verification.safeParse(verification).success
  )
    throw new Error("Invalid report input files");
  const pool =
    env.data.DB_POOL_MAX ??
    poolFromCompose(
      JSON.parse(
        execFileSync(
          "docker",
          ["compose", "-f", "docker/compose.yml", "config", "--format", "json"],
          { encoding: "utf8" },
        ),
      ) as unknown,
    );
  const sql = adminConnection(env.data.DATABASE_URL_ADMIN);
  let postgres: string;
  try {
    const rows = z
      .array(z.object({ server_version: z.string().min(1) }).strict())
      .length(1)
      .parse(await sql`show server_version`);
    const row = rows[0];
    if (!row) throw new Error("Missing PostgreSQL version");
    postgres = row.server_version;
  } finally {
    await sql.end();
  }
  let cpuModel = cpus()[0]?.model;
  try {
    cpuModel =
      (await readFile("/proc/cpuinfo", "utf8")).match(
        /^model name\s*:\s*(.+)$/m,
      )?.[1] ?? cpuModel;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  if (!cpuModel) throw new Error("Missing CPU model");
  const result = makeResult(
    summary,
    verification,
    {
      date: new Date().toISOString().slice(0, 10),
      commit:
        env.data.GITHUB_SHA ??
        execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      runner: {
        os: env.data.RUNNER_OS ?? platform(),
        cpus: cpus().length,
        cpu_model: cpuModel,
        memory_gb: totalmem() / 1024 ** 3,
      },
      db_pool_max: pool,
      postgres,
    },
    outcome,
  );
  await writeReport(result, values["no-commit"] ?? false);
});
