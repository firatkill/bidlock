import { expect, test } from "vitest";
import { z } from "zod";
import { appSql } from "../fixtures/db";
import { INCREMENT_BANDS } from "../../src/domain/increments";
test("TC-124 INT-03 runtime SQL ladder equals the display mirror", async () => {
  const sql = appSql();
  try {
    const rows = z
      .array(
        z
          .object({
            lower_bound: z.number().int(),
            increment: z.number().int(),
          })
          .strict(),
      )
      .parse(
        await sql`select lower_bound, increment from bidlock.increment_bands order by lower_bound`,
      );
    expect(
      rows.map(({ lower_bound, increment }) => [lower_bound, increment]),
    ).toEqual(INCREMENT_BANDS);
  } finally {
    await sql.end();
  }
});
