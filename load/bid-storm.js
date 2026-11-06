import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

const BASE = __ENV.BASE_URL || "http://app:3000";
const SECRET = __ENV.TEST_API_SECRET;
const VUS = Number(__ENV.VUS || 500);
const DURATION = __ENV.DURATION || "60s";
const AUCTION_S = Number(__ENV.AUCTION_S || 45);
const AUCTION = {
  duration_s: AUCTION_S,
  snipe_window_s: 10,
  extend_by_s: 12,
  max_extensions: 20,
};
const ORIGIN = __ENV.APP_ORIGIN || BASE;
const EXPECTED = new Set([
  "BID_TOO_LOW",
  "ALREADY_LEADING",
  "AUCTION_CLOSED",
  "RATE_LIMITED",
]);

const bidLatency = new Trend("bid_latency", true);
const unexpected = new Rate("unexpected_errors");
const bidRequests = new Counter("bid_requests");
const replayRequests = new Counter("replay_requests");
const replayMismatch = new Counter("replay_mismatch");
const outcomes = {
  accepted: new Counter("outcome_accepted"),
  BID_TOO_LOW: new Counter("outcome_bid_too_low"),
  ALREADY_LEADING: new Counter("outcome_already_leading"),
  AUCTION_CLOSED: new Counter("outcome_auction_closed"),
  RATE_LIMITED: new Counter("outcome_rate_limited"),
  OTHER: new Counter("outcome_other"),
};

export const options = {
  setupTimeout: "180s",
  scenarios: {
    storm: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "10s",
    },
  },
  thresholds: {
    bid_latency: ["p(95)<250", "p(99)<600"],
    unexpected_errors: ["rate<0.01"],
    replay_mismatch: ["count==0"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  // Bidders first: creating 500 guests takes seconds, and the auction clock must not run meanwhile.
  const cookies = [];
  for (let i = 0; i < VUS; i++) {
    const r = http.get(`${BASE}/api/me`, { jar: new http.CookieJar() }); // fresh jar => new bidder each time
    const c = r.cookies.bl_sid && r.cookies.bl_sid[0];
    if (!c) throw new Error(`no cookie for bidder ${i}: ${r.status}`);
    cookies.push(`bl_sid=${c.value}`);
  }
  const a = http.post(
    `${BASE}/api/test/auctions`,
    JSON.stringify({
      ...AUCTION,
      starting_price: 1000,
    }),
    {
      headers: { "content-type": "application/json", "x-test-secret": SECRET },
    },
  );
  if (a.status !== 201)
    throw new Error(`test auction not created: ${a.status} ${a.body}`);
  const auctionId = a.json("auction_id");
  return { auctionId, cookies, startedAt: Date.now() };
}

let state = { min: 1000, inc: 100, last: null, closed: false }; // per VU

export default function (data) {
  if (state.closed) {
    sleep(1);
    return;
  }
  const headers = {
    "content-type": "application/json",
    origin: ORIGIN,
    cookie: data.cookies[__VU - 1],
  };
  const replay = state.last && Math.random() < 0.05;
  const body = replay
    ? state.last.body
    : {
        amount: state.min + state.inc * Math.floor(Math.random() * 3),
        idempotency_key: uuidv4(),
      };
  const res = http.post(
    `${BASE}/api/auctions/${data.auctionId}/bids`,
    JSON.stringify(body),
    { headers, tags: { name: "bid" } },
  );
  bidRequests.add(1);
  replayRequests.add(replay ? 1 : 0); // Every reused-key request, regardless of response.
  bidLatency.add(res.timings.duration);

  let code = null;
  if (res.status === 200 || res.status === 201) {
    const j = safeJson(res) || { auction: { min_next_bid: state.min } };
    outcomes.accepted.add(1);
    state.min = j.auction.min_next_bid;
  } else {
    const j = safeJson(res) || {};
    code = j.error && j.error.code;
    (outcomes[code] || outcomes.OTHER).add(1);
    const d = (j.error && j.error.details) || {};
    if (d.min_next_bid) state.min = d.min_next_bid;
    if (code === "AUCTION_CLOSED") state.closed = true;
  }
  unexpected.add(!(res.status < 300 || EXPECTED.has(code)));

  // Only stored outcomes are replayable (D-09): accepted and rule rejections. RATE_LIMITED, network
  // errors (status 0) and 5xx are never stored, so they are neither recorded as "last" nor compared.
  const stored =
    res.status !== 0 && res.status < 500 && code !== "RATE_LIMITED";
  if (replay) {
    if (stored) {
      const sameOutcome =
        res.status < 300 === state.last.status < 300 &&
        code === state.last.code;
      if (!sameOutcome) replayMismatch.add(1);
    }
  } else if (stored) {
    state.last = { body, status: res.status, code };
  }
  // increment for the next attempt: ask the server's ladder via the response when available
  state.inc = incrementFor(state.min);
  sleep(0.35 + Math.random() * 0.6); // ~1.5 req/s per VU, under the 3/s burst limit
}

function safeJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  } // network errors have no body
}

function incrementFor(p) {
  // copy of the ladder for amount generation only
  const bands = [
    [500000, 25000],
    [250000, 10000],
    [100000, 5000],
    [50000, 2500],
    [25000, 1000],
    [10000, 500],
    [5000, 200],
    [1000, 100],
    [0, 50],
  ];
  for (const [lb, inc] of bands) if (p >= lb) return inc;
  return 50;
}

// k6 duration syntax; retain configured time, not elapsed time including graceful stop.
function durationSeconds(value) {
  const units = {
    ns: 1e-9,
    us: 1e-6,
    µs: 1e-6,
    ms: 0.001,
    s: 1,
    m: 60,
    h: 3600,
  };
  const parts = [...value.matchAll(/(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g)];
  if (!parts.length || parts.map(([part]) => part).join("") !== value)
    throw new Error("Invalid benchmark duration");
  return parts.reduce(
    (seconds, [, amount, unit]) => seconds + Number(amount) * units[unit],
    0,
  );
}

export function handleSummary(data) {
  const summary = {
    ...data,
    bench_config: {
      vus: VUS,
      duration_s: durationSeconds(DURATION),
      auction: AUCTION,
    },
  };
  return {
    "/out/k6-summary.json": JSON.stringify(summary, null, 2),
    stdout: textSummary(data),
  };
}
