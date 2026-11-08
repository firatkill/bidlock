import { z } from "zod";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ErrorView } from "../../src/components/shell/ErrorView";
import { SandboxCreated } from "../../src/domain/schemas";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
for (const colorScheme of ["light", "dark"] as const) {
  test(`TC-203 E2E-07 room axe ${colorScheme}`, async ({
    page,
    createAuction,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(`/a/${await createAuction()}`);
    await expect(
      page.getByRole("button", { name: "Bid $10.00 +1 step" }),
    ).toBeEnabled();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
  test(`TC-203 E2E-07 lobby axe ${colorScheme} @isolated`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Enter the room" }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}
test("TC-203 E2E-07 keyboard-only bid", async ({ page, createAuction }) => {
  await page.goto(`/a/${await createAuction()}`);
  const bid = page.getByRole("button", { name: "Bid $10.00 +1 step" });
  await expect(bid).toBeEnabled();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if (await bid.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(bid).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("You are the highest bidder.", { exact: true }),
  ).toBeVisible();
});
test("TC-204 E2E-07 mobile reduced motion and polling has no sockets", async ({
  page,
  createAuction,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    sockets.push(socket.url());
  });
  await page.goto(`/a/${await createAuction()}`);
  await page.getByRole("button", { name: "Bid $10.00 +1 step" }).click();
  await expect(
    page.getByText("You are the highest bidder.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  expect(
    await page.locator(".price").evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  expect(sockets).toEqual([]);
});
test("TC-204 E2E-07 mobile lobby has no overflow @isolated", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Enter the room" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
test("TC-171 deferred name dialog opens saves and returns keyboard focus", async ({
  page,
  createAuction,
}) => {
  await page.goto(`/a/${await createAuction()}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your display name" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("E2E-Rename");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("You are E2E-Rename", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeFocused();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`TC-275 TC-289 E2E-07 how-it-works axe ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/how-it-works");
    await expect(
      page.getByRole("heading", { name: "How it works", exact: true }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}
for (const width of [360, 375]) {
  test(`TC-275 TC-289 E2E-07 how-it-works mobile ${String(width)}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/how-it-works#benchmark");
    await expect(
      page.getByRole("table", { name: "Benchmark", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
test("TC-272 TC-284 TC-285 How it works sections and timeline", async ({
  page,
}) => {
  await page.goto("/how-it-works");
  expect(
    await page
      .locator("main section")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual([
    "rules",
    "state-machine",
    "concurrency",
    "benchmark",
    "stats",
    "run-it",
  ]);
  await expect(
    page.getByRole("figure", { name: "Two bids, one auction row" }),
  ).toContainText("BID_TOO_LOW");
  await expect(
    page.getByRole("img", { name: "Auction lifecycle" }),
  ).toBeVisible();
  await expect(page.locator("#rules")).toContainText("180 seconds");
  await expect(page.locator("#rules")).toContainText("$1,000,000.00");
});
test("TC-275 TC-289 lobby benchmark link resolves to the table @isolated", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See the full results" }).click();
  await expect(page).toHaveURL(/\/how-it-works#benchmark$/);
  await expect(
    page.getByRole("table", { name: "Benchmark", exact: true }),
  ).toBeVisible();
});

test("TC-299 D-98 favicon and strict CSP have no browser violations", async ({
  page,
  createAuction,
}) => {
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      document.documentElement.dataset.cspViolation = event.violatedDirective;
    });
  });
  const response = await page.goto(`/a/${await createAuction()}`);
  expect(response?.headers()["content-security-policy"]).not.toContain(
    "unsafe-eval",
  );
  await expect(page.locator(".quick-bid").first()).toBeEnabled();
  await page.locator(".quick-bid").first().click();
  await expect(
    page.getByText("You are the highest bidder.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-csp-violation");
  for (const path of ["/icon.svg", "/favicon.ico"]) {
    const asset = await page.request.get(path);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toMatch(/image\//);
  }
  await expect(page.locator('link[rel="icon"][href^="/icon.svg"]')).toHaveCount(
    1,
  );
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`TC-301 header focus follows visual order ${colorScheme}`, async ({
    page,
    createAuction,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(`/a/${await createAuction()}`);
    await expect(
      page.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
    let previousX = -1;
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const focus = page.locator(":focus");
      const style = await focus.evaluate((el) => ({
        width: getComputedStyle(el).outlineWidth,
        color: getComputedStyle(el).outlineColor,
        accent: getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim(),
        x: el.getBoundingClientRect().x,
      }));
      expect(style.width).toBe("2px");
      expect(style.x).toBeGreaterThan(previousX);
      previousX = style.x;
      expect(
        await focus.evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--accent)";
          el.append(probe);
          const matches =
            getComputedStyle(el).outlineColor === getComputedStyle(probe).color;
          probe.remove();
          return matches;
        }),
      ).toBe(true);
    }
  });

  test(`TC-300 TC-303 360px offline and missing states ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme });
    for (const path of ["/offline", "/a/missing", "/missing-page"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(
        axe.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
    }
  });

  test(`TC-300 TC-303 360px sandbox and result ${colorScheme} @isolated`, async ({
    page,
    createAuction,
    setClock,
    resetClock,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme });
    try {
      const id = await createAuction({ duration_s: 60, max_extensions: 0 });
      await page.goto(`/a/${id}`);
      await page.locator(".quick-bid").first().click();
      await expect(
        page.getByText("You are the highest bidder.", { exact: true }),
      ).toBeVisible();
      await setClock(61000);
      await expect(
        page.getByRole("heading", { name: /You won Lot/ }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
      await resetClock();
      const response = await page.request.post("/api/sandboxes", {
        headers: { origin: "http://localhost:3100" },
        data: {},
      });
      expect(response.status()).toBe(201);
      const created = SandboxCreated.parse(await response.json());
      await page.goto(`/a/${created.auction_id}`);
      await expect(
        page.getByRole("heading", { name: "Try to break it" }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
      await page.keyboard.press("Tab");
      const race = page.getByRole("button", { name: "Race", exact: true });
      await race.focus();
      expect(
        await race.evaluate((el) => {
          const ring = getComputedStyle(el).outlineColor;
          const panel = el.closest(".bg-strip-ground");
          const rgb = (value: string) =>
            (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (value: string) =>
            rgb(value).reduce((sum, channel, i) => {
              const c = channel / 255;
              return (
                sum +
                (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
                  ([0.2126, 0.7152, 0.0722][i] ?? 0)
              );
            }, 0);
          const a = luminance(ring);
          const b = luminance(
            panel ? getComputedStyle(panel).backgroundColor : "",
          );
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }),
      ).toBeGreaterThanOrEqual(3);
      const sandbox = await new AxeBuilder({ page }).analyze();
      expect(
        sandbox.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
    } finally {
      await resetClock();
    }
  });
}

test("TC-304 reduced motion preserves extension and price content @isolated", async ({
  page,
  createAuction,
  setClock,
  resetClock,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    const id = await createAuction({ duration_s: 120 });
    await setClock(112000);
    await page.goto(`/a/${id}`);
    await page.locator(".quick-bid").first().click();
    await expect(
      page.getByText("Late bid! Closing moved to 0:30", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".price")).toHaveText("$10.00");
    expect(
      await page
        .locator(".price, .extension-enter, .countdown")
        .evaluateAll(
          (elements) => elements.flatMap((el) => el.getAnimations()).length,
        ),
    ).toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  } finally {
    await resetClock();
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`TC-300 TC-303 360px rendered error components ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/offline");
    // Render the real error components inside the production shell/CSS. No production
    // state switch, database failure or weakened constraint is needed for layout QA.
    for (const markup of [
      renderToString(createElement(ErrorView, { reset: () => {} })),
    ]) {
      await page.getByRole("main").evaluate((main, html) => {
        main.outerHTML = html;
      }, markup);
      await expect(page.getByRole("main")).not.toBeEmpty();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
    }
  });
}

test("TC-302 polite price throttles latest values while outbid announces once", async ({
  page,
  browser,
  createAuction,
}) => {
  const id = await createAuction();
  const rival = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    await rival.request.get("/api/me");
    await page.goto(`/a/${id}`);
    const price = page.locator('p[aria-live="polite"]');
    await expect(price).toHaveCount(1);
    await price.evaluate((el) => {
      const observations: { at: number; text: string }[] = [];
      new MutationObserver(() => {
        observations.push({
          at: performance.now(),
          text: el.textContent,
        });
        el.setAttribute("data-observations", JSON.stringify(observations));
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await page.locator(".quick-bid").first().click();
    await expect(price).toContainText("$10.00");
    const response = await rival.request.post(`/api/auctions/${id}/bids`, {
      headers: { origin: "http://localhost:3100" },
      data: { amount: 1100, idempotency_key: crypto.randomUUID() },
    });
    expect(response.status()).toBe(201);
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText(/outbid/i);
    await page.getByRole("button", { name: "Bid $12.00 +1 step" }).click();
    await expect(
      page.getByText("You are the highest bidder.", { exact: true }),
    ).toBeVisible();
    await expect(price).toContainText("$12.00");
    const observations = z
      .array(z.object({ at: z.number(), text: z.string() }).strict())
      .parse(
        JSON.parse((await price.getAttribute("data-observations")) ?? "[]"),
      );
    expect(observations.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < observations.length; i++) {
      expect(
        (observations[i]?.at ?? 0) - (observations[i - 1]?.at ?? 0),
      ).toBeGreaterThanOrEqual(2990);
    }
  } finally {
    await rival.close();
  }
});
