import { z } from "zod";
import { Id, TestAuctionBody } from "@/domain/schemas";
import { AppError } from "@/domain/errors";
import { json, route } from "@/server/http";
import { createTestAuction } from "@/server/repo/testSupport";
export const runtime = "nodejs";
const ResponseBody = z.object({ auction_id: Id }).strict();
export const POST = route(
  {
    name: "test.auctions.create",
    auth: "none",
    mutating: true,
    testOnly: true,
    body: TestAuctionBody,
  },
  async (ctx) => {
    if (!ctx.body) throw new AppError("INTERNAL");
    const body = ctx.body;
    return json(
      ResponseBody,
      { auction_id: await ctx.db(() => createTestAuction(body)) },
      { status: 201 },
    );
  },
);
