import { z } from "zod";
import { Id, BotTokens } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { signBotToken } from "@/server/botTokens";
import { sandboxBots } from "@/server/repo/sandboxes";
export const runtime = "nodejs";
export const POST = route(
  {
    name: "bot-tokens.create",
    auth: "session",
    mutating: true,
    body: z.object({ sandbox_id: Id }).strict(),
  },
  async (ctx) => {
    const owner = ctx.bidderId,
      id = ctx.body?.sandbox_id;
    if (!owner || !id) throw new AppError("INTERNAL");
    const sandbox = await ctx.db(() => sandboxBots(owner, id));
    if (!sandbox) throw new AppError("NOT_FOUND");
    const now = Math.floor(Date.now() / 1000);
    return json(BotTokens, {
      auction_id: sandbox.auction_id,
      bot_seed: sandbox.bot_seed,
      expires_at: sandbox.expires_at,
      bots: sandbox.bots.map((bot) => ({
        ...bot,
        token: signBotToken(
          { sub: bot.id, aid: sandbox.auction_id, sid: id, own: owner },
          sandbox.expires_at,
          now,
        ),
      })),
    });
  },
);
