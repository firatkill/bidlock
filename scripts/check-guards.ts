import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { unguardedTestHandlers } from "./guards/test-routes";
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory()
        ? files(join(dir, e.name))
        : Promise.resolve([join(dir, e.name)]),
    ),
  );
  return nested.flat();
}
let failed = false;
for (const path of await files("src/app/api/test"))
  if (path.endsWith(".ts")) {
    const methods = unguardedTestHandlers(await readFile(path, "utf8"));
    if (methods.length) {
      failed = true;
      process.stderr.write(
        `${path}: missing testOnly:true on ${methods.join(", ")}\n`,
      );
    }
  }
// TRD §13.8 rule 5: missing future load workflow is allowed until T-43.
for (const path of [".github/workflows/load.yml", "load/bid-storm.js"]) {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      continue;
    throw error;
  }
  if (source.includes("firatkil.com")) {
    failed = true;
    process.stderr.write(
      `${path}: production domain forbidden in load targets\n`,
    );
  }
}
if (failed) process.exitCode = 1;
else
  process.stdout.write(
    "check:guards: test-only handlers guarded; load targets checked\n",
  );
