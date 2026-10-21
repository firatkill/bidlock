import { AuctionList } from "@/domain/schemas";
import { json, route } from "@/server/http";
import { listAuctions } from "@/server/repo/auctions";
export const runtime = "nodejs";
export const GET = route(
  { name: "auctions.list", auth: "optional-session", mutating: false },
  async (ctx) =>
    json(AuctionList, await ctx.db(() => listAuctions(ctx.bidderId))),
);
