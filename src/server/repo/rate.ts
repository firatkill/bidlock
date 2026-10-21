import "server-only";
import { sql } from "../db";
import { jsonResult } from "./result";
import { z } from "zod";
export async function checkBidRate(bidder: string, ipHash: string) {
  return jsonResult(
    z.number().int().nonnegative(),
    await sql`select bidlock.check_bid_rate(${bidder},${ipHash}) as result`,
  );
}
