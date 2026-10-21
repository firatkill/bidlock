import { z } from "zod";
import { Iso } from "@/domain/schemas";
import { json, route } from "@/server/http";
import { env } from "@/server/env";
import { healthTime } from "@/server/health";
export const runtime = "nodejs";
const Health = z
  .object({
    status: z.enum(["ok", "degraded"]),
    db: z.enum(["ok", "error"]),
    demo_mode: z.enum(["on", "readonly", "off"]),
    version: z.string(),
    server_now: Iso,
  })
  .strict();
export const GET = route(
  {
    name: "health",
    auth: "none",
    mutating: false,
    query: z.object({ db: z.literal("1").optional() }).strict(),
  },
  async (ctx) => {
    const common = {
      demo_mode: env().DEMO_MODE,
      version: env().VERCEL_GIT_COMMIT_SHA ?? env().GIT_SHA ?? "dev",
    };
    try {
      return json(Health, {
        ...common,
        status: "ok",
        db: "ok",
        server_now: await ctx.db(healthTime),
      });
    } catch {
      return json(
        Health,
        {
          ...common,
          status: "degraded",
          db: "error",
          server_now: new Date().toISOString(),
        },
        { status: 503 },
      );
    }
  },
);
