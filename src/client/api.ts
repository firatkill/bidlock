import { z } from "zod";
import { ErrorBody, Me } from "@/domain/schemas";
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly envelope: z.infer<typeof ErrorBody>,
  ) {
    super(envelope.error.code);
    this.name = "ApiError";
  }
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  renew = true,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = ErrorBody.parse(body);
    if (
      error.error.code === "NO_SESSION" &&
      renew &&
      !(path === "/api/me" && (!init?.method || init.method === "GET"))
    ) {
      await getMe();
      return request(path, schema, init, false);
    }
    throw new ApiError(response.status, error);
  }
  return schema.parse(body);
}
export const getMe = () => request("/api/me", Me);
export const renameMe = (display_name: string) =>
  request("/api/me", Me, {
    method: "PATCH",
    body: JSON.stringify({ display_name }),
  });
