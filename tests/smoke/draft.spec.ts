// The draft room in a real browser on the dev server's preview (#1665): the reader's Saka Potatoes
// on the clock at 4.03 (src/draft/preview.ts), a player he may take selected, his panel saying what
// the squad holds, and the pick made. Fails on any console or page error (errorsTest.ts).
// The journey stops at the pick: the preview's pick changes nothing (its makePick saves nothing and
// its board is fixed), so neither the board nor the squad can show it there.

import { expect } from "@playwright/test";
import { DRAFT_PATH } from "../../src/frame/menu";
import { draftPlayerWords, pickLeftWords, selectLabel, slotWords, yourSquadWords } from "../../src/draft/words";
import { test } from "../support/smoke/errorsTest";

/** A free agent the preview's team may take: Rice and Raya are greyed by its Arsenal maximum. */
const PICK = "Salah";

test.describe("the draft room, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("selects a player the reader may take, and drafts him", async ({ page }) => {
    await page.goto(`${DRAFT_PATH}?preview=manager`);
    await page.getByRole("button", { name: selectLabel(PICK) }).click();

    // The squad so far: Mbeumo, Rice and Saliba, so one winger and no Liverpool player of two.
    await expect(page.getByText(yourSquadWords("W", 1, "LIV", 0, 2), { exact: true })).toBeVisible();
    const draft = page.getByRole("button", { name: draftPlayerWords(PICK) });
    await expect(draft).toHaveAccessibleDescription(new RegExp(`^${pickLeftWords(slotWords(4, 3))}`));
    await expect(draft).toBeEnabled();
    await draft.click();
    // The preview took it without a refusal.
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
