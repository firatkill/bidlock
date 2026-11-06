import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

// Execute the workload with an in-memory k6 adapter: no network traffic.
// Expected behavior comes from LOAD-01 / TRD §15.6.2, not a second implementation.
const source = readFileSync("load/bid-storm.js", "utf8")
  .replace(/^import .*;$/gm, "")
  .replace("export default function", "function iteration")
  .replace(/export /g, "");
interface Setup {
  auctionId: string;
  cookies: string[];
  startedAt: number;
}
interface Workload {
  setup: () => Setup;
  iteration: (data: Setup) => void;
  options: {
    scenarios: { storm: { vus: number; duration: string; executor: string } };
    thresholds: Record<string, string[]>;
  };
  state: {
    last: { body: unknown; code: string | null } | null;
    closed: boolean;
  };
  handleSummary: (data: unknown) => Record<string, string>;
}
function harness(env: Record<string, string> = {}) {
  const samples: Record<string, unknown[]> = {};
  class Metric {
    constructor(private name: string) {
      samples[name] = [];
    }
    add(value: unknown) {
      samples[this.name]?.push(value);
    }
  }
  const http = {
    CookieJar: Object,
    get: vi.fn<(url: string, options: { jar: object }) => unknown>(),
    post: vi.fn<(url: string, body: string, options: unknown) => unknown>(),
  };
  const sleep = vi.fn();
  const random = vi.fn(() => 0.5);
  const workload = runInNewContext(
    `${source}\n({ setup, iteration, options, state, handleSummary })`,
    {
      http,
      sleep,
      Counter: Metric,
      Rate: Metric,
      Trend: Metric,
      uuidv4: () => "test-idempotency-key",
      textSummary: () => "summary",
      __ENV: env,
      __VU: 1,
      Math: { random, floor: Math.floor },
    },
  ) as Workload;
  return { ...workload, http, sleep, random, samples };
}
const data: Setup = {
  auctionId: "test-auction",
  cookies: ["bl_sid=test-session"],
  startedAt: 0,
};
function response(status: number, code?: string) {
  return {
    status,
    timings: { duration: 10 },
    json: () =>
      code
        ? { error: { code, details: { min_next_bid: 1200 } } }
        : { auction: { min_next_bid: 1200 } },
  };
}

test("TC-260 / TC-263: specified defaults, overrides and thresholds", () => {
  const h = harness();
  expect(h.options.scenarios.storm).toMatchObject({
    executor: "constant-vus",
    vus: 500,
    duration: "60s",
  });
  expect(h.options.thresholds).toEqual({
    bid_latency: ["p(95)<250", "p(99)<600"],
    unexpected_errors: ["rate<0.01"],
    replay_mismatch: ["count==0"],
  });
  expect(
    harness({ VUS: "50", DURATION: "15s" }).options.scenarios.storm,
  ).toMatchObject({ vus: 50, duration: "15s" });
});

test("TC-261: fresh cookie jar per bidder before creating auction; summary retains setup data", () => {
  const h = harness({
    VUS: "2",
    AUCTION_S: "8",
    TEST_API_SECRET: "fixture-secret",
  });
  h.http.get
    .mockImplementationOnce(() => ({ cookies: { bl_sid: [{ value: "one" }] } }))
    .mockImplementationOnce(() => ({
      cookies: { bl_sid: [{ value: "two" }] },
    }));
  h.http.post.mockReturnValue({ status: 201, json: () => "test-auction" });
  const setup = h.setup();
  expect(setup.cookies).toEqual(["bl_sid=one", "bl_sid=two"]);
  expect(h.http.get.mock.calls[0]?.[1].jar).not.toBe(
    h.http.get.mock.calls[1]?.[1].jar,
  );
  expect(h.http.get.mock.invocationCallOrder[1]).toBeLessThan(
    h.http.post.mock.invocationCallOrder[0] ?? 0,
  );
  expect(h.http.post).toHaveBeenCalledWith(
    "http://app:3000/api/test/auctions",
    JSON.stringify({
      duration_s: 8,
      starting_price: 1000,
      snipe_window_s: 10,
      extend_by_s: 12,
      max_extensions: 20,
    }),
    {
      headers: {
        "content-type": "application/json",
        "x-test-secret": "fixture-secret",
      },
    },
  );
  expect(
    JSON.parse(
      h.handleSummary({ setup_data: setup })["/out/k6-summary.json"] ?? "null",
    ),
  ).toMatchObject({ setup_data: { auctionId: "test-auction" } });
});

test.each(["BID_TOO_LOW", "ALREADY_LEADING", "AUCTION_CLOSED", "RATE_LIMITED"])(
  "TC-262: %s is an expected rejection",
  (code) => {
    const h = harness();
    h.http.post.mockReturnValue(response(409, code));
    h.iteration(data);
    expect(h.samples.unexpected_errors).toEqual([false]);
    expect(h.samples[`outcome_${code.toLowerCase()}`]).toEqual([1]);
  },
);

test.each([
  [0, undefined],
  [500, "INTERNAL_ERROR"],
  [429, "RATE_LIMITED"],
] as const)(
  "TC-262: response %s / %s is never retained for replay",
  (status, code) => {
    const h = harness();
    h.http.post.mockReturnValue(response(status, code));
    h.iteration(data);
    expect(h.state.last).toBeNull();
  },
);

test("TC-262: stored outcome reuses body and detects changed replay outcome", () => {
  const h = harness();
  h.http.post.mockReturnValue(response(201));
  h.iteration(data);
  h.random.mockReturnValue(0);
  h.iteration(data);
  expect(h.http.post.mock.calls[1]?.[1]).toBe(h.http.post.mock.calls[0]?.[1]);
  expect(h.samples.replay_mismatch).toEqual([]);
  h.http.post.mockReturnValue(response(409, "BID_TOO_LOW"));
  h.iteration(data);
  expect(h.samples.replay_mismatch).toEqual([1]);
  expect(h.http.post.mock.calls[0]?.[2]).toMatchObject({
    headers: { origin: "http://app:3000", cookie: data.cookies[0] },
    tags: { name: "bid" },
  });
});

test("TC-264: closed VU idles without another bid", () => {
  const h = harness();
  h.http.post.mockReturnValue(response(409, "AUCTION_CLOSED"));
  h.iteration(data);
  h.iteration(data);
  expect(h.http.post).toHaveBeenCalledTimes(1);
  expect(h.sleep).toHaveBeenLastCalledWith(1);
});
