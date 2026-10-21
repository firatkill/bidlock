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
if (failed) process.exitCode = 1;
else process.stdout.write("check:guards: test-only handlers guarded\n");
