import { z } from "zod";
import { SandboxCreated } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { env } from "@/server/env";
import { getClientIp, ipHash } from "@/server/ip";
import { createSandbox } from "@/server/repo/sandboxes";
export const runtime = "nodejs";
export const POST = route(
  {
    name: "sandboxes.create",
    auth: "session",
    mutating: true,
    body: z.object({}).strict(),
  },
  async (ctx) => {
    const owner = ctx.bidderId;
    if (!owner) throw new AppError("INTERNAL");
    const config = env();
    const result = await ctx.db(() =>
      createSandbox(
        owner,
        ipHash(getClientIp(ctx.req)),
        config.APP_ENV === "test" ? (config.BOT_SEED_OVERRIDE ?? null) : null,
      ),
    );
    const details = () =>
      SandboxCreated.parse({
        sandbox_id: result.sandbox_id,
        auction_id: result.auction_id,
        expires_at: result.expires_at,
        bot_seed: result.bot_seed,
      });
    if (result.outcome === "rejected") {
      throw new AppError(
        result.error_code ?? "INTERNAL",
        result.error_code === "SANDBOX_EXISTS"
          ? details()
          : result.error_code === "RATE_LIMITED"
            ? { retry_after_ms: result.retry_after_ms }
            : undefined,
      );
    }
    return json(SandboxCreated, details(), { status: 201 });
  },
);
