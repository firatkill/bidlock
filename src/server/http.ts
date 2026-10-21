import "server-only";
import { z } from "zod";
import { AppError } from "@/domain/errors";
import { ErrorBody } from "@/domain/schemas";
import { env } from "./env";
import { log } from "./log";
import { readSession } from "./session";
import { getMe } from "./repo/me";

type Auth = "none" | "optional-session" | "session" | "session-or-bot";
interface RouteOptions<P, Q, B> {
  name: string;
  auth: Auth;
  mutating: boolean;
  testOnly?: true;
  params?: z.ZodType<P>;
  query?: z.ZodType<Q>;
  body?: z.ZodType<B>;
}
export interface Ctx<P, Q, B> {
  req: Request;
  requestId: string;
  params: P | undefined;
  query: Q | undefined;
  body: B | undefined;
  bidderId: string | null;
  isBot: boolean;
  fields: {
    auction_id?: string;
    bidder_id?: string;
    is_bot?: boolean;
    replayed?: boolean;
    db_ms?: number;
  };
  db<T>(call: () => Promise<T>): Promise<T>;
}
class ValidationStatus extends AppError {
  constructor(private readonly responseStatus: number) {
    super("VALIDATION");
  }
  override get status() {
    return this.responseStatus;
  }
}
export function json<S extends z.ZodType>(
  schema: S,
  value: z.input<S>,
  init?: ResponseInit,
): Response {
  return Response.json(schema.parse(value), init);
}
function errorResponse(error: AppError, id: string): Response {
  return json(
    ErrorBody,
    {
      error: {
        code: error.code,
        message: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      request_id: id,
    },
    {
      status: error.status,
      ...(error.code === "RATE_LIMITED" &&
      typeof error.details?.retry_after_ms === "number"
        ? {
            headers: {
              "retry-after": String(
                Math.ceil(error.details.retry_after_ms / 1000),
              ),
            },
          }
        : {}),
    },
  );
}
function headersFor(response: Response, id: string): Response {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-request-id", id);
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export function notFoundResponse(id: string): Response {
  return headersFor(errorResponse(new AppError("NOT_FOUND"), id), id);
}
function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error: unknown) {
    if (error instanceof z.ZodError)
      throw new AppError("VALIDATION", {
        issues: error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      });
    throw error;
  }
}
async function readJson(req: Request): Promise<unknown> {
  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) > 4096)
    throw new ValidationStatus(413);
  if (!req.body) return undefined;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new ValidationStatus(413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new AppError("VALIDATION");
  }
}
export function route<P = undefined, Q = undefined, B = undefined>(
  opts: RouteOptions<P, Q, B>,
  handler: (ctx: Ctx<P, Q, B>) => Promise<Response>,
) {
  return async (
    req: Request,
    routeCtx: { params: Promise<unknown> } = { params: Promise.resolve({}) },
  ): Promise<Response> => {
    const supplied = z.uuid().safeParse(req.headers.get("x-request-id"));
    const id = supplied.success ? supplied.data : crypto.randomUUID();
    const start = performance.now();
    let status = 500;
    let errorCode: string | undefined;
    const fields: Ctx<P, Q, B>["fields"] = {};
    try {
      // Test-only routes remain closed until their environment/secret gate is introduced in T-24.
      if (opts.testOnly) {
        status = 404;
        errorCode = "NOT_FOUND";
        return notFoundResponse(id);
      }
      if (opts.name !== "health" && env().DEMO_MODE === "off")
        throw new AppError("DEMO_OFF");
      if (opts.mutating && env().DEMO_MODE === "readonly")
        throw new AppError("DEMO_READONLY");
      if (opts.mutating) {
        const origin = req.headers.get("origin");
        if (origin === null || !env().APP_ORIGIN.includes(origin))
          throw new AppError("FORBIDDEN_ORIGIN");
        if (
          (req.body !== null || opts.body !== undefined) &&
          req.headers
            .get("content-type")
            ?.split(";", 1)[0]
            ?.trim()
            .toLowerCase() !== "application/json"
        )
          throw new ValidationStatus(415);
      }
      const params = opts.params
        ? parseInput(opts.params, await routeCtx.params)
        : undefined;
      const query = opts.query
        ? parseInput(
            opts.query,
            Object.fromEntries(new URL(req.url).searchParams),
          )
        : undefined;
      const body = opts.body
        ? parseInput(opts.body, await readJson(req))
        : undefined;
      // Bot token verification remains scheduled for T-34.
      if (
        opts.auth === "session-or-bot" &&
        req.headers.get("authorization")?.startsWith("Bot ")
      )
        throw new AppError("BOT_TOKEN_INVALID");
      let bidderId: string | null = null;
      if (opts.auth !== "none") {
        const session = readSession(req);
        if (session && (await getMe(session.bidderId)))
          bidderId = session.bidderId;
        if (
          bidderId === null &&
          (opts.auth === "session" || opts.auth === "session-or-bot")
        )
          throw new AppError("NO_SESSION");
      }
      if (bidderId !== null) {
        fields.bidder_id = bidderId;
        fields.is_bot = false;
      }
      const response = await handler({
        req,
        requestId: id,
        params,
        query,
        body,
        bidderId,
        isBot: false,
        fields,
        db: async <T>(call: () => Promise<T>) => {
          const at = performance.now();
          try {
            return await call();
          } finally {
            fields.db_ms = (fields.db_ms ?? 0) + performance.now() - at;
          }
        },
      });
      status = response.status;
      return headersFor(response, id);
    } catch (error: unknown) {
      let mapped: AppError;
      if (error instanceof AppError) mapped = error;
      else {
        mapped = new AppError("INTERNAL");
        const sqlstate =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : undefined;
        log.error("request_error", {
          request_id: id,
          err_name: error instanceof Error ? error.name : "Unknown",
          err_message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          sqlstate,
        });
      }
      status = mapped.status;
      errorCode = mapped.code;
      return headersFor(errorResponse(mapped, id), id);
    } finally {
      log.info("request", {
        request_id: id,
        route: opts.name,
        method: req.method,
        status,
        duration_ms: performance.now() - start,
        ...fields,
        ...(errorCode ? { error_code: errorCode } : {}),
      });
    }
  };
}
