// Accessibility on the plate's settled rules only (#2137), on the dev server's preview at the desk's
// width. Two of plate.md's rules are WCAG's, and axe holds every built screen to just those:
// text contrast at AA (1.4.3; plate.md, Colour roles: "The pairs meet WCAG 2.1 AA") and a link in
// running text told from its words by more than colour (1.4.1; Colour roles: link). The rest of
// WCAG waits for Craig's answer on how far to go. One Tab shows the focus ring as plate.md draws it
// (Colour roles: focus); tests/src/focusRing.test.ts fails any CSS that takes it away.

import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { DESK } from "../../scripts/viewports.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

/** axe's rules for the WCAG criteria plate.md settles, and no others. */
const PLATE_RULES = ["color-contrast", "link-in-text-block"];

/** The focus ring's colour, `--color-derived`, as the browser reports it. */
const RING_COLOUR = "rgb(107, 253, 250)";

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  for (const [session, path, title] of BUILT_SCREENS) {
    test(`?preview=${session} at ${path} keeps plate.md's contrast and link rules (axe)`, async ({ page }) => {
      await page.goto(previewUrl(path, session));
      await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      const { violations, passes } = await new AxeBuilder({ page }).withRules(PLATE_RULES).analyze();
      // axe measured text here, rather than leaving every node unsure over the see-through panels
      expect(passes.find(({ id }) => id === "color-contrast")?.nodes.length ?? 0, "text axe measured").toBeGreaterThan(0);
      const found = violations.flatMap(({ id, nodes }) => nodes.map((node) => `${id}: ${node.target.join(" ")}: ${node.failureSummary ?? ""}`));
      expect(found, "breaks of plate.md's WCAG rules").toEqual([]);
    });
  }

  test("one Tab draws the focus ring: a 2px cyan outline, offset 2px", async ({ page }) => {
    const [session, path, title] = BUILT_SCREENS[0];
    await page.goto(previewUrl(path, session));
    await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const focused = document.activeElement;
      if (focused === null || focused === document.body) return null;
      const style = getComputedStyle(focused);
      return { style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor, offset: style.outlineOffset };
    });
    expect(ring).toEqual({ style: "solid", width: "2px", colour: RING_COLOUR, offset: "2px" });
  });
});
