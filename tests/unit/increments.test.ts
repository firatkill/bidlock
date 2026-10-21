import { expect, test } from "vitest";
import {
  incrementFor,
  minNextBid,
  maxBid,
  quickBidAmounts,
} from "../../src/domain/increments";
// Expectations from PRD FR-03 and TRD DB-03/UT-02, not the implementation constant.
test.each([
  [0, 50],
  [999, 50],
  [1000, 100],
  [4999, 100],
  [5000, 200],
  [9999, 200],
  [10000, 500],
  [24999, 500],
  [25000, 1000],
  [49999, 1000],
  [50000, 2500],
  [99999, 2500],
  [100000, 5000],
  [249999, 5000],
  [250000, 10000],
  [499999, 10000],
  [500000, 25000],
  [100000000, 25000],
])("TC-125 UT-02 price %i increment %i", (price, increment) => {
  expect(incrementFor(price)).toBe(increment);
});
test("TC-125 UT-02 next bid and anti-typo ceiling", () => {
  expect(minNextBid(1000, null)).toBe(1000);
  expect(minNextBid(1000, 999)).toBe(1049);
  expect(minNextBid(1000, 4950)).toBe(5050);
  expect(maxBid(1000, null)).toBe(11000);
  expect(maxBid(1000, 99999999)).toBe(100000000);
});
test("TC-125 UT-02 quick amounts clamp and deduplicate at the cap", () => {
  expect(
    quickBidAmounts({ min_next_bid: 1100, increment: 100, max_bid: 11100 }),
  ).toEqual([1100, 1200, 1500]);
  expect(
    quickBidAmounts({
      min_next_bid: 99975000,
      increment: 25000,
      max_bid: 100000000,
    }),
  ).toEqual([99975000, 100000000]);
  expect(
    quickBidAmounts({
      min_next_bid: 100000000,
      increment: 25000,
      max_bid: 100000000,
    }),
  ).toEqual([100000000]);
});
