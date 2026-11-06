import { afterEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readBenchmark } from "@/server/benchmark";
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
afterEach(() => vi.resetAllMocks());
test("TC-247 missing benchmark resolves to empty; invalid existing data is rejected", () => {
  vi.mocked(readFileSync).mockImplementation(() => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  });
  expect(readBenchmark()).toEqual({ schema: 1, empty: true });
  vi.mocked(readFileSync).mockReturnValue('{"schema":1,"empty":true}');
  expect(readBenchmark()).toEqual({ schema: 1, empty: true });
  vi.mocked(readFileSync).mockReturnValue('{"unexpected":true}');
  expect(() => readBenchmark()).toThrow();
});
