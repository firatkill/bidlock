// D-98: B outline extracted from the app's Schibsted Grotesk at weight 700.
// No downloaded asset or new dependency. Run: node scripts/icons/generate.mjs
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const css = await readFile("src/app/globals.css", "utf8");
const token = (name) => {
  const value = css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
  if (!value) throw new Error(`Missing light-theme token ${name}`);
  return value;
};
const path = JSON.parse(
  await readFile("scripts/icons/b-wordmark-path.json", "utf8"),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="6" fill="${token("ground")}"/><path fill="${token("accent")}" d="${path}"/></svg>\n`;
await writeFile("src/app/icon.svg", svg);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 64, height: 64 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<style>body{margin:0}</style>${svg}`);
  const png = await page.screenshot({ omitBackground: true });
  // ICO directory containing one PNG-compressed 64px image (supported by modern browsers).
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 64;
  header[7] = 64;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile("src/app/favicon.ico", Buffer.concat([header, png]));
} finally {
  await browser.close();
}
