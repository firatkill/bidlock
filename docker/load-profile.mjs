// Compose-only preload. Never imports application code or emits request/query values.
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

if (process.env.LOAD_PROFILE === "on" && process.env.APP_ENV === "test") {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let active = true;
  let cpu = process.cpuUsage();
  let previous = performance.now();
  let elu = performance.eventLoopUtilization();
  let queued = 0;
  let running = 0;
  let counts = { dispatches: 0, completions: 0, enqueue_ms: 0, service_ms: 0 };
  let hooked = false;
  let sql;
  const seen = new WeakSet();
  Object.defineProperty(globalThis, "__bidlockSql", {
    configurable: true,
    get: () => sql,
    set(value) {
      sql = value;
      if (hooked) return;
      // postgres.js 3.4.9: handle starts the lazy query; state is assigned at
      // connection.execute entry. Includes connection setup/scheduling, not pure pool queue.
      const prototype = Object.getPrototypeOf(value``);
      const handle = prototype.handle;
      if (typeof handle !== "function") return;
      hooked = true;
      prototype.handle = function (...args) {
        if (active && !seen.has(this)) {
          seen.add(this);
          const start = performance.now();
          let dispatched;
          let state = this.state;
          let completed = false;
          queued++;
          Object.defineProperty(this, "state", {
            configurable: true,
            get: () => state,
            set(next) {
              state = next;
              if (dispatched === undefined) {
                dispatched = performance.now();
                queued--;
                running++;
                counts.dispatches++;
                counts.enqueue_ms += dispatched - start;
              }
            },
          });
          for (const name of ["resolve", "reject"]) {
            const finish = this[name];
            this[name] = function (...values) {
              if (!completed) {
                completed = true;
                if (dispatched === undefined) queued--;
                else {
                  running--;
                  counts.completions++;
                  counts.service_ms += performance.now() - dispatched;
                }
              }
              return finish.apply(this, values);
            };
          }
        }
        return handle.apply(this, args);
      };
    },
  });
  const timer = setInterval(() => {
    const now = performance.now();
    const nextCpu = process.cpuUsage();
    const nextElu = performance.eventLoopUtilization();
    process.stdout.write(
      JSON.stringify({
        load_profile: true,
        ts: Date.now(),
        cpu_percent:
          ((nextCpu.user - cpu.user + nextCpu.system - cpu.system) /
            1000 /
            (now - previous)) *
          100,
        elu: performance.eventLoopUtilization(nextElu, elu).utilization,
        delay_p95_ms: delay.percentile(95) / 1e6,
        delay_max_ms: delay.max / 1e6,
        pool_hooked: hooked,
        queued,
        running,
        ...counts,
      }) + "\n",
    );
    cpu = nextCpu;
    previous = now;
    elu = nextElu;
    counts = { dispatches: 0, completions: 0, enqueue_ms: 0, service_ms: 0 };
    delay.reset();
  }, 1000);
  timer.unref();
  setTimeout(() => {
    active = false;
    clearInterval(timer);
    delay.disable();
  }, 180000).unref();
}
