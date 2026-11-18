// The regression catalogue's screens-and-routes cases at the E2E level, part 2 (#2306), in a real
// browser on the dev server's preview at the desk's 1440x900: the links docs/design/flow.md draws
// between the league frame's pages, the player card's Back, the invite link, and an address that
// keeps what is selected through a refresh. Each test's name carries its case ID and the flow,
// README or spec line it checks; each fails on any console or page error (errorsTest.ts).
// Part 1's are in screensAndRoutes.spec.ts; this part's Integration cases in
// tests/src/routes/linksAndRoutes.test.tsx.

import { expect, type Page } from "@playwright/test";
import { HOME_NEWS_PATH, HOME_PATH, MAIL_PATH, MATCHUP_PATH, MY_TEAM_PATH, PREMIER_LEAGUE_PATH, SCOUTING_PATH, TABLE_PATH, TRADES_NEW_PATH, TRADES_PATH } from "../../src/frame/menu";
import { RECAP_PATH } from "../../src/home/paths";
import { backHomeLink, LETTER_TITLE, moreOnNewsLink, readRecapLink } from "../../src/home/words";
import { invitesPath } from "../../src/joining/paths";
import { inviteLinkWords, joinPageWords } from "../../src/joining/words";
import { gameweekWords, nextLabel, openBreakdownLabel, previousLabel } from "../../src/matchup/words";
import { otherTeamPath } from "../../src/myTeam/paths";
import { previewSquad } from "../../src/myTeam/tactics/preview";
import { setRoleWords } from "../../src/myTeam/squad/words";
import { closeSelectedLabel, pitchLabel, playerOnPitchLabel } from "../../src/myTeam/tactics/words";
import { joinPath } from "../../convex/joining/joiningShared";
import { playerCardPath } from "../../src/playerCard/paths";
import { backWords } from "../../src/playerCard/words";
import { MATCH_ROUTE } from "../../src/premierLeague/paths";
import { availabilityWords } from "../../src/scouting/words";
import { previewPlayers } from "../../src/scouting/preview";
import { miniBeta, previewGameweek, proLeague } from "../../src/shared/preview";
import { previewIdOf } from "../../src/table/preview";
import { counterWords, offerToYouTitle, tickLabel } from "../../src/trades/words";
import { FIXTURES_TITLE } from "../../src/table/words";
import { DESK } from "../../scripts/viewports.mjs";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

const L1 = proLeague.leagueId;
const SAKA = previewPlayers.find((player) => player.name === "Saka")!;
/** The preview's offer to the manager: Kroos Control's Gyökeres for his Palmer and Muñoz (src/trades/preview.ts). */
const OFFER = "preview-offer-1";
const OFFER_FROM = "Kroos Control";

const h1 = (page: Page, name: string) => page.getByRole("heading", { level: 1, name, exact: true });
/** Clicks the name linking to Saka's card on another team's page and expects his card to open. The
 *  team page's preview names its squad from Tactics' preview, which numbers its players apart from
 *  the card's, so the name on that link is another's. */
async function opensSakasCard(page: Page) {
  await page.getByRole("main").locator(`a[href="${playerCardPath(L1, SAKA.code)}"]`).click();
  await expect(page).toHaveURL((url) => url.pathname === playerCardPath(L1, SAKA.code));
  await expect(h1(page, SAKA.fullName)).toBeVisible();
}
const sakasTeam = otherTeamPath(L1, previewIdOf(SAKA.ownerTeamName!));
/** Whether the address is Saka's owner's team page's. */
const onSakasTeam = (url: URL) => decodeURIComponent(url.pathname) === sakasTeam;
/** Whether the address is a match page's. */
const onMatchPage = (url: URL) => new RegExp(`^${MATCH_ROUTE.replace("$fixtureCode", "\\d+")}$`).test(url.pathname);

test.use({ viewport: DESK });

test.describe("links and routes, on the dev server's preview", { tag: "@dev" }, () => {
  test("UI-092 (flow.md:115, table README Fixtures): a manager on the Table clicks a played fixture's score and lands on that game's matchup in that gameweek", async ({ page }) => {
    await page.goto(previewUrl(TABLE_PATH, "manager"));
    const fixtures = page.getByRole("region", { name: FIXTURES_TITLE, exact: true });
    // The preview's fixtures open on the gameweek to come; the one before is scored.
    await fixtures.getByRole("button", { name: previousLabel }).click();
    const score = fixtures.getByRole("listitem").first().getByRole("link");
    await expect(score).toHaveText(/\d–/);
    const href = new URL((await score.getAttribute("href"))!, page.url());
    await score.click();
    await expect(page).toHaveURL((url) => url.pathname === MATCHUP_PATH && url.search === href.search);
    const gameweek = Number(href.searchParams.get("gameweek"));
    await expect(page.getByRole("navigation", { name: gameweekWords(gameweek) })).toBeVisible();
  });

  test(`UI-093 (flow.md:117-118): a manager on League home clicks ${readRecapLink}, then ${backHomeLink}`, async ({ page }) => {
    await page.goto(previewUrl(HOME_PATH, "manager"));
    await page.getByRole("link", { name: readRecapLink, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === RECAP_PATH);
    await page.getByRole("link", { name: backHomeLink, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === HOME_PATH);
    await expect(page.getByRole("link", { name: readRecapLink, exact: true })).toBeVisible();
  });

  test(`UI-094 (flow.md:119-120, home README News): a manager on League home clicks ${moreOnNewsLink}, then the pinned letter, and lands in Mail`, async ({ page }) => {
    await page.goto(previewUrl(HOME_PATH, "manager"));
    await page.getByRole("link", { name: moreOnNewsLink, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === HOME_NEWS_PATH);
    await page.getByRole("link", { name: new RegExp(`^${LETTER_TITLE}`) }).click();
    await expect(page).toHaveURL((url) => url.pathname === MAIL_PATH);
  });

  test("UI-096 (flow.md:121): a manager on an offer to him clicks Counter and lands on New offer filled with the offer it answers", async ({ page }) => {
    await page.goto(previewUrl(`${TRADES_PATH}?offer=${OFFER}`, "manager"));
    await page.getByRole("button", { name: counterWords, exact: true }).or(page.getByRole("link", { name: counterWords, exact: true })).click();
    await expect(page).toHaveURL((url) => url.pathname === TRADES_NEW_PATH && url.searchParams.get("counter") === OFFER);
    for (const name of ["Gyökeres", "Palmer", "Muñoz"]) await expect(page.getByRole("checkbox", { name: tickLabel(name) })).toBeChecked();
  });

  test("UI-097 (flow.md:125, matchup README ◄ ►): a manager on the matchup clicks ◄ then ►, the address changing each step", async ({ page }) => {
    await page.goto(previewUrl(MATCHUP_PATH, "manager"));
    const stepper = (gameweek: number) => page.getByRole("navigation", { name: gameweekWords(gameweek) });
    await stepper(previewGameweek).getByRole("link", { name: previousLabel }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("gameweek") === String(previewGameweek - 1));
    await stepper(previewGameweek - 1).getByRole("link", { name: nextLabel }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("gameweek") === String(previewGameweek));
    await expect(stepper(previewGameweek)).toBeVisible();
  });

  test("UI-098 (flow.md:126, spec/12 The player card): a manager on Scouting clicks a player's name and lands on his card", async ({ page }) => {
    await page.goto(previewUrl(SCOUTING_PATH, "manager"));
    // Scouting opens on free agents (#1028); Saka is the manager's own.
    await page.getByText(availabilityWords.all, { exact: true }).click();
    await page.getByRole("link", { name: SAKA.name, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === playerCardPath(L1, SAKA.code));
    await expect(h1(page, SAKA.fullName)).toBeVisible();
  });

  test("UI-099 (flow.md:129-130): a manager on Saka's card clicks his owner's name, then a player's name on that team", async ({ page }) => {
    await page.goto(previewUrl(playerCardPath(L1, SAKA.code), "manager"));
    await page.getByRole("link", { name: SAKA.ownerTeamName!, exact: true }).click();
    await expect(page).toHaveURL(onSakasTeam);
    await opensSakasCard(page);
  });

  // A player's status on the matchup is the match line in his breakdown: its clubs, score and clock.
  test("UI-100 (flow.md:132): a manager on the matchup opens a player's breakdown and clicks his match's status, landing on the match", async ({ page }) => {
    await page.goto(previewUrl(`${MATCHUP_PATH}?minute=60`, "manager"));
    await page.getByRole("button", { name: openBreakdownLabel("Haaland") }).click();
    await page.getByRole("region", { name: /Haaland/ }).getByRole("link", { name: /\d/ }).first().click();
    await expect(page).toHaveURL(onMatchPage);
  });

  test("UI-101 (flow.md:133, premier-league README): a manager on Premier League clicks a fixture's score or v and lands on the match", async ({ page }) => {
    await page.goto(previewUrl(PREMIER_LEAGUE_PATH, "manager"));
    await page.getByRole("link", { name: /: the match$/ }).first().click();
    await expect(page).toHaveURL(onMatchPage);
  });

  test("UI-102 (flow.md:127, player-card README Back, spec/12 The player card): Back returns to the page the card was opened from, and to Scouting when opened from a link", async ({ page }) => {
    await page.goto(previewUrl(sakasTeam, "manager"));
    await opensSakasCard(page);
    await page.getByRole("button", { name: backWords, exact: true }).click();
    await expect(page).toHaveURL(onSakasTeam);

    await page.goto(previewUrl(playerCardPath(L1, SAKA.code), "manager"));
    await page.getByRole("button", { name: backWords, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === SCOUTING_PATH);
  });

  test("UI-103 (flow.md:72): the invite link the commissioner copies from Invites opens the league's join page", async ({ page }) => {
    // The preview's invite link is Mini beta's (src/joining/preview.ts), whose Invites only the
    // preview admin can open, his powers standing in for its commissioner's.
    await page.goto(previewUrl(invitesPath(miniBeta.leagueId), "admin"));
    const link = new URL(await page.getByRole("textbox", { name: inviteLinkWords.label }).inputValue());
    expect(link.pathname.startsWith(joinPath(""))).toBe(true);
    // Someone signed in who isn't in Mini beta: the preview manager stands in for new@example.com.
    await page.goto(previewUrl(link.pathname, "manager"));
    await expect(page).toHaveURL((url) => url.pathname === link.pathname);
    await expect(h1(page, joinPageWords.title)).toBeVisible();
    await expect(page.getByRole("main")).toContainText(miniBeta.name);
  });

  // Selecting him on the pitch opens his role card and leaves the address as it is, so only a
  // selection the address names comes back after a refresh: the one Set his role opens (spec/12).
  test(`UI-105 (spec/12 My team, ${setRoleWords}): a refresh of Tactics opened with Saka selected reopens it with him selected and the lineup unchanged`, async ({ page }) => {
    const saka = previewSquad.find(({ name }) => name === SAKA.name)!;
    await page.goto(previewUrl(`${MY_TEAM_PATH}?player=${saka.playerCode}`, "manager"));
    const close = page.getByRole("button", { name: closeSelectedLabel(SAKA.name) });
    // The preview's 4-2-3-1 starts him on the right of the attacking midfield (src/myTeam/tactics/preview.ts).
    const onPitch = page.getByRole("group", { name: pitchLabel }).getByRole("button", { name: playerOnPitchLabel(SAKA.name, saka.positions, "attackingMidfield", "right") });
    await expect(close).toBeVisible();
    await expect(onPitch).toBeVisible();
    await page.reload();
    await expect(close).toBeVisible();
    await expect(onPitch).toBeVisible();
  });

  test("UI-106 (flow.md:121, the Offers tab's address): an offer selected stays selected through a refresh, and Back and Forward step the address", async ({ page }) => {
    await page.goto(previewUrl(TABLE_PATH, "manager"));
    await page.goto(previewUrl(`${TRADES_PATH}?offer=${OFFER}`, "manager"));
    const panel = page.getByRole("region", { name: offerToYouTitle(OFFER_FROM) });
    await expect(panel).toBeVisible();
    await page.reload();
    await expect(panel).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === TABLE_PATH);
    await page.goForward();
    await expect(page).toHaveURL((url) => url.pathname === TRADES_PATH && url.searchParams.get("offer") === OFFER);
    await expect(panel).toBeVisible();
  });
});
