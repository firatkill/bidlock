import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

const source = readFileSync("docker/load-profile.mjs", "utf8").replace(
  /^import .*;$/gm,
  "",
);
function harness(enabled = true) {
  let now = 0;
  let tick: (() => void) | undefined;
  let stop: (() => void) | undefined;
  const write = vi.fn();
  const context = {
    process: {
      env: { LOAD_PROFILE: enabled ? "on" : "off", APP_ENV: "test" },
      cpuUsage: () => ({ user: now * 500, system: 0 }),
      stdout: { write },
    },
    performance: {
      now: () => now,
      eventLoopUtilization: () => ({ utilization: 0.9 }),
    },
    monitorEventLoopDelay: () => ({
      enable() {},
      disable() {},
      reset() {},
      percentile: () => 20000000,
      max: 21000000,
    }),
    setInterval: (fn: () => void, ms: number) => {
      expect(ms).toBe(1000);
      tick = fn;
      return { unref() {} };
    },
    setTimeout: (fn: () => void, ms: number) => {
      expect(ms).toBe(180000);
      stop = fn;
      return { unref() {} };
    },
    clearInterval: vi.fn(),
    __bidlockSql: undefined as unknown,
  };
  runInNewContext(source, context);
  class Query {
    state: unknown = null;
    resolve = vi.fn();
    reject = vi.fn();
    handle() {
      return "unchanged";
    }
  }
  context.__bidlockSql = () => new Query();
  return {
    context,
    Query,
    write,
    tick: () => tick?.(),
    stop: () => stop?.(),
    time: (n: number) => {
      now = n;
    },
  };
}
test("TC-283: profiling is off by default and emits nothing", () => {
  const h = harness(false);
  h.tick();
  expect(h.write).not.toHaveBeenCalled();
});
test("TC-283: bounded numeric profiling preserves dispatch and completion semantics", () => {
  const h = harness();
  const q = new h.Query();
  expect(q.handle()).toBe("unchanged");
  h.time(30);
  q.state = { private: "never emitted" };
  h.time(50);
  q.resolve("secret");
  h.time(1000);
  h.tick();
  expect(q.resolve).toBeTypeOf("function");
  const output = String(h.write.mock.calls[0]?.[0]);
  expect(output).not.toContain("secret");
  expect(output).not.toContain("private");
  expect(JSON.parse(output)).toMatchObject({
    load_profile: true,
    pool_hooked: true,
    dispatches: 1,
    completions: 1,
    enqueue_ms: 30,
    service_ms: 20,
    queued: 0,
    running: 0,
    cpu_percent: 50,
  });
  h.stop();
  const after = new h.Query();
  after.handle();
  after.state = {};
  expect(h.context.clearInterval).toHaveBeenCalledTimes(1);
});
