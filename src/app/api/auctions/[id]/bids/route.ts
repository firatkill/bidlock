import { BidsPage, BidsQuery, IdParams } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { listBids } from "@/server/repo/auctions";
export const runtime = "nodejs";
export const GET = route(
  {
    name: "bids.list",
    auth: "optional-session",
    mutating: false,
    params: IdParams,
    query: BidsQuery,
  },
  async (ctx) => {
    if (!ctx.params || !ctx.query) throw new AppError("INTERNAL");
    const id = ctx.params.id;
    const query = ctx.query;
    ctx.fields.auction_id = id;
    const page = await ctx.db(() =>
      listBids(
        id,
        ctx.bidderId,
        query.cursor ?? null,
        query.after ?? null,
        query.limit,
      ),
    );
    if (!page) throw new AppError("NOT_FOUND");
    return json(BidsPage, page);
  },
);
