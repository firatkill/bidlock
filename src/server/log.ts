import "server-only";
import { env } from "./env";
const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof levels;
const sensitive = new Set([
  "cookie",
  "authorization",
  "token",
  "secret",
  "password",
  "ip",
]);
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => redact(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitive.has(key.toLowerCase()))
        .map(([key, item]: [string, unknown]) => [key, redact(item)]),
    );
  }
  return value;
}
function write(
  level: Level,
  msg: string,
  fields: Record<string, unknown> = {},
): void {
  if (levels[level] < levels[env().LOG_LEVEL]) return;
  const safe = redact(fields);
  process.stdout.write(
    JSON.stringify({
      ...(typeof safe === "object" && safe !== null ? safe : {}),
      ts: new Date().toISOString(),
      level,
      msg,
    }) + "\n",
  );
}
export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => {
    write("debug", msg, fields);
  },
  info: (msg: string, fields?: Record<string, unknown>) => {
    write("info", msg, fields);
  },
  warn: (msg: string, fields?: Record<string, unknown>) => {
    write("warn", msg, fields);
  },
  error: (msg: string, fields?: Record<string, unknown>) => {
    write("error", msg, fields);
  },
};
