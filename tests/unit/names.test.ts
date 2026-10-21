import { expect, test } from "vitest";
import { normalizeName, validateName } from "@/domain/names";
test("TC-139 UT-08: NFC trim and collapsed whitespace", () => {
  expect(normalizeName("  Jose\u0301\t  Guest \n")).toBe("José Guest");
});
test("TC-140 UT-08: code-point lengths and allowed characters", () => {
  for (const length of [1, 25])
    expect(validateName("𐐀".repeat(length))).toBe("length");
  for (const length of [2, 24])
    expect(validateName("𐐀".repeat(length))).toBeNull();
  expect(validateName("Çağrı 42._-")).toBeNull();
  expect(validateName("Name!")).toBe("characters");
  expect(validateName("!")).toBe("length");
});
test("TC-141 UT-08: bot suffix reserved but prefix allowed", () => {
  expect(validateName(normalizeName(" Robot "))).toBe("bot_suffix");
  expect(validateName("Botanist")).toBeNull();
});
test("TC-142 UT-08: profanity de-leeting and separators", () => {
  for (const value of ["shit", "sh1t", "S.h_i-t", "fuck"])
    expect(validateName(value)).toBe("profanity");
  expect(validateName("Calm Guest")).toBeNull();
});
