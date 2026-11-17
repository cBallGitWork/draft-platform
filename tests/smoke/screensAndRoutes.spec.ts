// The regression catalogue's screens-and-routes cases at the E2E level (#2305), in a real browser on
// the dev server's preview at the desk's 1440x900: the player card opened from the address bar, and
// the links docs/design/flow.md draws between the league pages. Each test's name carries its case ID
// and the flow or spec line it checks; each fails on any console or page error (errorsTest.ts).
// The Integration-level cases are in tests/src/routes/screensAndRoutes.test.tsx.

import { expect, type Page } from "@playwright/test";
import { ADMIN_AVAILABILITY_PATH, ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../src/admin/paths";
import { ADMIN_TITLE, adminTabsLabel, availabilityTabWords, feedbackTabWords, feedsTabWords, positionsTabWords } from "../../src/admin/words";
import { MY_TEAM_PATH } from "../../src/frame/menu";
import { playerCardLabel, selectionTableLabel } from "../../src/myTeam/tactics/words";
import { gameweeksPath } from "../../src/gameweeks/paths";
import { joinPath } from "../../convex/joining/joiningShared";
import { invitesPath } from "../../src/joining/paths";
import { settingsPath } from "../../src/leagueSettings/paths";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../src/leagues/paths";
import { backToLeaguesWords, LEAGUES_TITLE, NEW_LEAGUE_TITLE } from "../../src/leagues/words";
import { PATCH_NOTES_PATH } from "../../src/patches/paths";
import { PATCH_NOTES_TITLE, patchNotesLinkWords } from "../../src/patches/words";
import { playerCardPath } from "../../src/playerCard/paths";
import { scoringPath } from "../../src/scoring/paths";
import { SCORING_TITLE } from "../../src/scoring/words";
import { previewPlayers } from "../../src/scouting/preview";
import { proLeague } from "../../src/shared/preview";
import { squadsPath } from "../../src/squads/paths";
import { DESK } from "../../scripts/viewports.mjs";
import { test } from "../support/smoke/errorsTest";
import { expectPageSound } from "../support/smoke/pageChecks";
import { previewUrl } from "../support/smoke/previewUrl";

const L1 = proLeague.leagueId;
const SAKA = previewPlayers.find((player) => player.name === "Saka")!;

const h1 = (page: Page, name: string) => page.getByRole("heading", { level: 1, name, exact: true });

test.use({ viewport: DESK });

test.describe("screens and routes, on the dev server's preview", { tag: "@dev" }, () => {
  test("UI-030 (flow.md:47, spec/12 The player card): a commissioner opening a player's card from the address bar sees it titled with his full name, no wider than the window", async ({ page }) => {
    await page.goto(previewUrl(playerCardPath(L1, SAKA.code), "commissioner"));
    await expect(h1(page, SAKA.fullName)).toBeVisible();
    await expectPageSound(page);
  });

  test(`UI-071 (flow.md:55): the admin's ${NEW_LEAGUE_TITLE} on Your leagues lands on /leagues/new`, async ({ page }) => {
    await page.goto(previewUrl(LEAGUES_PATH, "admin"));
    await page.getByRole("link", { name: NEW_LEAGUE_TITLE, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === NEW_LEAGUE_PATH);
    await expect(h1(page, NEW_LEAGUE_TITLE)).toBeVisible();
  });

  test("UI-073 (flow.md:57-58, 64-67): each admin tab lands on its page, the dashboard's title staying and the clicked tab marked", async ({ page }) => {
    await page.goto(previewUrl(ADMIN_PATH, "admin"));
    const tabs = page.getByRole("navigation", { name: adminTabsLabel });
    for (const [label, path] of [
      [feedsTabWords, ADMIN_FEEDS_PATH],
      [feedbackTabWords, ADMIN_FEEDBACK_PATH],
      [availabilityTabWords, ADMIN_AVAILABILITY_PATH],
      [positionsTabWords, ADMIN_PATH],
    ]) {
      await tabs.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === path);
      await expect(h1(page, ADMIN_TITLE)).toBeVisible();
      await expect(tabs.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    }
  });

  for (const path of [gameweeksPath(L1), squadsPath(L1), scoringPath(L1), invitesPath(L1), ADMIN_PATH, ADMIN_FEEDS_PATH, ADMIN_FEEDBACK_PATH, ADMIN_AVAILABILITY_PATH, NEW_LEAGUE_PATH]) {
    test(`UI-074 (flow.md:68, 70): the admin's ${backToLeaguesWords} on ${path} lands on Your leagues`, async ({ page }) => {
      await page.goto(previewUrl(path, "admin"));
      await page.getByRole("link", { name: backToLeaguesWords, exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === LEAGUES_PATH);
      await expect(h1(page, LEAGUES_TITLE)).toBeVisible();
    });
  }

  test(`UI-074 (flow.md:69): the admin's ${backToLeaguesWords} on League settings lands on Your leagues`, async ({ page }) => {
    await page.goto(previewUrl(settingsPath(L1), "admin"));
    await page.getByRole("link", { name: backToLeaguesWords, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === LEAGUES_PATH);
    await expect(h1(page, LEAGUES_TITLE)).toBeVisible();
  });

  // The preview treats every invite link as a live one but "gone", which it treats as one that no
  // longer works, as tok123 is on the live site: only then does the page offer Your leagues.
  test("UI-075 (flow.md:71): a manager on an invite link that doesn't work clicks Your leagues and lands on Your leagues", async ({ page }) => {
    await page.goto(previewUrl(joinPath("gone"), "manager"));
    await page.getByRole("main").getByRole("link", { name: LEAGUES_TITLE, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === LEAGUES_PATH);
    await expect(h1(page, LEAGUES_TITLE)).toBeVisible();
  });

  test("UI-076 (flow.md:66, spec/14 Changes and corrections): a manager on Player scoring clicks Patch notes and lands on them", async ({ page }) => {
    await page.goto(previewUrl(scoringPath(L1), "manager"));
    await page.getByRole("region", { name: SCORING_TITLE }).getByRole("link", { name: patchNotesLinkWords, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === PATCH_NOTES_PATH);
    await expect(h1(page, PATCH_NOTES_TITLE)).toBeVisible();
  });

  // A name on My team's Tactics tab picks him out; his card opens from the panel's Player card (#2349).
  test("UI-091 (flow.md:94): a manager on My team clicks a player's name, then Player card, and lands on his card", async ({ page }) => {
    await page.goto(previewUrl(MY_TEAM_PATH, "manager"));
    await page.getByRole("table", { name: selectionTableLabel }).getByRole("button", { name: SAKA.name, exact: true }).click();
    await page.getByRole("link", { name: playerCardLabel(SAKA.name), exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === playerCardPath(L1, SAKA.code));
    await expect(h1(page, SAKA.fullName)).toBeVisible();
  });
});
