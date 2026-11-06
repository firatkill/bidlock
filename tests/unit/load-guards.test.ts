import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bidlock-load-guard-"));
  roots.push(root);
  mkdirSync(join(root, "src/app/api/test"), { recursive: true });
  mkdirSync(join(root, "load"), { recursive: true });
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  return root;
}

function guard(cwd: string) {
  return execFileSync(
    process.execPath,
    [
      "--import",
      resolve("node_modules/tsx/dist/loader.mjs"),
      resolve("scripts/check-guards.ts"),
    ],
    { cwd, encoding: "utf8", stdio: "pipe" },
  );
}

test("TC-260: rule 5 permits local target and the not-yet-created load workflow", () => {
  const root = fixture();
  writeFileSync(
    join(root, "load/bid-storm.js"),
    'const BASE = "http://app:3000";',
  );
  expect(guard(root)).toContain("load targets checked");
});

test.each(["load/bid-storm.js", ".github/workflows/load.yml"])(
  "TC-260: rule 5 rejects production domain in %s",
  (path) => {
    const root = fixture();
    // Text fixture only: no HTTP requests are made by these tests.
    writeFileSync(join(root, path), "firatkil.com");
    expect(() => guard(root)).toThrow(/production domain forbidden/);
  },
);
