import { expect, test } from "vitest";
import { unguardedTestHandlers } from "../../scripts/guards/test-routes";
test("TC-163: exported test handlers must explicitly use the test-only wrapper", () => {
  expect(
    unguardedTestHandlers(
      'export const runtime = "nodejs"; export const POST = route({ testOnly: true }, handler); export const DELETE = route({ testOnly: true }, handler);',
    ),
  ).toEqual([]);
  for (const source of [
    'export const POST = route({ auth: "none" }, handler);',
    "export const POST = route({ testOnly: false }, handler);",
    "export const POST = handler;",
    "export function POST() {}",
    "export { handler as POST };",
  ])
    expect(unguardedTestHandlers(source)).toEqual(["POST"]);
});
