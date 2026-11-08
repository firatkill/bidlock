import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("TC-299 D-98 favicon uses exactly the existing ground and accent tokens", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const icon = readFileSync("src/app/icon.svg", "utf8");
  const colours = [...icon.matchAll(/#[0-9a-f]{6}/g)].map((match) => match[0]);
  expect(colours).toEqual([
    css.match(/--ground: (#[0-9a-f]{6});/)?.[1],
    css.match(/--accent: (#[0-9a-f]{6});/)?.[1],
  ]);
  expect(icon).not.toMatch(/<text|<image|href=/);
  const ico = readFileSync("src/app/favicon.ico");
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(1);
  expect(ico.readUInt32LE(14)).toBe(ico.length - 22);
});
