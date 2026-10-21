import { afterEach, expect, test, vi } from "vitest";
import { auction } from "../fixtures/auction";
const mocks = vi.hoisted(() => ({
  loaded: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  refresh: vi.fn(),
}));
vi.mock("@/client/feed/SupabaseBroadcastFeed", () => {
  mocks.loaded();
  return {
    SupabaseBroadcastFeed: class {
      subscribe = mocks.subscribe;
      refresh = mocks.refresh;
    },
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test("TC-196: polling never imports Broadcast; configured Broadcast loads it dynamically", async () => {
  vi.stubEnv("NEXT_PUBLIC_FEED", "polling");
  const { createFeed } = await import("@/client/feed/createFeed");
  const polling = createFeed(auction.id);
  expect(polling.constructor.name).toBe("PollingFeed");
  expect(mocks.loaded).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_FEED", "broadcast");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  const feed = createFeed(auction.id);
  expect(mocks.loaded).not.toHaveBeenCalled();
  const stop = feed.subscribe(auction.id, {
    onEvent: vi.fn(),
    onStatus: vi.fn(),
  });
  await vi.waitFor(() => {
    expect(mocks.subscribe).toHaveBeenCalledOnce();
  });
  expect(mocks.loaded).toHaveBeenCalledOnce();
  feed.refresh();
  expect(mocks.refresh).toHaveBeenCalledOnce();
  stop();
});
