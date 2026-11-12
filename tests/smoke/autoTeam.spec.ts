// The auto team's screens (#1209, spec/09; docs/design/approved/auto-team/), in a real browser on
// the dev server's preview: My team's switch opening its panel and switching on, the table's mark on
// a team on the auto team, and a commissioner's fixture swap. Fails on any console or page error
// (errorsTest.ts).

import { expect } from "@playwright/test";
import { MY_TEAM_PATH, TABLE_PATH } from "../../src/frame/menu";
import { autoTeamHead, switchOnWords, untilSwitchedOffWords } from "../../src/myTeam/header/words";
import { autoTeamWords } from "../../src/shared/words";
import { editingWords, FIXTURES_TITLE, saveSwapWords, swapUnsavedOutcome, TABLE_TITLE } from "../../src/table/words";
import { DESK } from "../../scripts/viewports.mjs";
import { previewSaid } from "../../src/shared/preview";
import { previewAutoTeam } from "../../src/table/preview";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

test.describe("the auto team, on the dev server's preview", { tag: "@dev" }, () => {
  test.use({ viewport: DESK });

  test("My team's switch opens its panel, and Switch on closes it", async ({ page }) => {
    await page.goto(previewUrl(MY_TEAM_PATH, "manager"));
    await page.getByRole("button", { expanded: false, name: /^Off/ }).click();
    const panel = page.getByRole("region", { name: autoTeamHead, exact: true });
    await expect(panel).toBeVisible();
    await panel.getByRole("radio", { name: untilSwitchedOffWords }).check();
    await panel.getByRole("button", { name: switchOnWords }).click();
    await expect(panel).toHaveCount(0);
  });

  test("the table marks a team on the auto team", async ({ page }) => {
    await page.goto(previewUrl(TABLE_PATH, "manager"));
    const row = page.getByRole("region", { name: TABLE_TITLE, exact: true }).getByRole("row").filter({ hasText: previewAutoTeam });
    await expect(row.getByText(autoTeamWords, { exact: true })).toBeVisible();
  });

  test("the commissioner picks a side in two games, and Save swap sends the swap", async ({ page }) => {
    await page.goto(previewUrl(TABLE_PATH, "commissioner"));
    const fixtures = page.getByRole("region", { name: new RegExp(`^${FIXTURES_TITLE}`) });
    const games = fixtures.getByRole("listitem");
    await games.nth(0).getByRole("button", { name: /^Swap / }).first().click();
    await expect(fixtures.getByText(editingWords, { exact: true })).toBeVisible();
    const save = fixtures.getByRole("button", { name: saveSwapWords });
    await expect(save).toBeDisabled();
    await games.nth(1).getByRole("button", { name: /^Swap / }).first().click();
    await expect(games.nth(1).getByRole("button", { pressed: true })).toHaveCount(1);
    await save.click();
    // The preview holds no server, so it says the fixtures didn't change.
    await expect(fixtures.getByRole("alert")).toContainText(previewSaid(swapUnsavedOutcome));
  });
});
