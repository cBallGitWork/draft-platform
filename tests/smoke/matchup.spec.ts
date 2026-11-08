// The matchup built to its approved picture (#1026), in a real browser on the dev server's preview,
// held at minute 60 of its replay: both sides' pitches with all eleven on each, a tile opening its
// man's breakdown at the top of the centre column and its cross closing it, and the ◄ GW ► stepper
// moving to the next gameweek. Fails on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { MATCHUP_PATH } from "../../src/frame/menu";
import { closeBreakdownLabel, gameweekWords, nextLabel, openBreakdownLabel, VIDIPRINTER_TITLE } from "../../src/matchup/words";
import { test } from "../support/smoke/errorsTest";

/** The preview's gameweek (src/matchup/preview.ts), and a starter of its opponent's. */
const GAMEWEEK = 8;
const OPPONENTS_STRIKER = "Haaland";
const ELEVEN = 11;

test.describe("the matchup, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shows both pitches, opens a man's breakdown from his tile, and steps the gameweek", async ({ page }) => {
    await page.goto(`${MATCHUP_PATH}?preview=manager&minute=60`);

    const pitches = page.getByRole("list", { name: /'s pitch$/ });
    await expect(pitches).toHaveCount(2);
    for (const pitch of await pitches.all()) await expect(pitch.getByRole("listitem", { name: /./ })).toHaveCount(ELEVEN);

    await page.getByRole("button", { name: openBreakdownLabel(OPPONENTS_STRIKER) }).click();
    const breakdown = page.getByRole("region", { name: new RegExp(OPPONENTS_STRIKER) });
    await expect(breakdown).toBeVisible();
    // At the top of the centre column, over the vidiprinter.
    const vidiprinter = (await page.getByRole("region", { name: VIDIPRINTER_TITLE }).boundingBox())!;
    expect((await breakdown.boundingBox())!.y).toBeLessThan(vidiprinter.y);
    await breakdown.getByRole("button", { name: closeBreakdownLabel }).click();
    await expect(breakdown).toHaveCount(0);

    await page.getByRole("navigation", { name: gameweekWords(GAMEWEEK) }).getByRole("link", { name: nextLabel }).click();
    await expect(page.getByRole("navigation", { name: gameweekWords(GAMEWEEK + 1) })).toBeVisible();
  });
});
