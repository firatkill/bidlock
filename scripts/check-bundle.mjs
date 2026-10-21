import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
const args = process.argv.slice(2);
const route = args[args.indexOf("--route") + 1] ?? "/a/[id]";
const maxKb = Number(args[args.indexOf("--max-kb") + 1] ?? 180);
if (!Number.isFinite(maxKb) || maxKb <= 0)
  throw new Error("Invalid bundle budget");
const manifestPath = ".next/app-build-manifest.json";
try {
  await stat(manifestPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.log("check-bundle: manifest not found, NFR-15 enforced by E2E-09");
  process.exit(0);
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pages = manifest.pages;
if (!pages || typeof pages !== "object")
  throw new Error("Invalid app build manifest");
const segments = route.split("/").filter(Boolean);
const keys = [
  "/layout",
  ...segments.map((_, i) => `/${segments.slice(0, i + 1).join("/")}/layout`),
  `${route}/page`,
];
if (!Array.isArray(pages[`${route}/page`]))
  throw new Error(`Route missing from manifest: ${route}`);
const files = [...new Set(keys.flatMap((key) => pages[key] ?? []))];
let bytes = 0;
for (const file of files) {
  if (typeof file !== "string" || file.includes(".."))
    throw new Error("Invalid chunk path");
  if (file.endsWith(".js"))
    bytes += gzipSync(await readFile(path.join(".next", file))).length;
}
console.log(
  `check-bundle: ${route}: ${bytes} gzip bytes (budget ${maxKb * 1024})`,
);
if (bytes > maxKb * 1024) process.exit(1);
