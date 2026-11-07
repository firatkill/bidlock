import "server-only";
import { sql } from "../db";
import { row, jsonResult } from "./result";
import { BidResultRow, PayResultRow, PrepareBidResult } from "@/domain/schemas";
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

export async function prepareBid(
  sessionBidderId: string,
  botId: string | null,
  ipHash: string,
) {
  return jsonResult(
    PrepareBidResult,
    await sql`select bidlock.prepare_bid(${sessionBidderId},${botId},${ipHash}) as result`,
  );
}
