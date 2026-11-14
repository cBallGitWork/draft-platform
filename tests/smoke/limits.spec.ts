// Every built screen (tests/support/smoke/builtScreens.ts) on the preview at the league limits
// (#2136: 20 teams, 30-character names, 25-man squads, from leagueLimits.ts), on the desk: it
// loads, with no error page, no sideways scroll and no console error (errorsTest.ts). Titles
// named after the league or a team are the limits' own, so any page title will do.

import { expect } from "@playwright/test";
import { TABLE_PATH } from "../../src/frame/menu";
import { ERROR_PAGE_TITLE } from "../../src/frame/words";
import { limitsTeamNames } from "../../src/shared/preview";
import { TABLE_TITLE } from "../../src/table/words";
import { DESK } from "../../scripts/viewports.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  test.describe(`each built screen at the league limits, at ${DESK.width} wide`, () => {
    test.use({ viewport: DESK });

    for (const [session, path] of BUILT_SCREENS) {
      test(`?preview=${session} at ${path} loads at the limits and doesn't scroll sideways`, async ({ page }) => {
        await page.goto(previewUrl(path, session, { atLimits: true }));
        await expect(page.getByRole("main").getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth, "the page's width, against the window's").toBeLessThanOrEqual(innerWidth);
      });
    }

    test("the switch takes: the Table lists every one of the limits' twenty teams, by its full name", async ({ page }) => {
      await page.goto(previewUrl(TABLE_PATH, "manager", { atLimits: true }));
      const table = page.getByRole("region", { name: TABLE_TITLE, exact: true });
      for (const team of limitsTeamNames) await expect(table.getByRole("row").filter({ hasText: team })).toHaveCount(1);
    });
  });
});
