import { afterAll, expect, test } from "vitest";
import { z } from "zod";
import { GET, PATCH } from "@/app/api/me/route";
import { Me, ErrorBody } from "@/domain/schemas";
import { sql } from "@/server/db";
import { signSession, verifySession } from "@/server/session";
import { ipHash } from "@/server/ip";
import { adminSql } from "../fixtures/db";
const admin = adminSql();
afterAll(async () => {
  await Promise.all([admin.end(), sql.end()]);
  globalThis.__bidlockSql = undefined;
});
function request(cookie?: string) {
  return new Request("http://localhost:3000/api/me", {
    headers: cookie ? { cookie } : {},
  });
}
function cookieOf(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Missing cookie");
  return cookie;
}
test("TC-143: guest creation, reuse and sliding renewal", async () => {
  const first = await GET(request());
  expect(first.status).toBe(200);
  const me = Me.parse(await first.json());
  expect(me.display_name).toMatch(/^Bidder [1-9][0-9]{3}$/);
  const cookie = cookieOf(first);
  expect(first.headers.get("set-cookie")).toContain("HttpOnly");
  expect(first.headers.get("set-cookie")).toContain("SameSite=Lax");
  const again = await GET(request(cookie));
  expect(Me.parse(await again.json()).id).toBe(me.id);
  expect(again.headers.get("set-cookie")).toBeNull();
  const aged = signSession(me.id, Math.floor(Date.now() / 1000) - 31 * 86400);
  const renewed = await GET(request(`bl_sid=${aged}`));
  expect(Me.parse(await renewed.json()).id).toBe(me.id);
  expect(verifySession(cookieOf(renewed).slice(7))?.renew).toBe(false);
});
test("TC-144: deleted guest gets replacement identity and cookie", async () => {
  const first = await GET(request());
  const me = Me.parse(await first.json());
  const cookie = cookieOf(first);
  await admin`delete from bidlock.bidders where id=${me.id}`;
  const recovered = await GET(request(cookie));
  expect(recovered.status).toBe(200);
  expect(Me.parse(await recovered.json()).id).not.toBe(me.id);
  expect(cookieOf(recovered)).not.toBe(cookie);
});
test("TC-145: strict authenticated rename with Unicode and validation reasons", async () => {
  const first = await GET(request());
  const cookie = cookieOf(first);
  const rename = (body: unknown) =>
    PATCH(
      new Request("http://localhost:3000/api/me", {
        method: "PATCH",
        headers: {
          cookie,
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  const valid = await rename({ display_name: "  José   Guest  " });
  expect(valid.status).toBe(200);
  expect(Me.parse(await valid.json()).display_name).toBe("José Guest");
  const unicode = await rename({ display_name: "𐐀".repeat(24) });
  expect(unicode.status).toBe(200);
  expect(Me.parse(await unicode.json()).display_name).toBe("𐐀".repeat(24));
  const invalid = await rename({ display_name: "Robot" });
  expect(invalid.status).toBe(422);
  expect(ErrorBody.parse(await invalid.json()).error.details?.reason).toBe(
    "bot_suffix",
  );
  expect((await rename({ display_name: "Good Name", extra: 1 })).status).toBe(
    400,
  );
});
test("TC-146: guest creation rate limit returns Retry-After", async () => {
  const hash = ipHash("local");
  const bucket = "bidder_create_ip_3600s:" + hash;
  // Own counter only; leave global configured limits unchanged. Restore in finally.
  const saved = z
    .array(
      z
        .object({
          bucket: z.string(),
          window_start: z.date(),
          hits: z.number().int(),
        })
        .strict(),
    )
    .parse(
      await admin`select bucket,window_start,hits from bidlock.rate_counters where bucket=${bucket}`,
    );
  try {
    await admin`delete from bidlock.rate_counters where bucket=${bucket}`;
    await admin`select bidlock.rate_hit('bidder_create_ip_3600s',${hash},bidlock.bidlock_now())`;
    await admin`update bidlock.rate_counters set hits=(select max_hits from bidlock.rate_limits where name='bidder_create_ip_3600s') where bucket=${bucket}`;
    const response = await GET(request());
    expect(response.status).toBe(429);
    const error = ErrorBody.parse(await response.json());
    expect(error.error.code).toBe("RATE_LIMITED");
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  } finally {
    await admin`delete from bidlock.rate_counters where bucket=${bucket}`;
    if (saved.length)
      await admin`insert into bidlock.rate_counters ${admin(saved)}`;
  }
});
