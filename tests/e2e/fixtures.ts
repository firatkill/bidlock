import { randomUUID } from "node:crypto";
import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";
import { z } from "zod";
import { Id, Me, TestAuctionBody } from "../../src/domain/schemas";
export const origin = "http://localhost:3100";
export const headers = { origin };
type Fixtures = {
  testApi: APIRequestContext;
  createAuction: (opts?: z.input<typeof TestAuctionBody>) => Promise<string>;
  setClock: (ms: number) => Promise<void>;
  resetClock: () => Promise<void>;
};
export const test = base.extend<Fixtures>({
  testApi: async ({ playwright }, provide) => {
    const api = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { origin, "x-test-secret": "e2e-test-secret" },
    });
    await provide(api);
    await api.dispose();
  },
  createAuction: async ({ testApi }, provide) => {
    await provide(async (opts = {}) => {
      const response = await testApi.post("/api/test/auctions", {
        data: { duration_s: 600, title: `E2E-${randomUUID()}`, ...opts },
      });
      expect(response.status()).toBe(201);
      return z
        .object({ auction_id: Id })
        .strict()
        .parse(await response.json()).auction_id;
    });
  },
  setClock: async ({ testApi }, provide) => {
    await provide(async (ms) => {
      expect(
        (
          await testApi.post("/api/test/clock", { data: { offset_ms: ms } })
        ).status(),
      ).toBe(200);
    });
  },
  resetClock: async ({ testApi }, provide) => {
    await provide(async () => {
      expect((await testApi.delete("/api/test/clock")).status()).toBe(200);
    });
  },
});
export { expect };
export async function newBidder(browser: Browser) {
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
  const me = Me.parse(await (await context.request.get("/api/me")).json());
  const name = `E2E-${randomUUID().slice(0, 6)}`;
  expect(
    (
      await context.request.patch("/api/me", {
        headers,
        data: { display_name: name },
      })
    ).status(),
  ).toBe(200);
  return { context, page, name, id: me.id };
}
