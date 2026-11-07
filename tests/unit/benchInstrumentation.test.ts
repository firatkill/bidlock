import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";

function harness(env: Record<string, string> = {}) {
  const counts = new Map<string, number>();
  class Metric {
    constructor(private name: string) {}
    add(value: number) {
      counts.set(this.name, (counts.get(this.name) ?? 0) + value);
    }
  }
  let status = 201;
  const requests: string[] = [];
  const source = readFileSync("load/bid-storm.js", "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace("export default function", "function iteration")
    .replaceAll("export ", "");
  const api = runInNewContext(
    source + "\n({ iteration, handleSummary, options });",
    {
      __ENV: env,
      __VU: 1,
      Counter: Metric,
      Rate: Metric,
      Trend: Metric,
      Math: Object.assign(Object.create(Math) as object, { random: () => 0 }),
      http: {
        post: (_url: string, body: string) => {
          requests.push(body);
          return {
            status,
            timings: { duration: 1 },
            json: () =>
              status < 300
                ? { auction: { min_next_bid: 1000 } }
                : { error: { code: "RATE_LIMITED" } },
          };
        },
      },
      sleep: () => {},
      uuidv4: () => "fixture-key",
      textSummary: () => "",
    },
  ) as {
    iteration: (data: { auctionId: string; cookies: string[] }) => void;
    handleSummary: (data: object) => Record<string, string>;
    options: { thresholds: Record<string, string[]> };
  };
  return {
    api,
    counts,
    requests,
    setStatus: (value: number) => {
      status = value;
    },
  };
}
test("TC-267 D-79: count every sent replay even rate-limited/failed responses; keep mismatch threshold", () => {
  const h = harness();
  const data = { auctionId: "fixture", cookies: ["fixture"] };
  h.api.iteration(data);
  for (const status of [200, 429, 500, 0]) {
    h.setStatus(status);
    h.api.iteration(data);
  }
  expect(h.counts.get("bid_requests")).toBe(5);
  expect(h.counts.get("replay_requests")).toBe(4);
  expect(new Set(h.requests).size).toBe(1);
  expect(h.api.options.thresholds.replay_mismatch).toEqual(["count==0"]);
});
test("TC-267 D-79: summary metadata uses actual defaults and env configuration", () => {
  for (const [env, expected] of [
    [
      {},
      {
        vus: 500,
        duration_s: 60,
        ramp_up_s: 10,
        ip_model: "per-vu-forwarded",
        auction: {
          duration_s: 45,
          snipe_window_s: 10,
          extend_by_s: 10,
          max_extensions: 20,
        },
      },
    ],
    [
      { VUS: "73", DURATION: "1m30s", AUCTION_S: "32" },
      {
        vus: 73,
        duration_s: 90,
        ramp_up_s: 10,
        ip_model: "per-vu-forwarded",
        auction: {
          duration_s: 32,
          snipe_window_s: 10,
          extend_by_s: 10,
          max_extensions: 20,
        },
      },
    ],
  ] as const) {
    const output = harness(env).api.handleSummary({ metrics: {} });
    expect(JSON.parse(output["/out/k6-summary.json"] ?? "null")).toEqual({
      metrics: {},
      bench_config: expected,
    });
  }
});
