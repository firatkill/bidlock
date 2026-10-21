import "server-only";
import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional(),
);
const origin = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  }, "Expected an HTTP(S) origin without a path, credentials, query or fragment")
  .transform((value) => new URL(value).origin);
const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z
      .url()
      .refine(
        (value) => /^(postgres|postgresql):\/\//.test(value),
        "Expected a PostgreSQL URL",
      ),
    DB_POOL_MAX: z.coerce.number().int().positive(),
    SESSION_SECRET: z.string().min(32),
    SESSION_SECRET_PREVIOUS: optionalSecret,
    BOT_TOKEN_SECRET: z.string().min(32),
    IP_HASH_SALT: z.string().min(16),
    DEMO_MODE: z.enum(["on", "readonly", "off"]),
    APP_ORIGIN: z
      .string()
      .transform((value) => value.split(",").map((item) => item.trim()))
      .pipe(z.array(origin).min(1)),
    TRUST_PROXY: z.enum(["none", "vercel"]),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    TEST_API_SECRET: z.string().min(8).optional(),
    BOT_SEED_OVERRIDE: z.coerce.number().int().optional(),
    VERCEL_GIT_COMMIT_SHA: z.string().optional(),
    GIT_SHA: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.APP_ENV === "production") {
      for (const key of ["TEST_API_SECRET", "BOT_SEED_OVERRIDE"] as const) {
        if (value[key] !== undefined)
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Test variables must be unset in production",
          });
      }
    }
    if (value.APP_ENV === "test" && value.TEST_API_SECRET === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["TEST_API_SECRET"],
        message: "Required in test",
      });
  });
export type Env = z.infer<typeof schema>;
let cached: Env | undefined;
export function env(): Env {
  if (cached) return cached;
  // Select only this module's variables; unrelated OS variables are not app configuration.
  const input = Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, process.env[key]]),
  );
  cached = schema.parse(input);
  return cached;
}
export function resetEnvCacheForTests(): void {
  if (!process.env.VITEST)
    throw new Error("Environment cache reset is test-only");
  cached = undefined;
}
