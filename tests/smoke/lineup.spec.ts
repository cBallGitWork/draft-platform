// My team's lineup in a real browser on the dev server's preview (#1665): a starter swapped with a
// man on the bench, the swap saved as every move is (spec/05, Moving players), the pitch showing it
// and the line under the toolbar saying it saved. Fails on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { MY_TEAM_PATH } from "../../src/frame/menu";
import { moveLabel, pitchLabel, playerOnPitchLabel, savedWords, selectionTableLabel, swapLabel } from "../../src/myTeam/tactics/words";
import { timeOfDayWords } from "../../src/shared/words";
import { test } from "../support/smoke/errorsTest";

/** The preview's striker and the bench's (src/myTeam/tactics/preview.ts). */
const STARTER = "Haaland";
const BENCH = "Watkins";
const STRIKER = ["ST"] as const;

/** "Lineup saved", at whatever time the save landed. */
const SAVED_AT_ANY_TIME = new RegExp(`^${savedWords(0).replace(timeOfDayWords(0), ".+")}$`);

test.describe("the lineup, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("swaps a starter with a man on the bench, and saves the swap", async ({ page }) => {
    await page.goto(`${MY_TEAM_PATH}?preview=manager`);
    const pitch = page.getByRole("group", { name: pitchLabel });
    const upFront = (name: string) => pitch.getByRole("button", { name: playerOnPitchLabel(name, STRIKER, "attack", "centre") });
    await expect(upFront(STARTER)).toBeVisible();

    // Picked up from the Selection table, then Move (the approved Tactics picture's interaction notes).
    await page.getByRole("table", { name: selectionTableLabel }).getByRole("button", { name: STARTER, exact: true }).click();
    await page.getByRole("button", { name: moveLabel(STARTER) }).click();
    await page.getByRole("button", { name: swapLabel(STARTER, BENCH) }).first().click();

    await expect(upFront(BENCH)).toBeVisible();
    await expect(upFront(STARTER)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: SAVED_AT_ANY_TIME })).toHaveText(SAVED_AT_ANY_TIME);
  });
});
