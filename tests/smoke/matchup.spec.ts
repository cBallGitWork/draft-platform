// The matchup built to its approved picture (#1026), in a real browser on the dev server's preview,
// held at minute 60 of its replay: both sides' pitches with all eleven on each, a tile opening its
// man's breakdown at the top of the centre column and its cross closing it, and the ◄ GW ► stepper
// moving to the next gameweek; and the breakdown's short-code heads (SC-028, expected to fail until
// built). Fails on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { STARTER_COUNT } from "../../convex/lineup/lineup";
import { ASSISTS, GOALS, KEY_PASSES, TACKLES_WON } from "../../convex/scoring/statKeys";
import { MATCHUP_PATH } from "../../src/frame/menu";
import { closeBreakdownLabel, gameweekWords, nextLabel, openBreakdownLabel, VIDIPRINTER_TITLE } from "../../src/matchup/words";
import { DESK } from "../../scripts/viewports.mjs";
import { previewGameweek, proLeague } from "../../src/shared/preview";
import { scoringPath } from "../../src/scoring/paths";
import { PER90_STAT_NAMES } from "../../src/scouting/words";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

/** A starter of the preview opponent's. */
const OPPONENTS_STRIKER = "Mateta";
/** Dense tables' short codes and the full name each gives on hover, as spec/14 (On screen) names them;
 *  "Clean sheet" stays singular so "Clean sheets" matches it too. */
const SHORT_CODES = {
  G: PER90_STAT_NAMES[GOALS],
  A: PER90_STAT_NAMES[ASSISTS],
  CS: "Clean sheet",
  KP: PER90_STAT_NAMES[KEY_PASSES],
  TW: PER90_STAT_NAMES[TACKLES_WON],
};

test.describe("the matchup, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  test("shows both pitches, opens a man's breakdown from his tile, and steps the gameweek", async ({ page }) => {
    await page.goto(previewUrl(`${MATCHUP_PATH}?minute=60`, "manager"));

    const pitches = page.getByRole("list", { name: /'s pitch$/ });
    await expect(pitches).toHaveCount(2);
    for (const pitch of await pitches.all()) await expect(pitch.getByRole("listitem", { name: /./ })).toHaveCount(STARTER_COUNT);

    await page.getByRole("button", { name: openBreakdownLabel(OPPONENTS_STRIKER) }).click();
    const breakdown = page.getByRole("region", { name: new RegExp(OPPONENTS_STRIKER) });
    await expect(breakdown).toBeVisible();
    // At the top of the centre column, over the vidiprinter.
    const vidiprinter = (await page.getByRole("region", { name: VIDIPRINTER_TITLE }).boundingBox())!;
    expect((await breakdown.boundingBox())!.y).toBeLessThan(vidiprinter.y);
    await breakdown.getByRole("button", { name: closeBreakdownLabel }).click();
    await expect(breakdown).toHaveCount(0);

    await page.getByRole("navigation", { name: gameweekWords(previewGameweek) }).getByRole("link", { name: nextLabel }).click();
    await expect(page.getByRole("navigation", { name: gameweekWords(previewGameweek + 1) })).toBeVisible();
  });

  // Regression catalogue, 15 Nov 2026 (#2303). Expected to fail: a man's breakdown is written as
  // lines, with no dense table of short codes yet. When one is built, drop `test.fail()`.
  test("SC-028 spec/14 On screen: the breakdown's G, A, CS, KP and TW heads each give the full name on hover; the rules editor uses full names", async ({ page }) => {
    test.fail();
    await page.goto(previewUrl(`${MATCHUP_PATH}?minute=60`, "manager"));
    await page.getByRole("button", { name: openBreakdownLabel(OPPONENTS_STRIKER) }).click();
    const breakdown = page.getByRole("region", { name: new RegExp(OPPONENTS_STRIKER) });
    for (const [code, name] of Object.entries(SHORT_CODES)) {
      const head = breakdown.getByRole("columnheader", { name: code, exact: true });
      // Seen first, so a missing head fails here rather than timing the test out on the hover.
      await expect(head).toBeVisible();
      await head.hover();
      // On the head itself or on an <abbr> in it; "Clean sheet" or "Clean sheets".
      await expect(head.locator("xpath=descendant-or-self::*[@title]").first()).toHaveAttribute("title", new RegExp(`^${name}`, "i"));
    }

    await page.goto(previewUrl(scoringPath(proLeague.leagueId), "manager"));
    for (const [code, name] of Object.entries(SHORT_CODES)) {
      await expect(page.getByRole("columnheader", { name: code, exact: true })).toHaveCount(0);
      await expect(page.getByText(new RegExp(`^${name}`, "i")).first()).toBeVisible();
    }
  });
});
