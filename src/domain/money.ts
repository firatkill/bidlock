export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new RangeError("Expected nonnegative safe integer cents");
  const value = BigInt(cents),
    dollars = String(value / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${dollars}.${String(value % 100n).padStart(2, "0")}`;
}
export type DollarInput =
  { ok: true; cents: number } | { ok: false; reason: "format" | "decimals" };
export function parseDollarInput(input: string): DollarInput {
  const value = input.trim().replace(/^\$/, "");
  if (/^(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{3,}$/.test(value))
    return { ok: false, reason: "decimals" };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))
    return { ok: false, reason: "format" };
  const [whole = "", fraction = ""] = value.replaceAll(",", "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > 100_000_000n) return { ok: false, reason: "format" };
  return { ok: true, cents: Number(cents) };
}
