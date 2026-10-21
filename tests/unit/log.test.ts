import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { log } from "../../src/server/log";
import { resetEnvCacheForTests } from "../../src/server/env";
import { testEnv } from "../fixtures/env";
beforeEach(() => {
  for (const [key, value] of Object.entries(testEnv)) vi.stubEnv(key, value);
  resetEnvCacheForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
test("TC-006: one structured JSON line, nested redaction and metadata", () => {
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  log.info("request", {
    request_id: "test-request",
    cookie: "sensitive",
    nested: [
      {
        authorization: "sensitive",
        token: "sensitive",
        secret: "sensitive",
        password: "sensitive",
        ip: "sensitive",
        safe: "kept",
      },
    ],
  });
  expect(output).toHaveBeenCalledTimes(1);
  const raw = output.mock.calls[0]?.[0];
  expect(typeof raw).toBe("string");
  if (typeof raw !== "string") throw new Error("Expected string log");
  const row = z
    .object({
      ts: z.iso.datetime(),
      level: z.literal("info"),
      msg: z.literal("request"),
      request_id: z.literal("test-request"),
      nested: z.array(z.object({ safe: z.literal("kept") }).strict()),
    })
    .strict()
    .parse(JSON.parse(raw));
  expect(row.nested).toHaveLength(1);
  expect(raw.endsWith("\n")).toBe(true);
  expect(raw).not.toContain("sensitive");
});
test("TC-006: level filtering", () => {
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  vi.stubEnv("LOG_LEVEL", "warn");
  log.debug("hidden");
  log.info("hidden");
  log.warn("visible");
  log.error("visible");
  expect(output).toHaveBeenCalledTimes(2);
});
