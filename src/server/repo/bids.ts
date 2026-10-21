import "server-only";
import { sql } from "../db";
import { row } from "./result";
import { BidResultRow, PayResultRow } from "@/domain/schemas";
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
