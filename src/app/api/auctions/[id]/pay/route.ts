import { z } from "zod";
import { AppError } from "@/domain/errors";
import { IdParams, PayAccepted } from "@/domain/schemas";
import { json, route } from "@/server/http";
import { payOffer } from "@/server/repo/bids";
export const runtime = "nodejs";
export const POST = route(
  {
    name: "auctions.pay",
    auth: "session-or-bot",
    mutating: true,
    params: IdParams,
    body: z.object({}).strict(),
  },
  async (ctx) => {
    if (!ctx.params || !ctx.bidderId) throw new AppError("INTERNAL");
    const id = ctx.params.id,
      bidder = ctx.bidderId;
    ctx.fields.auction_id = id;
    const result = await ctx.db(() => payOffer(id, bidder));
    ctx.fields.replayed = result.replayed;
    if (result.outcome === "rejected")
      throw new AppError(result.error_code ?? "INTERNAL");
    return json(
      PayAccepted,
      PayAccepted.parse({
        auction_id: result.auction_id,
        status: result.status,
        payment_state: result.payment_state,
        offer_rank: result.offer_rank,
        amount: result.amount,
        replayed: result.replayed,
        version: result.version,
        server_now: result.server_now,
      }),
    );
  },
);
