import { AuctionState, IdParams } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { auctionState } from "@/server/repo/auctions";
export const runtime = "nodejs";
export const GET = route(
  {
    name: "auctions.state",
    auth: "optional-session",
    mutating: false,
    params: IdParams,
  },
  async (ctx) => {
    if (!ctx.params) throw new AppError("INTERNAL");
    const id = ctx.params.id;
    ctx.fields.auction_id = id;
    const state = await ctx.db(() => auctionState(id, ctx.bidderId));
    if (!state) throw new AppError("NOT_FOUND");
    const etag = `W/"${String(state.version)}.${state.next_public_auction_id?.slice(0, 8) ?? "0"}"`;
    if (ctx.req.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers: { etag } });
    return json(AuctionState, state, { headers: { etag } });
  },
);
