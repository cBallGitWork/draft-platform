// The draft room in a real browser on the dev server's preview (#1665; spec/04, The draft room):
// the preview manager's Saka Potatoes is on the clock (src/draft/preview.ts), so a free player's
// Draft button takes him, and one his squad can't hold is refused in his panel. The preview's pick
// changes nothing (its makePick saves no pick), so the board and the squad can't show it: the
// journey stops once the pick goes through with no problem said. Fails on any console or page error
// (errorsTest.ts).

import { expect } from "@playwright/test";
import { DRAFT_PATH } from "../../src/frame/menu";
import { BOARD_TITLE, draftPlayerWords, notLegalWords, PLAYERS_TITLE, selectLabel } from "../../src/draft/words";
import { DESK } from "../../scripts/viewports.mjs";
import { test } from "../support/smoke/errorsTest";

/** Scouting's preview players (src/scouting/preview.ts): Salah undrafted, Rice an Arsenal player
 *  the reader's squad, at its Arsenal maximum, can't take. */
const SALAH = "Salah";
const RICE = "Rice";

test.describe("the draft room, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  test("refuses a player the squad can't hold, and drafts one it can", async ({ page }) => {
    await page.goto(`${DRAFT_PATH}?preview=manager`);
    await expect(page.getByRole("region", { name: BOARD_TITLE, exact: true })).toBeVisible();
    const players = page.getByRole("region", { name: new RegExp(`^${PLAYERS_TITLE}`) });

    await players.getByRole("button", { name: selectLabel(RICE) }).click();
    const draftRice = page.getByRole("button", { name: draftPlayerWords(RICE) });
    await expect(draftRice).toBeDisabled();
    await expect(draftRice).toContainText(notLegalWords.clubFull);

    await players.getByRole("button", { name: selectLabel(SALAH) }).click();
    const draftSalah = page.getByRole("button", { name: draftPlayerWords(SALAH) });
    await expect(draftSalah).toBeEnabled();
    await draftSalah.click();
    // The pick went through: no problem is said. The preview saves no pick, so the board and the
    // squad stay as they were.
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
