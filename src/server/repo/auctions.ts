import "server-only";
import { sql } from "../db";
import { jsonResult } from "./result";
import { AuctionState, AuctionList, BidsPage } from "@/domain/schemas";
export async function auctionState(id: string, viewer: string | null) {
  return jsonResult(
    AuctionState.nullable(),
    await sql`select bidlock.auction_state(${id},${viewer}) as result`,
  );
}
export async function listAuctions(viewer: string | null) {
  return jsonResult(
    AuctionList,
    await sql`select bidlock.list_auctions(${viewer}) as result`,
  );
}
export async function listBids(
  id: string,
  viewer: string | null,
  cursor: number | null = null,
  after: number | null = null,
  limit = 20,
) {
  return jsonResult(
    BidsPage.nullable(),
    await sql`select bidlock.list_bids(${id},${viewer},${cursor},${after},${limit}) as result`,
  );
}
