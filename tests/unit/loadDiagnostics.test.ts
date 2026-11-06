import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { testEnv } from "../fixtures/env";
import { env, resetEnvCacheForTests } from "../../src/server/env";
import {
  measureLoadPhase,
  withLoadDiagnostics,
} from "../../src/server/loadDiagnostics";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});
function configure(on: boolean) {
  for (const [key, value] of Object.entries(testEnv)) vi.stubEnv(key, value);
  vi.stubEnv("LOAD_DIAGNOSTICS", on ? "on" : undefined);
  resetEnvCacheForTests();
}
test("TC-276: diagnostics default off and reject non-test activation", async () => {
  configure(false);
  expect(env().LOAD_DIAGNOSTICS).toBe("off");
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  await withLoadDiagnostics("bids.create", () =>
    Promise.resolve(new Response()),
  )();
  expect(output).not.toHaveBeenCalled();
  vi.stubEnv("LOAD_DIAGNOSTICS", "on");
  vi.stubEnv("APP_ENV", "development");
  resetEnvCacheForTests();
  expect(() => env()).toThrow("Load diagnostics require test mode");
});
test("TC-276: phase timings survive failures without recording request data", async () => {
  configure(true);
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  await expect(
    withLoadDiagnostics("bids.create", async (secret: string) => {
      await measureLoadPhase("getMe", () => Promise.resolve(1));
      await measureLoadPhase("check_bid_rate", () => Promise.resolve(0));
      return measureLoadPhase("place_bid", (): Promise<Response> =>
        Promise.reject(new Error(secret)),
      );
    })("private-cookie-and-sql-parameters"),
  ).rejects.toThrow("private-cookie");
  expect(output).toHaveBeenCalledTimes(1);
  const text = String(output.mock.calls[0]?.[0]);
  expect(text).not.toContain("private-cookie");
  const parsed: unknown = JSON.parse(text);
  expect(() =>
    z
      .object({
        diagnostic: z.literal(true),
        ts: z.number(),
        kind: z.literal("bid_request"),
        status: z.literal(500),
        total_ms: z.number().nonnegative(),
        getMe: z.number().nonnegative(),
        check_bid_rate: z.number().nonnegative(),
        place_bid: z.number().nonnegative(),
      })
      .strict()
      .parse(parsed),
  ).not.toThrow();
});
