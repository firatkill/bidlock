import {
  BidsPage,
  BidsQuery,
  IdParams,
  PlaceBidBody,
  BidAccepted,
  BidRejectionDetails,
} from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { listBids } from "@/server/repo/auctions";
import { placeBid } from "@/server/repo/bids";
import { checkBidRate } from "@/server/repo/rate";
import { getClientIp, ipHash } from "@/server/ip";
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

export const POST = route(
  {
    name: "bids.create",
    auth: "session-or-bot",
    mutating: true,
    params: IdParams,
    body: PlaceBidBody,
  },
  async (ctx) => {
    if (!ctx.params || !ctx.body || !ctx.bidderId)
      throw new AppError("INTERNAL");
    const id = ctx.params.id,
      bidder = ctx.bidderId,
      body = ctx.body;
    ctx.fields.auction_id = id;
    const retry = await ctx.db(() =>
      checkBidRate(bidder, ipHash(getClientIp(ctx.req))),
    );
    if (retry > 0)
      throw new AppError("RATE_LIMITED", { retry_after_ms: retry });
    const result = await ctx.db(() =>
      placeBid(id, bidder, body.amount, body.idempotency_key),
    );
    ctx.fields.replayed = result.replayed;
    if (result.outcome === "rejected")
      throw new AppError(
        result.error_code ?? "INTERNAL",
        BidRejectionDetails.parse({
          min_next_bid: result.min_next_bid,
          max_bid: result.max_bid,
          current_price: result.current_price,
          leader_bidder_id: result.leader_bidder_id,
          status: result.status,
          ends_at: result.ends_at,
          version: result.version,
          replayed: result.replayed,
          server_now: result.server_now,
        }),
      );
    const accepted = BidAccepted.parse({
      bid: {
        id: result.bid_id,
        bid_no: result.bid_no,
        amount: result.amount,
        placed_at: result.placed_at,
      },
      auction: {
        id: result.auction_id,
        status: result.status,
        current_price: result.current_price,
        leader_bidder_id: result.leader_bidder_id,
        min_next_bid: result.min_next_bid,
        max_bid: result.max_bid,
        ends_at: result.ends_at,
        extended: result.extended,
        extension_count: result.extension_count,
        version: result.version,
      },
      replayed: result.replayed,
      server_now: result.server_now,
    });
    return json(BidAccepted, accepted, {
      status: result.replayed ? 200 : 201,
      ...(result.replayed
        ? { headers: { "Idempotent-Replayed": "true" } }
        : {}),
    });
  },
);
