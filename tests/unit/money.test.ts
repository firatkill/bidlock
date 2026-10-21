import { expect, test } from "vitest";
import { formatCents, parseDollarInput } from "@/domain/money";
test("TC-175: UT-01 formats integer cents without floating-point money", () => {
  for (const [input, output] of [
    [0, "$0.00"],
    [105, "$1.05"],
    [123456, "$1,234.56"],
    [100000000, "$1,000,000.00"],
  ] as const)
    expect(formatCents(input)).toBe(output);
});
test("TC-176: UT-01 accepts documented dollar forms as exact integer cents", () => {
  for (const [input, cents] of [
    ["35", 3500],
    ["35.5", 3550],
    ["35.50", 3550],
    ["1,234.50", 123450],
    ["$35.50", 3550],
    ["1000000", 100000000],
  ] as const)
    expect(parseDollarInput(input)).toEqual({ ok: true, cents });
});
test("TC-176: UT-01 rejects invalid dollar forms with separate decimal error", () => {
  expect(parseDollarInput("35.555")).toEqual({ ok: false, reason: "decimals" });
  for (const value of ["-35", "1e3", "", "abc", "1000000.01", "1,23.45"])
    expect(parseDollarInput(value)).toEqual({ ok: false, reason: "format" });
});
