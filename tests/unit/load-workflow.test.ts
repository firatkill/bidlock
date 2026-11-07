import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const workflow = readFileSync(".github/workflows/load.yml", "utf8");

// FR-95/FR-96/NFR-31; TRD §16.2, LOAD-01. Runtime evidence is recorded in QA.
test("TC-270: load workflow matches the specified isolated CI pipeline", () => {
  const spec = readFileSync("docs/TRD.md", "utf8")
    .split("### 16.2 `.github/workflows/load.yml`")[1]
    ?.split("```yaml\n")[1]
    ?.split("```")[0];
  // Ignore formatting only; all workflow commands and conditions remain contractual.
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  expect(spec).toBeDefined();
  expect(normalize(workflow)).toBe(normalize(spec ?? ""));
  expect(workflow).not.toContain("firatkil.com");
  expect(workflow).not.toContain("--no-commit");
});

// FR-95/FR-96; TRD §16.2, A-09.
test("TC-271: result publication is scoped and threshold failures fail the run", () => {
  expect(workflow).toContain("continue-on-error: true");
  expect(workflow).toContain("if: steps.verify.outcome == 'success'");
  expect(workflow).toContain(
    'pnpm bench:report --k6-outcome "${{ steps.k6.outcome }}"',
  );
  expect(workflow).toMatch(
    /add-paths: \|\s+bench\/results\/\*\.json\s+bench\/SUMMARY\.md\s+- name:/,
  );
  expect(workflow).toMatch(
    /name: Fail when thresholds failed\s+if: steps.k6.outcome != 'success'\s+run: exit 1/,
  );
});

test("TC-280: diagnostics require an explicit opt-in and scored runs omit samplers", () => {
  expect(workflow).toMatch(
    /diagnostics:\n[\s\S]*?type: boolean\n\s+default: false/,
  );
  expect(workflow).toContain(
    "inputs.diagnostics && 'docker compose -f docker/compose.yml -f docker/compose.load-diagnostics.yml' || 'docker compose -f docker/compose.yml'",
  );
  expect(workflow).toContain('if [ "$LOAD_DIAGNOSTICS" = "on" ]; then');
});
