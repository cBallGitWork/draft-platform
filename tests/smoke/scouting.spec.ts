// Scouting's Players tab in a real browser on the dev server's preview (#1028; the approved
// picture): it opens on free agents, the name box finds a player as it is typed, a row opens his
// panel, and Compare with your [position] puts him beside the preview manager's own player. Fails
// on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { SCOUTING_PATH } from "../../src/frame/menu";
import { COMPARE_YOURS_TITLE, compareTakeWords, compareWithYourWords, nameLabel, PLAYERS_TITLE, selectPlayerLabel } from "../../src/scouting/words";
import { test } from "../support/smoke/errorsTest";

test.describe("Scouting's Players tab, on the dev server's preview", { tag: "@dev" }, () => {
  test("opens on free agents, finds by name, opens a player's panel and compares him with yours", async ({ page }) => {
    await page.goto(`${SCOUTING_PATH}?preview=manager`);
    const list = page.getByRole("region", { name: PLAYERS_TITLE });

    // Free agents first (src/scouting/preview.ts): Salah is one; Saka is the preview manager's, James on waivers.
    await expect(list.getByRole("link", { name: "Salah", exact: true })).toBeVisible();
    await expect(list.getByRole("link", { name: "Saka", exact: true })).toHaveCount(0);
    await expect(list.getByRole("link", { name: "James", exact: true })).toHaveCount(0);

    await page.getByLabel(nameLabel).fill("sal");
    await expect(list.getByRole("link", { name: "Rice", exact: true })).toHaveCount(0);
    await expect(list.getByRole("link", { name: "Salah", exact: true })).toBeVisible();

    // Salah's main position is W, where the preview manager holds Saka.
    await list.getByRole("button", { name: selectPlayerLabel("Salah") }).click();
    await page.getByRole("button", { name: compareWithYourWords("W", "Saka") }).click();
    const compare = page.getByRole("region", { name: COMPARE_YOURS_TITLE });
    await expect(compare.getByRole("columnheader", { name: /^Salah/ })).toBeVisible();
    await expect(compare.getByRole("columnheader", { name: /^Saka/ })).toBeVisible();
    await expect(compare.getByRole("button", { name: compareTakeWords("pickUp", "Salah", null) })).toBeVisible();
  });
});
