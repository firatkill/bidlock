import { cookies } from "next/headers";
import { BenchResult } from "@/domain/schemas";
import latest from "../../bench/results/latest.json";
import { listAuctions } from "@/server/repo/auctions";
import { verifySession } from "@/server/session";
import { env } from "@/server/env";
import { Lobby } from "@/components/lobby/Lobby";
import {
  BenchmarkHeadline,
  LobbyIntro,
  LobbyTeaser,
} from "@/components/lobby/LobbyContent";
export const dynamic = "force-dynamic";
export default async function Home() {
  const viewer =
    verifySession((await cookies()).get("bl_sid")?.value)?.bidderId ?? null;
  const initial = await listAuctions(viewer).catch(() => null);
  return (
    <main className="space-y-10">
      <LobbyIntro />
      <Lobby initial={initial} readonly={env().DEMO_MODE !== "on"} />
      <BenchmarkHeadline result={BenchResult.parse(latest)} />
      <LobbyTeaser />
    </main>
  );
}
