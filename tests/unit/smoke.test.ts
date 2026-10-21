import { expect, test } from "vitest";
import { projectName } from "../../src/server/tooling";
test("TC-001: Vitest imports a server-only module through its alias", () => {
  expect(projectName).toBe("Bidlock");
});
