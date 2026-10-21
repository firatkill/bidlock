import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
export default defineConfig([
  ...nextVitals,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react/no-danger": "error",
    },
  },
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-console": "error" } },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{6}/]",
          message: "Use design tokens from globals.css instead of hex colors.",
        },
      ],
    },
  },
  {
    files: ["src/server/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/client/*",
            "@/components/*",
            "**/client/**",
            "**/components/**",
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/server/*",
            "@/client/*",
            "**/server/**",
            "**/client/**",
            "react",
            "react/*",
            "next",
            "next/*",
            "postgres",
            "node:*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/client/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/server/*",
            "**/server/**",
            "postgres",
            "node:*",
            "server-only",
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/client/*",
            "@/components/*",
            "**/client/**",
            "**/components/**",
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "next-env.d.ts",
    "bench/out/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
