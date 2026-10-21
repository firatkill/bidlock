import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
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
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
          exclude: [
            "tests/unit/**/*.dom.test.ts",
            "tests/unit/**/*.dom.test.tsx",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: [
            "tests/unit/**/*.dom.test.ts",
            "tests/unit/**/*.dom.test.tsx",
          ],
          environment: "jsdom",
        },
      },
    ],
    coverage: { provider: "v8", include: ["src/domain/**", "src/server/**"] },
  },
});
