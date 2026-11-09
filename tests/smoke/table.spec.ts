// The table and fixtures (#1029), in a real browser on the dev server's preview: the League tab's
// table, a score in Fixtures opening its matchup, and the Cup tab's empty eight-team bracket. Fails
// on any console or page error (errorsTest.ts).

import { expect } from "@playwright/test";
import { MATCHUP_PATH, TABLE_PATH } from "../../src/frame/menu";
import { previousGameweekLabel } from "../../src/shared/words";
import { competitionsLabel, competitionWords, CUP_TITLE, cupRounds, FIXTURES_TITLE, TABLE_PAGE_TITLE, TABLE_TITLE, type Competition } from "../../src/table/words";
import { test } from "../support/smoke/errorsTest";

test.describe("the table and fixtures, on the dev server's preview", { tag: "@dev" }, () => {
  test("shows the League tab's table, opens a score's matchup, and shows the Cup tab's empty bracket", async ({ page }) => {
    const tab = (competition: Competition) =>
      page.getByRole("group", { name: competitionsLabel }).getByRole("button", { name: competitionWords[competition], exact: true });

    await page.goto(`${TABLE_PATH}?preview=manager`);
    await expect(page.getByRole("heading", { level: 1, name: TABLE_PAGE_TITLE })).toBeVisible();
    await expect(tab("league")).toHaveAttribute("aria-pressed", "true");
    const region = (name: string) => page.getByRole("region", { name, exact: true });
    await expect(region(TABLE_TITLE).getByRole("row")).not.toHaveCount(0);

    await tab("cup").click();
    const cup = region(CUP_TITLE);
    await expect(cup.getByRole("img")).toHaveCount(7);
    for (const round of cupRounds) await expect(cup.getByRole("heading", { name: round, exact: true })).toBeVisible();
    await expect(region(TABLE_TITLE)).toHaveCount(0);

    await tab("league").click();
    const fixtures = region(FIXTURES_TITLE);
    // The preview's fixtures open on the gameweek to come; the one before is scored.
    await fixtures.getByRole("button", { name: previousGameweekLabel }).click();
    const score = fixtures.getByRole("listitem").first().getByRole("link");
    await expect(score).toHaveText(/\d–/);
    await score.click();
    await expect(page).toHaveURL((url) => url.pathname === MATCHUP_PATH && url.searchParams.has("gameweek"));
  });
});
