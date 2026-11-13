// The player card in a real browser on the dev server's preview: opened from Scouting, its game
// log's Scoring | All stats switch and a match row's breakdown (#1027); and its claim or drop
// (#1200): the preview manager drops his own Saka, claims James off waivers naming Saka to go, and
// picks up Rice; the preview saves nothing and says so. Fails on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { previewSaid, proLeague } from "../../src/shared/preview";
import { playerCardPath } from "../../src/playerCard/paths";
import { previewWaiverOutcomes } from "../../src/playerCard/preview";
import { SCOUTING_PATH } from "../../src/frame/menu";
import { previewPlayers } from "../../src/scouting/preview";
import { availabilityWords } from "../../src/scouting/words";
import { breakdownLabel, claimWords, confirmDropWords, dropWords, logViews, pickUpWords, postponedWords, SEASON_TITLE, whoGoesLabel } from "../../src/playerCard/words";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

/** A Scouting preview player's code, by his name: the preview manager's own Saka, Rice a free agent
 *  and James on waivers. */
const codeOf = (name: string) => previewPlayers.find((player) => player.name === name)!.code;
const SAKA = codeOf("Saka");
const RICE = codeOf("Rice");
const JAMES = codeOf("James");

test.describe("the player card, on the dev server's preview", { tag: "@dev" }, () => {
  test("opens from Scouting, switches its game log to every stat and shows a match's breakdown (#1027)", async ({ page }) => {
    await page.goto(previewUrl(SCOUTING_PATH, "manager"));
    // Scouting opens on free agents (#1028); Palmer is owned.
    await page.getByText(availabilityWords.all, { exact: true }).click();
    await page.getByRole("link", { name: "Palmer" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cole Palmer" })).toBeVisible();

    // Scoring shows the categories that score at CAM; All stats every stat held, big chances among them.
    const season = page.getByRole("region", { name: SEASON_TITLE });
    await expect(season.getByRole("columnheader", { name: /Big chance created/ })).toHaveCount(0);
    await season.getByText(logViews.all, { exact: true }).click();
    await expect(season.getByRole("columnheader", { name: /Big chance created/ })).toHaveCount(1);
    await expect(season.getByText(postponedWords)).toBeVisible();

    // The newest match is selected; pressing gameweek 8's shows its breakdown instead.
    await season.getByRole("button", { name: "LIV (A)" }).first().click();
    await expect(page.getByRole("region", { name: "GW8, LIV (A) 1–2" })).toBeVisible();
    await expect(page.getByLabel(breakdownLabel(8)).getByText(/^Goals scored/)).toBeVisible();
  });

  test("drops, claims and picks up", async ({ page }) => {
    const card = (code: number) => page.goto(previewUrl(playerCardPath(proLeague.leagueId, code), "manager"));
    const said = (outcome: string) => expect(page.getByRole("alert")).toHaveText(previewSaid(outcome));

    await card(SAKA);
    await page.getByRole("button", { name: dropWords }).click();
    await expect(page.getByText(confirmDropWords("Saka"))).toBeVisible();
    await page.getByRole("button", { name: dropWords }).click();
    await said(previewWaiverOutcomes.drop);

    await card(JAMES);
    await expect(page.getByText(/^On waivers: first run /)).toBeVisible();
    await page.getByLabel(whoGoesLabel).selectOption({ label: "Saka" });
    await page.getByRole("button", { name: claimWords }).click();
    await said(previewWaiverOutcomes.claim);

    await card(RICE);
    await page.getByRole("button", { name: pickUpWords }).click();
    await said(previewWaiverOutcomes.pickUp);
  });
});
