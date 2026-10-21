import { z } from "zod";
import { Id } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { log } from "@/server/log";
export const runtime = "nodejs";
export const POST = route(
  {
    name: "client_error",
    auth: "none",
    mutating: true,
    body: z.object({ error_id: Id }).strict(),
  },
  (ctx) => {
    if (!ctx.body) throw new AppError("INTERNAL");
    log.error("client_render_error", { request_id: ctx.body.error_id });
    return Promise.resolve(
      json(z.object({ request_id: Id }).strict(), {
        request_id: ctx.body.error_id,
      }),
    );
  },
);
