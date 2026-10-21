import { env } from "@/server/env";
import { cookies } from "next/headers";
import { IdParams } from "@/domain/schemas";
import { auctionState, listBids } from "@/server/repo/auctions";
import { verifySession } from "@/server/session";
import { AuctionRoom } from "@/components/room/AuctionRoom";
import {
  AuctionLoadState,
  AuctionNotFound,
} from "@/components/room/AuctionLoadState";
export const dynamic = "force-dynamic";
export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed = IdParams.safeParse(await params);
  if (!parsed.success) return <AuctionNotFound />;
  const { id } = parsed.data;
  let data: [
    Awaited<ReturnType<typeof auctionState>>,
    Awaited<ReturnType<typeof listBids>>,
  ];
  try {
    const viewer =
      verifySession((await cookies()).get("bl_sid")?.value)?.bidderId ?? null;
    data = await Promise.all([auctionState(id, viewer), listBids(id, viewer)]);
  } catch {
    return (
      <AuctionLoadState
        auctionId={id}
        initialError
        readonly={env().DEMO_MODE !== "on"}
      />
    );
  }
  const [auction, history] = data;
  if (!auction) return <AuctionNotFound />;
  return (
    <AuctionRoom
      initial={auction}
      initialBids={history?.bids ?? []}
      readonly={env().DEMO_MODE !== "on"}
    />
  );
}
