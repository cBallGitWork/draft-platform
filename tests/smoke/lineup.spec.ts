// My team's Tactics tab in a real browser on the dev server's preview (#1665; spec/05, Moving
// players): Haaland, up front in the preview's 4-2-3-1 (src/myTeam/tactics/preview.ts), is picked
// up and swapped with Watkins on the bench; the move saves itself, the pitch shows Watkins in his
// place and Haaland on the bench, and the line under the toolbar says when it saved. Fails on any
// console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { MY_TEAM_PATH } from "../../src/frame/menu";
import { previewAddress } from "../../src/app/preview";
import { moveLabel, pitchLabel, playerOnPitchLabel, savedWords, selectionTableLabel, swapLabel } from "../../src/myTeam/tactics/words";
import { DESK } from "../../scripts/viewports.mjs";
import { test } from "../support/smoke/errorsTest";

/** The preview's striker and the striker on its bench. */
const HAALAND = "Haaland";
const WATKINS = "Watkins";
/** Up front, where Haaland starts. */
const UP_FRONT = { area: "attack", lane: "centre" } as const;
/** The clock the page reads, so the saved line's time is known. */
const NOW = new Date("2026-11-11T14:02:00").getTime();

test.describe("the lineup, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  test("swaps a starter with a bench player, saves, and the pitch shows it", async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await page.goto(previewAddress(MY_TEAM_PATH, "manager"));
    const pitch = page.getByRole("group", { name: pitchLabel });
    const onPitch = (name: string) => pitch.getByRole("button", { name: playerOnPitchLabel(name, ["ST"], UP_FRONT.area, UP_FRONT.lane) });
    await expect(onPitch(HAALAND)).toBeVisible();

    await page.getByRole("table", { name: selectionTableLabel }).getByRole("button", { name: HAALAND, exact: true }).click();
    await page.getByRole("button", { name: moveLabel(HAALAND) }).click();
    await page.getByRole("button", { name: swapLabel(HAALAND, WATKINS) }).first().click();

    await expect(onPitch(WATKINS)).toBeVisible();
    await expect(onPitch(HAALAND)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: savedWords(NOW) })).toBeVisible();
  });
});
