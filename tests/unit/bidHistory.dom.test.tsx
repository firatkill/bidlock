import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { BidHistory } from "@/components/room/BidHistory";
import { fetchOlderBids } from "@/client/api";
import { roomCopy as copy } from "@/domain/copy";
import { auction, bid } from "../fixtures/auction";
import type { BidItem } from "@/domain/schemas";
vi.mock("@/client/api", () => ({ fetchOlderBids: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function History({ initial }: { initial: BidItem[] }) {
  const [bids, setBids] = useState(initial);
  return (
    <BidHistory
      auctionId={auction.id}
      bids={bids}
      viewerId={auction.id}
      extendBySeconds={30}
      onBids={(older) => {
        setBids([...bids, ...older].slice(0, 100));
      }}
    />
  );
}
test("TC-193: empty history, exact row labels, badges, local time and extension tooltip", () => {
  const view = render(<History initial={[]} />);
  expect(screen.getByRole("heading").textContent).toBe(copy.history);
  expect(screen.getByText(copy.noBids)).toBeTruthy();
  view.unmount();
  const row = { ...bid(1), extended: true, is_bot: true };
  render(<History initial={[row]} />);
  expect(screen.getByText("#1")).toBeTruthy();
  expect(screen.getByText(copy.you)).toBeTruthy();
  expect(screen.getByText(copy.bot)).toBeTruthy();
  expect(screen.getByText("$10.00")).toBeTruthy();
  expect(screen.getByTitle(copy.extendedTitle).textContent).toBe("+0:30");
  expect(document.querySelector("time")?.textContent).toBe(
    new Date(row.placed_at).toLocaleTimeString(undefined, {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );
  expect(screen.queryByRole("button")).toBeNull();
});
test("TC-193: loads twenty older rows and removes pagination at exhaustion", async () => {
  const initial = Array.from({ length: 20 }, (_, i) => bid(40 - i));
  vi.mocked(fetchOlderBids).mockResolvedValue({
    bids: Array.from({ length: 20 }, (_, i) => bid(20 - i)),
    next_cursor: null,
  });
  render(<History initial={initial} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: copy.earlier }));
    await Promise.resolve();
  });
  expect(fetchOlderBids).toHaveBeenCalledWith(auction.id, 21);
  expect(screen.getAllByRole("listitem")).toHaveLength(40);
  expect(screen.queryByRole("button")).toBeNull();
});
test("TC-193: approved D-55 reveals cached pages up to newest 100, then removes button", () => {
  render(
    <History initial={Array.from({ length: 100 }, (_, i) => bid(150 - i))} />,
  );
  for (let count = 20; count < 100; count += 20) {
    expect(screen.getAllByRole("listitem")).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: copy.earlier }));
  }
  expect(screen.getAllByRole("listitem")).toHaveLength(100);
  expect(screen.queryByRole("button")).toBeNull();
  expect(fetchOlderBids).not.toHaveBeenCalled();
});
