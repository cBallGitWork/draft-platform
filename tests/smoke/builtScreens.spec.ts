// Every built screen (tests/support/smoke/builtScreens.ts, which tests/src/smokeScreens.test.ts
// keeps whole) on the dev server's preview, on the phone and on the desk (#2135): its title shows,
// no error page, no sideways scroll, and no console error (errorsTest.ts). The tap size is the
// phone's check; on the desk the plate's look rules are listed on the test, under LOOK_BREAK, for
// the UI reskin, and never fail it (lookRules.ts).

import { expect } from "@playwright/test";
import { tapsUnderTapSize } from "../../scripts/tap-targets.mjs";
import { DESK, PHONE } from "../../scripts/viewports.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { test } from "../support/smoke/errorsTest";
import { lookBreaks } from "../support/smoke/lookRules";
import { expectPageSound } from "../support/smoke/pageChecks";
import { previewUrl } from "../support/smoke/previewUrl";

/** The annotation a break of the plate's look rules is listed under, in the run's report. */
const LOOK_BREAK = "look rule, for the reskin";

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  for (const viewport of [PHONE, DESK]) {
    const onPhone = viewport === PHONE;
    test.describe(`each built screen, at ${viewport.width} wide`, () => {
      test.use({ viewport });

      for (const [session, path, title] of BUILT_SCREENS) {
        const checks = onPhone ? "and has no tap under the tap size" : "and lists its breaks of the plate's look rules";
        test(`?preview=${session} at ${path} shows "${title}", doesn't scroll sideways, ${checks}`, async ({ page }) => {
          await page.goto(previewUrl(path, session));
          await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
          await expectPageSound(page);
          if (onPhone) {
            const { tapSize, small } = await page.evaluate(tapsUnderTapSize);
            expect(small, `taps under ${tapSize}px`).toEqual([]);
          } else {
            for (const description of await page.evaluate(lookBreaks)) test.info().annotations.push({ type: LOOK_BREAK, description });
          }
        });
      }
    });
  }
});
