// The regression catalogue's screens-and-routes cases, part 3, at the E2E level (#2307), in a real
// browser on the dev server's preview at the desk's 1440x900: the plate's look on every built
// screen, and the links League home, My team's Squad tab and the draft room open. Each test's name
// carries its case ID and the spec or design line it checks; each fails on any console or page error
// (errorsTest.ts). The Integration-level cases, and the E2E ones whose state the preview can't hold
// (a pre-season League home, a draft starting tomorrow, a deletion undone, a trade-offer letter),
// are in tests/src/routes/emptyStatesAndLinks.test.tsx.

import { expect, type Page } from "@playwright/test";
import { BOARD_TITLE, PLAYERS_TITLE, QUEUE_TITLE, queueListLabel, selectLabel } from "../../src/draft/words";
import { DRAFT_PATH, HOME_PATH, MAIL_PATH, MY_TEAM_PATH, MY_TEAM_SQUAD_PATH, PREMIER_LEAGUE_PATH } from "../../src/frame/menu";
import { mainMenuLabel, sectionTabsLabel } from "../../src/frame/words";
import { allFixturesLink, stripLabel } from "../../src/home/words";
import { allMailWords, closePanelLabel, openPanelLabel, setRoleWords } from "../../src/myTeam/squad/words";
import { playerCardPath } from "../../src/playerCard/paths";
import { previewPlayers } from "../../src/scouting/preview";
import { addToQueueWords, playerCardWords } from "../../src/shared/words";
import { proLeague } from "../../src/shared/preview";
import { DESK } from "../../scripts/viewports.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { test } from "../support/smoke/errorsTest";
import { previewUrl } from "../support/smoke/previewUrl";

const L1 = proLeague.leagueId;
const SAKA = previewPlayers.find((player) => player.name === "Saka")!;
const SALAH = previewPlayers.find((player) => player.name === "Salah")!;

const h1 = (page: Page, name: string) => page.getByRole("main").getByRole("heading", { level: 1, name, exact: true });

/** Each built screen opened on the preview, its title shown, and what `breaks` finds on it, each
 *  break led by the screen it is on. */
async function breaksOnEachBuiltScreen(page: Page, breaks: () => Promise<string[]>) {
  const found: string[] = [];
  for (const [session, path, title] of BUILT_SCREENS) {
    const url = previewUrl(path, session);
    await page.goto(url);
    await expect(h1(page, title)).toBeVisible();
    found.push(...(await breaks()).map((each) => `${url}: ${each}`));
  }
  return found;
}

/** The plate's Shape rules for the bevel and the tabs, read off the page (plate.md:91-95): the top bar
 *  and the page's title plate carry the 2px bevel; the menu's and a section's tabs are butted, ruled
 *  1px apart, 44px and 36px tall. Each break, in words. Self-contained, for page.evaluate. */
function shapeBreaks([menuLabel, sectionLabel]: string[]): string[] {
  const bevelled = (element: Element | null) => {
    const shadow = element === null ? "" : getComputedStyle(element).boxShadow;
    return shadow.includes("0px 2px 0px 0px inset") && shadow.includes("0px -2px 0px 0px inset");
  };
  const breaks: string[] = [];
  const bar = document.querySelector("header");
  if (bar === null || ![bar, ...bar.querySelectorAll("*")].some(bevelled)) breaks.push("the top bar has no 2px bevel");
  const title = document.querySelector("main h1");
  // A page whose approved picture draws no title plate keeps its title for screen readers alone.
  const plated = title !== null && getComputedStyle(title).position !== "absolute";
  // The plate is the title or the nearest box round it that is bevelled, short of the page itself.
  const plateOf = (element: Element | null): Element | null =>
    element === null || element.tagName === "MAIN" || bevelled(element) ? element : plateOf(element.parentElement);
  if (plated && !bevelled(plateOf(title))) breaks.push("the title plate has no 2px bevel");
  const tabsIn = (label: string, height: number) => {
    const nav = document.querySelector(`nav[aria-label="${label}"]`);
    const tabs = nav === null ? [] : [...nav.querySelectorAll("a")];
    tabs.forEach((tab, at) => {
      const box = tab.getBoundingClientRect();
      if (Math.round(box.height) !== height) breaks.push(`${label}: ${tab.textContent} is ${Math.round(box.height)}px tall, not ${height}px`);
      if (at === 0) return;
      const before = tabs[at - 1].getBoundingClientRect();
      if (before.top === box.top && Math.abs(box.left - before.right) > 0.5) breaks.push(`${label}: a gap before ${tab.textContent}`);
      if (getComputedStyle(tab).borderLeftWidth !== "1px") breaks.push(`${label}: no 1px rule before ${tab.textContent}`);
    });
  };
  tabsIn(menuLabel, 44);
  tabsIn(sectionLabel, 36);
  return breaks;
}

/** The page's ground and its panels (plate.md:29-36, 212-213): the ground drawn in CSS, a glow over
 *  a grain and no photograph, and each panel see-through and neutral, never a blue body. Each break,
 *  in words. Self-contained, for page.evaluate. */
function groundBreaks(): string[] {
  const breaks: string[] = [];
  const image = getComputedStyle(document.documentElement).backgroundImage;
  if (!image.includes("radial-gradient")) breaks.push("the ground has no glow from the top");
  const urls = image.match(/url\("([^"]*)"\)/g) ?? [];
  if (urls.length === 0) breaks.push("the ground has no grain");
  if (urls.some((url) => !url.startsWith('url("data:image/svg+xml'))) breaks.push("the ground is a photograph");
  // A title plate, such as the player card's head or the matchup's score band, is the plate's indigo
  // by rule (plate.md, Colour roles): only a panel's body is held to the neutral ground.
  const probe = document.createElement("span");
  probe.style.backgroundColor = "var(--color-plate)";
  document.body.append(probe);
  const plate = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const panels = [...document.querySelectorAll("main section")].filter((section) => {
    const colour = getComputedStyle(section).backgroundColor;
    return colour !== "rgba(0, 0, 0, 0)" && colour !== plate;
  });
  for (const panel of panels) {
    const [r, g, b, a = 1] = (getComputedStyle(panel).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    const name = panel.getAttribute("aria-label") ?? panel.querySelector("h1, h2, h3")?.textContent ?? "a panel";
    if (a >= 1) breaks.push(`${name}: its body is solid, not see-through`);
    if (b - Math.max(r, g) > 16) breaks.push(`${name}: its body is blue`);
  }
  return breaks;
}

/** The colours the page draws: the ground under it, and its text. Self-contained, for page.evaluate. */
const pageColours = () => ({
  ground: getComputedStyle(document.documentElement).backgroundColor,
  text: getComputedStyle(document.body).color,
  scheme: getComputedStyle(document.documentElement).colorScheme,
});

/** Every button and tab drawn in the figure colour, its text, its body or its edge (plate.md:45,
 *  209-210), each named. Self-contained, for page.evaluate. */
function yellowControls(): string[] {
  const probe = document.createElement("span");
  probe.style.color = "var(--color-figure)";
  document.body.append(probe);
  const yellow = getComputedStyle(probe).color;
  probe.remove();
  const controls = [...document.querySelectorAll("button, [role='tab'], nav a")].filter((control) => {
    const { width, height } = control.getBoundingClientRect();
    return width > 1 && height > 1;
  });
  return controls
    .filter((control) => {
      const style = getComputedStyle(control);
      return [style.color, style.backgroundColor, style.borderTopColor, style.borderBottomColor].includes(yellow);
    })
    .map((control) => control.getAttribute("aria-label") ?? (control.textContent ?? "").trim().slice(0, 30));
}

test.use({ viewport: DESK });

test.describe("the plate's look on every built screen, on the dev server's preview", { tag: "@dev" }, () => {
  test.slow();

  test("UI-175 (plate.md:91-95): the top bar and the title plates carry the 2px bevel; tabs are butted with 1px rules, 44px tall, a section's 36px", async ({ page }) => {
    expect(await breaksOnEachBuiltScreen(page, () => page.evaluate(shapeBreaks, [mainMenuLabel, sectionTabsLabel]))).toEqual([]);
  });

  test("UI-176 (plate.md:29-36, 212-213): the ground is drawn in CSS, a glow over a grain, and the panels are see-through and neutral", async ({ page }) => {
    expect(await breaksOnEachBuiltScreen(page, () => page.evaluate(groundBreaks))).toEqual([]);
  });

  test("UI-177 (spec/12 The frame: dark only): with the system in light mode, every screen stays dark", async ({ page }) => {
    // The frame draws the same ground and text on every screen, so one screen in dark mode is the
    // measure for each in light.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(previewUrl(HOME_PATH, "manager"));
    const dark = await page.evaluate(pageColours);
    expect(dark.scheme).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    const differing = async () => {
      const light = await page.evaluate(pageColours);
      return JSON.stringify(light) === JSON.stringify(dark) ? [] : [JSON.stringify(light)];
    };
    expect(await breaksOnEachBuiltScreen(page, differing)).toEqual([]);
  });

  test("UI-178 (plate.md:45, 209-210): no button or tab is yellow; yellow is for figures alone", async ({ page }) => {
    expect(await breaksOnEachBuiltScreen(page, () => page.evaluate(yellowControls))).toEqual([]);
  });
});

test.describe("League home, My team's Squad tab and the draft room, on the dev server's preview", { tag: "@dev" }, () => {
  test("UI-185 (S12.9, S12.10; approved/home README:71): none of the deadline strip's four boxes opens anything, and Your lineup reads", async ({ page }) => {
    await page.goto(previewUrl(HOME_PATH, "manager"));
    const strip = page.getByRole("list", { name: stripLabel });
    const boxes = strip.getByRole("listitem");
    await expect(boxes).toHaveCount(4);
    await expect(strip.getByRole("link")).toHaveCount(0);
    await expect(strip.getByRole("button")).toHaveCount(0);
    for (const box of await boxes.all()) {
      await box.click();
      await expect(page).toHaveURL((url) => url.pathname === HOME_PATH);
    }
    await expect(boxes.nth(1)).not.toHaveText(/^\s*$/);
  });

  test("UI-186 (S12.12; approved/home README:73): All fixtures opens the Premier League, and All mail opens Mail", async ({ page }) => {
    await page.goto(previewUrl(HOME_PATH, "manager"));
    await page.getByRole("link", { name: allFixturesLink, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === PREMIER_LEAGUE_PATH);
    await page.goBack();
    await page.getByRole("link", { name: allMailWords, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === MAIL_PATH);
  });

  test(`UI-188 (approved/team-squad README:29-32, spec/12 My team): Saka's row opens his season; ${setRoleWords}, ${playerCardWords} and the cross do as they say`,async ({ page }) => {
    await page.goto(previewUrl(MY_TEAM_SQUAD_PATH, "manager"));
    const open = () => page.getByRole("button", { name: openPanelLabel(SAKA.name), exact: true }).click();
    const panel = page.getByRole("region", { name: SAKA.name, exact: true });

    await open();
    // My team's preview squad holds its own Saka, by another code than Scouting's.
    const cardLink = panel.getByRole("link", { name: new RegExp(`^${playerCardWords}`) });
    const sakaCode = (await cardLink.getAttribute("href"))!.split("/").at(-1);
    await panel.getByRole("link", { name: setRoleWords, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === MY_TEAM_PATH && url.searchParams.get("player") === sakaCode);

    await page.goBack();
    await open();
    await cardLink.click();
    // The preview's cards hold only Scouting's players, so his card's address is what is checked.
    await expect(page).toHaveURL((url) => url.pathname === playerCardPath(L1, Number(sakaCode)));

    await page.goBack();
    await open();
    await panel.getByRole("button", { name: closePanelLabel(SAKA.name), exact: true }).click();
    await expect(panel).toHaveCount(0);
  });

  test(`UI-190 (approved/draft-room README:36-42): a player's ${playerCardWords} opens his card, Back returns to the live room, and ${addToQueueWords} queues him`,async ({ page }) => {
    await page.goto(previewUrl(DRAFT_PATH, "manager"));
    const players = page.getByRole("region", { name: new RegExp(`^${PLAYERS_TITLE}`) });
    const select = () => players.getByRole("button", { name: selectLabel(SALAH.name) }).click();

    await select();
    await page.getByRole("link", { name: new RegExp(`^${playerCardWords}`) }).click();
    await expect(page).toHaveURL((url) => url.pathname === playerCardPath(L1, SALAH.code));
    await expect(h1(page, SALAH.fullName)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === DRAFT_PATH);
    await expect(page.getByRole("region", { name: BOARD_TITLE, exact: true })).toBeVisible();
    await select();
    await page.getByRole("button", { name: addToQueueWords, exact: true }).click();
    const queue = page.getByRole("region", { name: new RegExp(`^${QUEUE_TITLE}`) }).getByRole("list", { name: queueListLabel });
    await expect(queue.getByText(SALAH.name, { exact: true })).toBeVisible();
  });
});
