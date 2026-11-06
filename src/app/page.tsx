import { cookies } from "next/headers";
import { readBenchmark } from "@/server/benchmark";
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
      <BenchmarkHeadline result={readBenchmark()} />
      <LobbyTeaser />
    </main>
  );
}
