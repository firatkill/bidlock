import { z } from "zod";
import { Iso, TestClockBody } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { setTestClock } from "@/server/repo/testSupport";
export const runtime = "nodejs";
const ResponseBody = z.object({ server_now: Iso }).strict();
export const POST = route(
  {
    name: "test.clock.set",
    auth: "none",
    mutating: true,
    testOnly: true,
    body: TestClockBody,
  },
  async (ctx) => {
    if (!ctx.body) throw new AppError("INTERNAL");
    const offset = ctx.body.offset_ms;
    return json(ResponseBody, {
      server_now: await ctx.db(() => setTestClock(offset)),
    });
  },
);
export const DELETE = route(
  { name: "test.clock.reset", auth: "none", mutating: true, testOnly: true },
  async (ctx) =>
    json(ResponseBody, { server_now: await ctx.db(() => setTestClock(0)) }),
);
