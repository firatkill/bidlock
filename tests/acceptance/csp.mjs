// TC-167 / TRD A-10: run against a local production build only.
// Start the built app on port 3100, then: node tests/acceptance/csp.mjs
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const base = "http://localhost:3100";
const response = await fetch(base);
assert.equal(response.status, 200);
const policy = response.headers.get("content-security-policy");
assert.ok(policy?.includes("frame-ancestors 'none'"));
assert.ok(!policy.includes("'unsafe-eval'"));
const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
assert.ok(nonce);
const html = await response.text();
const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
assert.ok(scripts.length > 0);
for (const script of scripts)
  assert.ok(
    script.includes(`nonce="${nonce}"`),
    "Every framework/hydration script must carry the response nonce",
  );
const next = await fetch(base);
assert.notEqual(next.headers.get("content-security-policy"), policy);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const blocked = [];
  const errors = [];
  page.on("console", (message) => {
    if (
      /content security policy|refused to (execute|load).*script/i.test(
        message.text(),
      )
    )
      blocked.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Array.isArray(window.__next_f));
  assert.deepEqual(blocked, []);
  assert.deepEqual(errors, []);
  console.log(
    `TC-167 passed: ${scripts.length} nonce-bearing scripts, fresh nonce per request, no browser CSP or runtime errors.`,
  );
} finally {
  await browser.close();
}
