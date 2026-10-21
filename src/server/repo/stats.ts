import "server-only";
import { sql } from "../db";
import { jsonResult } from "./result";
import { Stats } from "@/domain/schemas";
export async function stats() {
  return jsonResult(Stats, await sql`select bidlock.stats() as result`);
}
