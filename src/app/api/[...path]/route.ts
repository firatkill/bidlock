import { z } from "zod";
import { notFoundResponse } from "@/server/http";
import { log } from "@/server/log";
export const runtime = "nodejs";
function unknownRoute(req: Request): Response {
  const incoming = z.uuid().safeParse(req.headers.get("x-request-id"));
  const id = incoming.success ? incoming.data : crypto.randomUUID();
  log.info("request", {
    request_id: id,
    route: "not_found",
    method: req.method,
    status: 404,
    duration_ms: 0,
    error_code: "NOT_FOUND",
  });
  return notFoundResponse(id);
}
export {
  unknownRoute as GET,
  unknownRoute as POST,
  unknownRoute as PATCH,
  unknownRoute as PUT,
  unknownRoute as DELETE,
  unknownRoute as OPTIONS,
  unknownRoute as HEAD,
};
