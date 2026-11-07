import "server-only";
import { sql } from "../db";
import { row, jsonResult } from "./result";
import { BidResultRow, PayResultRow, SubmitBidResult } from "@/domain/schemas";
export async function placeBid(
  auctionId: string,
  bidderId: string,
  amount: number,
  key: string,
) {
  return row(
    BidResultRow,
    await sql`select * from bidlock.place_bid(${auctionId},${bidderId},${amount},${key})`,
  );
}
export async function payOffer(auctionId: string, bidderId: string) {
  return row(
    PayResultRow,
    await sql`select * from bidlock.pay_offer(${auctionId},${bidderId})`,
  );
}

export async function submitBid(
  sessionBidderId: string,
  botId: string | null,
  auctionId: string,
  amount: number,
  key: string,
  ipHash: string,
) {
  return jsonResult(
    SubmitBidResult,
    await sql`select bidlock.submit_bid(${sessionBidderId},${botId},${auctionId},${amount},${key},${ipHash}) as result`,
  );
}
