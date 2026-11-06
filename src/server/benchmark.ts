import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BenchResult } from "@/domain/schemas";
export function readBenchmark() {
  try {
    const json: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "bench/results/latest.json"), "utf8"),
    );
    return BenchResult.parse(json);
  } catch (reason) {
    if (reason instanceof Error && "code" in reason && reason.code === "ENOENT")
      return BenchResult.parse({ schema: 1, empty: true });
    throw reason;
  }
}
