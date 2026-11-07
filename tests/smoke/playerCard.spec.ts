// The player card's claim or drop (#1200), in a real browser on the dev server's preview: the
// preview manager drops his own Saka, claims James off waivers naming Saka to go, and picks up
// Rice; the preview saves nothing and says so. Fails on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { proLeague } from "../../src/app/preview";
import { playerCardPath } from "../../src/playerCard/paths";
import { claimWords, confirmDropWords, dropWords, pickUpWords, whoGoesLabel } from "../../src/playerCard/words";
import { test } from "../support/smoke/errorsTest";

/** Scouting's preview players (src/scouting/preview.ts): the preview manager's own Saka, Rice a free
 *  agent and James on waivers. */
const SAKA = 1;
const RICE = 2;
const JAMES = 5;

test.describe("the player card, on the dev server's preview", { tag: "@dev" }, () => {
  test("drops, claims and picks up", async ({ page }) => {
    const card = (code: number) => page.goto(`${playerCardPath(proLeague.leagueId, code)}?preview=manager`);
    const said = (words: string) => expect(page.getByRole("alert")).toHaveText(words);

    await card(SAKA);
    await page.getByRole("button", { name: dropWords }).click();
    await expect(page.getByText(confirmDropWords("Saka"))).toBeVisible();
    await page.getByRole("button", { name: dropWords }).click();
    await said("This is a preview: nobody was dropped.");

    await card(JAMES);
    await expect(page.getByText(/^On waivers: first run /)).toBeVisible();
    await page.getByLabel(whoGoesLabel).selectOption({ label: "Saka" });
    await page.getByRole("button", { name: claimWords }).click();
    await said("This is a preview: no claim was put in.");

    await card(RICE);
    await page.getByRole("button", { name: pickUpWords }).click();
    await said("This is a preview: nobody was picked up.");
  });
});
