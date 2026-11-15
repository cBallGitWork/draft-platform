// The admin's feeds page in a real browser on the dev server's preview: a man the feed still left
// missing at full time is shown to the admin, who can set his stats by hand (regression catalogue,
// 15 Nov 2026, #2303). Fails on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { ADMIN_FEEDS_PATH } from "../../src/admin/paths";
import { DESK } from "../../scripts/viewports.mjs";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

/** The man the preview's feed holds at full time. */
const MISSING = "Saka";

test.describe("the feeds page, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  // Expected to fail: the feeds page shows no missing men and sets no stats yet (#2194 builds both,
  // the preview's held Saka with them). When it lands, drop `test.fail()`. That the hand-set stats
  // are the ones he scores from is SC-094's half in tests/convex/admin/matchStatEdits.test.ts.
  test("SC-094 S07.13: the admin is shown Saka still missing at full time and can set his stats by hand", async ({ page }) => {
    test.fail();
    await page.goto(previewUrl(ADMIN_FEEDS_PATH, "admin"));

    const missing = page.getByRole("region", { name: /missing/i });
    await expect(missing.getByText(MISSING)).toBeVisible();
    await missing.getByRole("button", { name: new RegExp(`${MISSING}.*stats|stats.*${MISSING}`, "i") }).click();
    await expect(page.getByRole("spinbutton").first()).toBeEditable();
  });
});
