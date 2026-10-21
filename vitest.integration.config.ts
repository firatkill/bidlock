import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testEnv } from "./tests/fixtures/env";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.int.test.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 60_000,
    env: {
      ...testEnv,
      DATABASE_URL: process.env.DATABASE_URL ?? testEnv.DATABASE_URL,
      DATABASE_URL_ADMIN:
        process.env.DATABASE_URL_ADMIN ??
        "postgres://postgres:postgres@localhost:54329/bidlock_test",
    },
  },
});
