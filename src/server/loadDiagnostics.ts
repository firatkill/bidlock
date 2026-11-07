import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { env } from "./env";

type Phase = "getMe" | "check_bid_rate" | "place_bid" | "submit_bid";
const context = new AsyncLocalStorage<Partial<Record<Phase, number>>>();
const pending: Record<Phase, number> = {
  getMe: 0,
  check_bid_rate: 0,
  place_bid: 0,
  submit_bid: 0,
};
let started = false;
const enabled = () =>
  env().APP_ENV === "test" && env().LOAD_DIAGNOSTICS === "on";

function emit(value: Record<string, unknown>) {
  // Only caller-owned numeric measurements and fixed labels, never request/SQL data.
  process.stdout.write(
    JSON.stringify({ diagnostic: true, ts: Date.now(), ...value }) + "\n",
  );
}
function startMonitor() {
  if (started) return;
  started = true;
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let cpu = process.cpuUsage();
  let utilization = performance.eventLoopUtilization();
  setInterval(() => {
    const nextCpu = process.cpuUsage();
    const nextUtilization = performance.eventLoopUtilization();
    emit({
      kind: "event_loop",
      mean_ms: delay.count ? delay.mean / 1e6 : 0,
      p95_ms: delay.percentile(95) / 1e6,
      max_ms: delay.max / 1e6,
      utilization: performance.eventLoopUtilization(
        nextUtilization,
        utilization,
      ).utilization,
      cpu_user_us: nextCpu.user - cpu.user,
      cpu_system_us: nextCpu.system - cpu.system,
      pending: { ...pending },
    });
    delay.reset();
    cpu = nextCpu;
    utilization = nextUtilization;
  }, 1000).unref();
}

export async function measureLoadPhase<T>(
  phase: Phase,
  call: () => Promise<T>,
): Promise<T> {
  const timings = context.getStore();
  if (!timings) return call();
  const start = performance.now();
  pending[phase]++;
  try {
    return await call();
  } finally {
    timings[phase] = (timings[phase] ?? 0) + performance.now() - start;
    pending[phase]--;
  }
}

export function withLoadDiagnostics<A extends unknown[]>(
  name: string,
  handler: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    if (name !== "bids.create" || !enabled()) return handler(...args);
    startMonitor();
    const timings: Partial<Record<Phase, number>> = {};
    const start = performance.now();
    let status = 500;
    return context.run(timings, async () => {
      try {
        const response = await handler(...args);
        status = response.status;
        return response;
      } finally {
        emit({
          kind: "bid_request",
          status,
          total_ms: performance.now() - start,
          ...timings,
        });
      }
    });
  };
}
