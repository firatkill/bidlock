import "server-only";
import { sql } from "../db";
import { jsonResult } from "./result";
import { z } from "zod";
import { Id, Iso, TestAuctionBody } from "@/domain/schemas";
export async function createTestAuction(
  input: z.input<typeof TestAuctionBody> = {},
) {
  const b = TestAuctionBody.parse(input);
  return jsonResult(
    Id,
    await sql`select bidlock.create_test_auction(${b.duration_s},${b.starting_price},${b.snipe_window_s},${b.extend_by_s},${b.max_extensions},${b.payment_window_s},${b.starts_in_s},${b.title ?? null}) as result`,
  );
}
export async function setTestClock(offset: number) {
  return jsonResult(
    Iso,
    await sql`select bidlock.set_test_clock(${offset}) as result`,
  );
}
export async function serverNow() {
  return jsonResult(Iso, await sql`select bidlock.bidlock_now() as result`);
}
