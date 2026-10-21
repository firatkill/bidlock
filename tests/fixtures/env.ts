export const testEnv = {
  APP_ENV: "test",
  DATABASE_URL:
    "postgres://bidlock_app:bidlock_app@localhost:54329/bidlock_test",
  DB_POOL_MAX: "10",
  SESSION_SECRET: "test-session-placeholder-0123456789abcdef",
  BOT_TOKEN_SECRET: "test-bot-placeholder-0123456789abcdef0123",
  IP_HASH_SALT: "test-salt-placeholder",
  DEMO_MODE: "on",
  APP_ORIGIN: "http://localhost:3000",
  TRUST_PROXY: "none",
  TEST_API_SECRET: "test-placeholder",
  LOG_LEVEL: "info",
} as const;
