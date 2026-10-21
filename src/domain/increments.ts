/** Display mirror of TRD §6.4; INT-03 verifies parity with SQL. */
export const INCREMENT_BANDS = [
  [0, 50],
  [1000, 100],
  [5000, 200],
  [10000, 500],
  [25000, 1000],
  [50000, 2500],
  [100000, 5000],
  [250000, 10000],
  [500000, 25000],
] as const;
export function incrementFor(price: number): number {
  let increment: number = INCREMENT_BANDS[0][1];
  for (const [lower, step] of INCREMENT_BANDS) {
    if (price < lower) break;
    increment = step;
  }
  return increment;
}
export function minNextBid(
  startingPrice: number,
  currentPrice: number | null,
): number {
  return currentPrice === null
    ? startingPrice
    : currentPrice + incrementFor(currentPrice);
}
export function maxBid(
  startingPrice: number,
  currentPrice: number | null,
): number {
  return Math.min(
    minNextBid(startingPrice, currentPrice) +
      100 * incrementFor(currentPrice ?? startingPrice),
    100000000,
  );
}
export function quickBidAmounts(state: {
  min_next_bid: number;
  increment: number;
  max_bid: number;
}): number[] {
  return [
    ...new Set(
      [0, 1, 4].map((steps) =>
        Math.min(state.min_next_bid + steps * state.increment, state.max_bid),
      ),
    ),
  ];
}
