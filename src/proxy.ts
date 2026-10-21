import { NextRequest, NextResponse } from "next/server";
import { securityHeaders } from "@/server/csp";
import { env } from "@/server/env";
export function proxy(request: NextRequest) {
  const { nonce, headers } = securityHeaders();
  const forwarded = new Headers(request.headers);
  forwarded.set(
    "content-security-policy",
    headers.get("content-security-policy") ?? "",
  );
  forwarded.set("x-nonce", nonce);
  const options = { request: { headers: forwarded } };
  const response =
    env().DEMO_MODE === "off" && request.nextUrl.pathname !== "/offline"
      ? NextResponse.rewrite(new URL("/offline", request.url), options)
      : NextResponse.next(options);
  headers.forEach((value, name) => {
    response.headers.set(name, value);
  });
  return response;
}
export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico).*)"],
};
