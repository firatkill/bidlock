import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, expect, test } from "vitest";
import { BenchResult, FullBenchResult } from "../../src/domain/schemas";
import {
  initResults,
  makeResult,
  poolFromCompose,
  ReportSummary,
  summaryMarkdown,
  writeReport,
} from "../../scripts/bench/report";
import { benchmark, summaryFixture, verification } from "../fixtures/benchmark";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function root() {
  const path = await mkdtemp(join(tmpdir(), "bidlock-report-"));
  roots.push(path);
  return path;
}
const metadata = {
  date: benchmark.date,
  commit: benchmark.commit,
  runner: benchmark.runner,
  db_pool_max: 20,
  postgres: "17.11",
};

test("TC-267 UT-12: strict full/empty variants accept facts and reject invalid fields at every object boundary", () => {
  expect(FullBenchResult.parse(benchmark)).toEqual(benchmark);
  expect(BenchResult.parse({ schema: 1, empty: true })).toEqual({
    schema: 1,
    empty: true,
  });
  const invalid: unknown[] = [
    { schema: 1, empty: true, extra: 1 },
    { ...benchmark, schema: 2 },
    { ...benchmark, date: "2026-02-30" },
    { ...benchmark, empty: true },
    { ...benchmark, unexpected_error_rate: -1 },
    { ...benchmark, requests: { ...benchmark.requests, bids: 0.5 } },
    {
      ...benchmark,
      auction: {
        ...benchmark.auction,
        final_price: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  ];
  for (const key of [
    "runner",
    "config",
    "requests",
    "outcomes",
    "latency_ms",
    "auction",
    "thresholds",
  ] as const)
    invalid.push({ ...benchmark, [key]: { ...benchmark[key], extra: true } });
  invalid.push(
    {
      ...benchmark,
      config: {
        ...benchmark.config,
        auction: { ...benchmark.config.auction, extra: true },
      },
    },
    { ...benchmark, invariants: [{ ...benchmark.invariants[0], extra: true }] },
  );
  for (const value of invalid)
    expect(BenchResult.safeParse(value).success).toBe(false);
});
test("TC-267 UT-12: validates inputs and preserves actual metrics, configuration and PostgreSQL version", () => {
  expect(
    makeResult(summaryFixture(), verification, metadata, "success"),
  ).toEqual(benchmark);
  const changed = summaryFixture();
  changed.bench_config.vus = 73;
  changed.bench_config.duration_s = 90;
  expect(
    makeResult(
      changed,
      verification,
      { ...metadata, db_pool_max: 13, postgres: "17.12" },
      "success",
    ).config,
  ).toMatchObject({
    vus: 73,
    duration_s: 90,
    db_pool_max: 13,
    postgres: "17.12",
  });
  expect(() => makeResult({}, verification, metadata, "success")).toThrow();
  expect(() =>
    makeResult(
      summaryFixture(),
      { ...verification, auction_id: "00000000-0000-4000-8000-000000000002" },
      metadata,
      "success",
    ),
  ).toThrow(/different auctions/);
  expect(() =>
    makeResult(
      summaryFixture(),
      { ...verification, extra: true },
      metadata,
      "success",
    ),
  ).toThrow();
  expect(
    ReportSummary.safeParse({
      ...summaryFixture(),
      bench_config: { ...summaryFixture().bench_config, extra: true },
    }).success,
  ).toBe(false);
  const missing = summaryFixture();
  Reflect.deleteProperty(missing.metrics, "replay_requests");
  expect(() => makeResult(missing, verification, metadata, "success")).toThrow(
    /Missing counter/,
  );
  expect(
    poolFromCompose({
      services: { app: { environment: { DB_POOL_MAX: "13" } } },
    }),
  ).toBe(13);
  expect(() =>
    poolFromCompose({ services: { app: { environment: {} } } }),
  ).toThrow();
});
test("TC-267 UT-12: thresholds require success, every required threshold and all additional thresholds", () => {
  expect(
    makeResult(summaryFixture(), verification, metadata, "failure").thresholds
      .passed,
  ).toBe(false);
  const failed = summaryFixture();
  failed.metrics.bid_latency.thresholds["p(99)<600"].ok = false;
  expect(
    makeResult(failed, verification, metadata, "success").thresholds.passed,
  ).toBe(false);
  const missing = summaryFixture();
  Reflect.deleteProperty(missing.metrics.replay_mismatch, "thresholds");
  expect(
    makeResult(missing, verification, metadata, "success").thresholds.passed,
  ).toBe(false);
  const extra = summaryFixture();
  Object.assign(extra.metrics.bid_requests, {
    thresholds: { "count>0": { ok: false } },
  });
  expect(
    makeResult(extra, verification, metadata, "success").thresholds.passed,
  ).toBe(false);
  expect(
    makeResult(summaryFixture(), verification, metadata, "success").thresholds
      .passed,
  ).toBe(true);
});
test("TC-268 UT-12: init never overwrites latest; dated collisions suffix -2/-3; summary newest first", async () => {
  const dir = await root();
  await initResults(dir);
  expect(
    JSON.parse(await readFile(join(dir, "bench/results/latest.json"), "utf8")),
  ).toEqual({ schema: 1, empty: true });
  for (const commit of ["first", "second", "third"])
    await writeReport({ ...benchmark, commit }, false, dir);
  expect((await readdir(join(dir, "bench/results"))).sort()).toEqual([
    "2026-11-07-2.json",
    "2026-11-07-3.json",
    "2026-11-07.json",
    "latest.json",
  ]);
  await initResults(dir);
  expect(
    JSON.parse(await readFile(join(dir, "bench/results/latest.json"), "utf8")),
  ).toMatchObject({ commit: "third" });
  const summary = await readFile(join(dir, "bench/SUMMARY.md"), "utf8");
  expect(summary.indexOf("third")).toBeLessThan(summary.indexOf("second"));
  expect(summary.indexOf("second")).toBeLessThan(summary.indexOf("first"));
  await expect(
    writeReport({ schema: 1, empty: true }, false, dir),
  ).rejects.toThrow();
  expect(
    summaryMarkdown([
      { name: "2026-11-07-10.json", result: { ...benchmark, commit: "ten" } },
      { name: "2026-11-07-2.json", result: { ...benchmark, commit: "two" } },
      { name: "2026-11-08.json", result: { ...benchmark, commit: "next" } },
    ])
      .split("\n")
      .slice(2, 5)
      .join("\n"),
  ).toMatch(/next[\s\S]*ten[\s\S]*two/);
});
test("TC-268 UT-12: no-commit writes only out, preserving results and published summary byte-for-byte", async () => {
  const dir = await root();
  await initResults(dir);
  await writeFile(join(dir, "bench/SUMMARY.md"), "published summary");
  const before = await readFile(join(dir, "bench/results/latest.json"), "utf8");
  await writeReport(benchmark, true, dir);
  expect(await readdir(join(dir, "bench/results"))).toEqual(["latest.json"]);
  expect(await readFile(join(dir, "bench/results/latest.json"), "utf8")).toBe(
    before,
  );
  expect(await readFile(join(dir, "bench/SUMMARY.md"), "utf8")).toBe(
    "published summary",
  );
  expect(
    FullBenchResult.parse(
      JSON.parse(await readFile(join(dir, "bench/out/result.json"), "utf8")),
    ),
  ).toEqual(benchmark);
  expect(await readFile(join(dir, "bench/out/SUMMARY.md"), "utf8")).toContain(
    "abc1234",
  );
  const fresh = await root();
  await writeReport(benchmark, true, fresh);
  expect(await readdir(join(fresh, "bench"))).toEqual(["out"]);
});
test("TC-268 UT-12: CLI init requires no inputs and rejects no-commit combination", async () => {
  const dir = await root();
  await mkdir(join(dir, "bench"));
  const script = join(process.cwd(), "scripts/bench/report.ts");
  const args = [
    "--import",
    join(process.cwd(), "node_modules/tsx/dist/loader.mjs"),
    script,
  ];
  execFileSync(process.execPath, [...args, "--init"], { cwd: dir });
  expect(await readdir(join(dir, "bench/results"))).toEqual(["latest.json"]);
  expect(() =>
    execFileSync(process.execPath, [...args, "--init", "--no-commit"], {
      cwd: dir,
      stdio: "pipe",
    }),
  ).toThrow();
});
