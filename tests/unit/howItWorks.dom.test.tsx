import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { BenchmarkTable } from "@/components/how/BenchmarkTable";
import { StatsStrip } from "@/components/how/StatsStrip";
import { ConcurrencyTimeline } from "@/components/how/ConcurrencyTimeline";
import { StateMachine } from "@/components/how/StateMachine";
import { BenchResult } from "@/domain/schemas";
import { benchmark } from "../fixtures/benchmark";
// Snapshot of the published D-92 run; future weekly latest.json updates remain independent.
import publishedFailure from "../fixtures/benchmark-failing.json";
import { readFileSync } from "node:fs";
afterEach(cleanup);
test("TC-273 TC-286 empty benchmark has exact empty copy and anchor, no table", () => {
  const view = render(<BenchmarkTable result={{ schema: 1, empty: true }} />);
  expect(
    screen.getByText(
      "Benchmark results will appear here after the first load-test run.",
    ),
  ).toBeTruthy();
  expect(view.container.querySelector("#benchmark")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText("Thresholds passed")).toBeNull();
});
test("TC-273 TC-287 full passing fixture renders all required data", () => {
  render(<BenchmarkTable result={benchmark} />);
  const table = screen.getByRole("table", { name: "Benchmark" });
  for (const text of [
    "2026-11-07",
    "abc1234",
    "Linux · fixture",
    "500",
    "60",
    "10,000",
    "1,234",
    "8,766",
    "25.12",
    "100",
    "160",
    "Thresholds passed",
  ])
    expect(within(table).getAllByText(text).length).toBeGreaterThan(0);
  expect(screen.getByText("INV-01")).toBeTruthy();
  expect(screen.getByText("Pass")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "All runs" }).getAttribute("href"),
  ).toContain("/bench/results");
});
test("TC-273 TC-287 published D-92 result is honest about p95", () => {
  render(<BenchmarkTable result={BenchResult.parse(publishedFailure)} />);
  expect(screen.getByText("Thresholds not met")).toBeTruthy();
  expect(screen.queryByText("Thresholds passed")).toBeNull();
  expect(
    screen.getByText(
      "The p95 latency target was not met: 269.23 ms against a 250 ms target. p99 was 329.69 ms against a 600 ms target. Unexpected errors: 0. Invariant violations: 0.",
    ),
  ).toBeTruthy();
  expect(screen.getAllByText("Pass")).toHaveLength(
    publishedFailure.invariants.length,
  );
});
test.each([
  [
    200,
    701,
    "The p99 latency target was not met: 701 ms against a 650 ms target. p95 was 200 ms against a 300 ms target.",
  ],
  [
    301,
    701,
    "The p95 latency target was not met: 301 ms against a 300 ms target. The p99 latency target was not met: 701 ms against a 650 ms target.",
  ],
  [
    300,
    650,
    "The p95 latency target was not met: 300 ms against a 300 ms target. The p99 latency target was not met: 650 ms against a 650 ms target.",
  ],
  [
    200,
    500,
    "p95 was 200 ms against a 300 ms target. p99 was 500 ms against a 650 ms target.",
  ],
])(
  "TC-273 TC-287 dynamic failure variants %s/%s never imply a false latency failure",
  (p95, p99, clause) => {
    render(
      <BenchmarkTable
        result={{
          ...benchmark,
          latency_ms: { ...benchmark.latency_ms, p95, p99 },
          thresholds: {
            ...benchmark.thresholds,
            p95_ms: 300,
            p99_ms: 650,
            passed: false,
          },
          outcomes: { ...benchmark.outcomes, OTHER: 17 },
          invariants: [{ id: "INV-01", check: "fixture", violations: 2 }],
        }}
      />,
    );
    expect(
      screen.getByText(
        `${clause} Unexpected errors: 17. Invariant violations: 2.`,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Fail")).toBeTruthy();
  },
);
test("TC-274 TC-288 stats distinguish zero from unavailable and report snapshot age", () => {
  const view = render(
    <StatsStrip
      snapshot={{
        value: {
          bids_today: 0,
          active_sandboxes: 0,
          public_lots_today: 0,
          server_now: "2026-11-07T00:00:00.000Z",
        },
        fetchedAt: 1000,
      }}
      now={46000}
    />,
  );
  expect(
    screen.getByText(
      "Bids today: 0 · Active sandboxes: 0 · Public lots today: 0",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Updated 45 s ago.")).toBeTruthy();
  view.rerender(<StatsStrip snapshot={null} now={46000} />);
  expect(
    screen.getByText("Live stats are unavailable right now."),
  ).toBeTruthy();
  expect(screen.queryByText(/Bids today/)).toBeNull();
});
test("TC-285 P5 timeline preserves transaction ordering and is static", () => {
  const view = render(<ConcurrencyTimeline />);
  const text = view.container.textContent;
  expect(text).toMatch(
    /Bid A \$48.00.*lock row.*check price.*insert bid.*commit.*Bid B \$48.00.*waits….*lock · price is \$48.00.*BID_TOO_LOW/,
  );
  expect(view.container.querySelector("button")).toBeNull();
});
test("TC-272 TC-284 committed diagram and all transitions render", () => {
  const svg = readFileSync("src/components/how/state-machine.svg", "utf8");
  render(<StateMachine svg={svg} />);
  expect(screen.getByRole("img", { name: "Auction lifecycle" })).toBeTruthy();
  for (const id of [
    "T0a",
    "T0b",
    "T1",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "T8",
    "T9",
  ])
    expect(screen.getByRole("rowheader", { name: id })).toBeTruthy();
  expect(svg).toContain("awaiting_payment");
  expect(svg).toContain("offered_to_runner_up");
});
