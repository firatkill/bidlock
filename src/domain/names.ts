import { PROFANITY } from "./profanity";
export type NameReason = "length" | "characters" | "bot_suffix" | "profanity";
export function normalizeName(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/gu, " ");
}
export function validateName(name: string): NameReason | null {
  const length = Array.from(name).length;
  if (length < 2 || length > 24) return "length";
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) return "characters";
  if (/bot$/i.test(name.trim())) return "bot_suffix";
  const map: Record<string, string> = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "@": "a",
    $: "s",
  };
  const normalized = name
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => map[c] ?? c)
    .replace(/[ ._-]/g, "");
  if (PROFANITY.some((word) => normalized.includes(word))) return "profanity";
  return null;
}
