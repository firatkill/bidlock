import type { FullBenchResult } from "../../src/domain/schemas";
// Shape-only test data, never copied to bench/results/.
export const benchmark: FullBenchResult = {
  schema: 1,
  date: "2026-11-07",
  commit: "abc1234",
  runner: { os: "Linux", cpus: 4, cpu_model: "fixture", memory_gb: 16 },
  config: {
    vus: 500,
    duration_s: 60,
    ramp_up_s: 10,
    ip_model: "per-vu-forwarded",
    db_pool_max: 20,
    postgres: "17.11",
    auction: {
      duration_s: 45,
      snipe_window_s: 10,
      extend_by_s: 12,
      max_extensions: 20,
    },
  },
  requests: { bids: 10000, replays: 500, rps: 160 },
  outcomes: {
    accepted: 1234,
    BID_TOO_LOW: 8766,
    ALREADY_LEADING: 0,
    AUCTION_CLOSED: 0,
    RATE_LIMITED: 0,
    OTHER: 0,
  },
  unexpected_error_rate: 0,
  latency_ms: { p50: 10, p90: 20, p95: 25.123456, p99: 100, max: 150 },
  auction: {
    final_price: 123400,
    bid_count: 1200,
    extension_count: 2,
    status: "closed",
  },
  invariants: [{ id: "INV-01", check: "fixture", violations: 0 }],
  thresholds: {
    p95_ms: 250,
    p99_ms: 600,
    unexpected_error_rate: 0.01,
    passed: true,
  },
};
export const verification = {
  auction_id: "00000000-0000-4000-8000-000000000001",
  ...benchmark.auction,
  checks: benchmark.invariants,
};
export function summaryFixture() {
  const counter = (count: number, rate = 0) => ({
    type: "counter",
    contains: "default",
    values: { count, rate },
  });
  return {
    setup_data: {
      auctionId: verification.auction_id,
      cookies: [],
      startedAt: 1,
    },
    bench_config: {
      vus: 500,
      duration_s: 60,
      ramp_up_s: 10,
      ip_model: "per-vu-forwarded",
      auction: benchmark.config.auction,
    },
    metrics: {
      bid_requests: counter(10000, 160),
      replay_requests: counter(500),
      outcome_accepted: counter(1234),
      outcome_bid_too_low: counter(8766),
      bid_latency: {
        type: "trend",
        contains: "time",
        values: {
          avg: 15,
          min: 1,
          med: 10,
          "p(90)": 20,
          "p(95)": 25.123456,
          "p(99)": 100,
          max: 150,
        },
        thresholds: { "p(95)<250": { ok: true }, "p(99)<600": { ok: true } },
      },
      unexpected_errors: {
        type: "rate",
        contains: "default",
        values: { rate: 0, passes: 0, fails: 10000 },
        thresholds: { "rate<0.01": { ok: true } },
      },
      replay_mismatch: {
        ...counter(0),
        thresholds: { "count==0": { ok: true } },
      },
    },
  };
}
