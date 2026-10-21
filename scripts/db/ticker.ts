import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { adminConnection, assertLocal, databaseUrl, runIfMain } from "./common";
runIfMain(import.meta.url, async () => {
  const { values } = parseArgs({
    options: { once: { type: "boolean" } },
    strict: true,
  });
  const url = databaseUrl();
  if (!values.once) assertLocal(url);
  const sql = adminConnection(url);
  const abort = new AbortController();
  const stop = () => {
    abort.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    do {
      const result = z
        .array(
          z
            .object({
              tick: z
                .object({
                  closed_or_started: z.number().int(),
                  offers_expired: z.number().int(),
                  public_auction_id: z.uuid(),
                })
                .strict(),
            })
            .strict(),
        )
        .length(1)
        .parse(await sql`select bidlock.tick() as tick`);
      process.stdout.write(JSON.stringify(result[0]?.tick) + "\n");
      if (values.once) break;
      try {
        await setTimeout(5000, undefined, { signal: abort.signal });
      } catch (error) {
        if (!abort.signal.aborted) throw error;
      }
    } while (!abort.signal.aborted);
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await sql.end();
  }
});
