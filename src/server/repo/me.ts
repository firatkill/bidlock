import "server-only";
import { sql } from "../db";
import { jsonResult } from "./result";
import { Me, BidderCreated, BidderRenamed } from "@/domain/schemas";
export async function getMe(id: string) {
  return jsonResult(
    Me.nullable(),
    await sql`select bidlock.get_me(${id}) as result`,
  );
}
export async function createBidder(ipHash: string) {
  return jsonResult(
    BidderCreated,
    await sql`select bidlock.create_bidder(${ipHash}) as result`,
  );
}
export async function renameBidder(id: string, name: string) {
  return jsonResult(
    BidderRenamed,
    await sql`select bidlock.rename_bidder(${id},${name}) as result`,
  );
}
