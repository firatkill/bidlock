import { afterAll, expect, test, vi } from "vitest";
import { z } from "zod";
import { POST } from "@/app/api/client-errors/route";
import { sql } from "@/server/db";
import { log } from "@/server/log";
afterAll(async () => {
  await sql.end();
  globalThis.__bidlockSql = undefined;
});
test("TC-209: client error report is strict, same-origin and ID-only", async () => {
  const id = crypto.randomUUID();
  const logs = vi.spyOn(log, "error");
  const request = (body: unknown, origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/client-errors", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    const response = await POST(request({ error_id: id }));
    expect(response.status).toBe(200);
    expect(
      z
        .object({ request_id: z.uuid() })
        .strict()
        .parse(await response.json()),
    ).toEqual({ request_id: id });
    expect(logs).toHaveBeenCalledExactlyOnceWith("client_render_error", {
      request_id: id,
    });
    expect(
      (await POST(request({ error_id: id, message: "not accepted" }))).status,
    ).toBe(400);
    expect((await POST(request({ error_id: id }, ""))).status).toBe(403);
    expect((await POST(request({ error_id: "invalid" }))).status).toBe(400);
    expect(logs).toHaveBeenCalledTimes(1);
  } finally {
    logs.mockRestore();
  }
});
