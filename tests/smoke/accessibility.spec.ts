// Accessibility, on the dev server's preview at the desk's width. axe holds every built screen to the
// whole of WCAG 2.1 AA (spec/12 S12.14; Craig, 15 Nov 2026, #2176), plate.md's two WCAG rules among
// it: text contrast at AA (1.4.3; Colour roles: "The pairs meet WCAG 2.1 AA") and a link in running
// text told from its words by more than colour (1.4.1; Colour roles: link). One Tab shows the focus ring as plate.md draws it
// (Colour roles: focus); tests/src/focusRing.test.ts fails any CSS that takes it away.

import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { DESK } from "../../scripts/viewports.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

/** axe's tags for every WCAG 2.1 rule at levels A and AA (S12.14). */
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** The breaks still to fix, each by its rule and the element axe names, with the issue fixing it;
 *  any other break fails. A pitch's player tile shows more words than its name holds (#2401): the
 *  Tactics pitch's, and the matchup's. Take a row off once its issue is done. */
const KNOWN_BREAKS = [
  { rule: "label-content-name-mismatch", target: /^button\[data-player="\d+"\]$/, issue: 2401 },
  { rule: "label-content-name-mismatch", target: /: why his points"\]$/, issue: 2401 },
];
const isKnown = (rule: string, target: string) => KNOWN_BREAKS.some((known) => known.rule === rule && known.target.test(target));

/** The focus ring's colour, `--color-derived`, as the browser reports it. */
const RING_COLOUR = "rgb(107, 253, 250)";

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  for (const [session, path, title] of BUILT_SCREENS) {
    test(`?preview=${session} at ${path} meets WCAG 2.1 AA (axe, S12.14)`, async ({ page }) => {
      await page.goto(previewUrl(path, session));
      await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      const { violations, passes } = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
      // axe measured text here, rather than leaving every node unsure over the see-through panels
      expect(passes.find(({ id }) => id === "color-contrast")?.nodes.length ?? 0, "text axe measured").toBeGreaterThan(0);
      const found = violations.flatMap(({ id, nodes }) =>
        nodes.filter((node) => !isKnown(id, node.target.join(" "))).map((node) => `${id}: ${node.target.join(" ")}: ${node.failureSummary ?? ""}`),
      );
      expect(found, "breaks of WCAG 2.1 AA").toEqual([]);
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
