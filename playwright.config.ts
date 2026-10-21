import { defineConfig, devices } from "@playwright/test";
const PORT = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 3000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "parallel",
      grepInvert: /@isolated/,
      fullyParallel: true,
      workers: 4,
    },
    {
      name: "isolated",
      grep: /@isolated/,
      dependencies: ["parallel"],
      fullyParallel: false,
      workers: 1,
    },
  ],
  webServer: {
    command: `pnpm start --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_ENV: "test",
      DEMO_MODE: "on",
      APP_ORIGIN: `http://localhost:${String(PORT)}`,
      TRUST_PROXY: "none",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123",
      BOT_TOKEN_SECRET: "e2e-bot-secret-0123456789abcdef01234567",
      IP_HASH_SALT: "e2e-ip-salt-0123456789",
      TEST_API_SECRET: "e2e-test-secret",
      BOT_SEED_OVERRIDE: "42",
      DB_POOL_MAX: "10",
    },
  },
});
