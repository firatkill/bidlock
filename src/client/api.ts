import { z } from "zod";
import {
  AuctionState,
  BidAccepted,
  BidsPage,
  ErrorBody,
  Me,
} from "@/domain/schemas";
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

/** Epoch time with a monotonic source, including after system clock changes. */
export const localNow = () => performance.timeOrigin + performance.now();
export async function fetchSnapshot(
  auctionId: string,
  etag: string | null = null,
  signal?: AbortSignal,
) {
  const t0 = localNow();
  const headers = new Headers();
  if (etag) headers.set("If-None-Match", etag);
  const response = await fetch(`/api/auctions/${auctionId}/state`, {
    credentials: "same-origin",
    cache: "no-store",
    headers,
    ...(signal ? { signal } : {}),
  });
  const receivedAt = localNow();
  if (response.status === 304) return null;
  const body: unknown = await response.json();
  if (!response.ok) throw new ApiError(response.status, ErrorBody.parse(body));
  return {
    state: AuctionState.parse(body),
    etag: response.headers.get("etag"),
    receivedAt,
    rttMs: receivedAt - t0,
  };
}
export const fetchBidsAfter = (
  auctionId: string,
  after: number,
  signal?: AbortSignal,
) =>
  request(
    `/api/auctions/${auctionId}/bids?after=${String(after)}&limit=50`,
    BidsPage,
    signal ? { signal } : undefined,
  );

export const placeBid = (pending: import("./idempotency").PendingBid) =>
  request(`/api/auctions/${pending.auctionId}/bids`, BidAccepted, {
    method: "POST",
    body: JSON.stringify({
      amount: pending.amount,
      idempotency_key: pending.key,
    }),
  });
export const fetchOlderBids = (auctionId: string, cursor: number) =>
  request(
    `/api/auctions/${auctionId}/bids?cursor=${String(cursor)}&limit=20`,
    BidsPage,
  );
