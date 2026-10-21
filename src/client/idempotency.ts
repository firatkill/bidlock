export interface PendingBid {
  key: string;
  amount: number;
  auctionId: string;
}
export function newBid(auctionId: string, amount: number): PendingBid {
  return { key: crypto.randomUUID(), amount, auctionId };
}
