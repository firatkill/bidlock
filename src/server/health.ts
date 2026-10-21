import "server-only";
import { sql } from "./db";
import { Iso } from "@/domain/schemas";
import { jsonResult } from "./repo/result";
export async function healthTime(): Promise<string> {
  const result = await sql.begin(async (tx) => {
    await tx`set local statement_timeout = 1000`;
    return jsonResult(Iso, await tx`select bidlock.bidlock_now() as result`);
  });
  return Iso.parse(result);
}
