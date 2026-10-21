import { z } from "zod";
import { AppError } from "@/domain/errors";
import { Me } from "@/domain/schemas";
import { normalizeName, validateName } from "@/domain/names";
import { json, route } from "@/server/http";
import { createBidder, getMe, renameBidder } from "@/server/repo/me";
import { getClientIp, ipHash } from "@/server/ip";
import { readSession, sessionCookie } from "@/server/session";
export const runtime = "nodejs";
export const GET = route(
  { name: "me.get", auth: "none", mutating: false },
  async (ctx) => {
    const session = readSession(ctx.req);
    if (session) {
      const me = await ctx.db(() => getMe(session.bidderId));
      if (me) {
        ctx.fields.bidder_id = me.id;
        return json(
          Me,
          me,
          session.renew
            ? { headers: { "set-cookie": sessionCookie(me.id) } }
            : undefined,
        );
      }
    }
    const created = await ctx.db(() =>
      createBidder(ipHash(getClientIp(ctx.req))),
    );
    if (created.outcome === "rejected")
      throw new AppError("RATE_LIMITED", {
        retry_after_ms: created.retry_after_ms,
      });
    const me = await ctx.db(() => getMe(created.bidder_id));
    if (!me) throw new AppError("INTERNAL");
    ctx.fields.bidder_id = me.id;
    return json(Me, me, { headers: { "set-cookie": sessionCookie(me.id) } });
  },
);
export const PATCH = route(
  {
    name: "me.rename",
    auth: "session",
    mutating: true,
    body: z.object({ display_name: z.string() }).strict(),
  },
  async (ctx) => {
    if (!ctx.bidderId || !ctx.body) throw new AppError("INTERNAL");
    const name = normalizeName(ctx.body.display_name);
    const reason = validateName(name);
    if (reason) throw new AppError("NAME_INVALID", { reason });
    const id = ctx.bidderId;
    const result = await ctx.db(() => renameBidder(id, name));
    if (result.outcome === "rejected") throw new AppError(result.error_code);
    const me = await ctx.db(() => getMe(id));
    if (!me) throw new AppError("NOT_FOUND");
    return json(Me, me);
  },
);
