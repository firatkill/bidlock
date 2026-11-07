import "server-only";
import { sql } from "../db";
import { jsonResult } from "./result";
import { Stats } from "@/domain/schemas";
export async function stats() {
  return jsonResult(Stats, await sql`select bidlock.stats() as result`);
}
type Snapshot = { value: Awaited<ReturnType<typeof stats>>; fetchedAt: number };
let snapshot: Snapshot | undefined;
let pending: Promise<Snapshot> | undefined;
// Public aggregate data only. Await refresh at expiry rather than serving stale
// data while revalidating; concurrent readers share the same database request.
export async function cachedStats(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.fetchedAt < 60_000) return snapshot;
  if (!pending) {
    pending = stats()
      .then((value) => {
        snapshot = { value, fetchedAt: Date.now() };
        return snapshot;
      })
      .finally(() => {
        pending = undefined;
      });
  }
  return pending;
}
