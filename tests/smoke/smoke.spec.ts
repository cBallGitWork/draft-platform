// The servers, and which tag runs on which: playwright.config.ts. Each test fails on any console
// error or uncaught page error it didn't expect, so a boot crash can't pass (errorsTest.ts).

import { expect, type Page } from "@playwright/test";
import { DEFAULT_PRESETS } from "../../convex/lineup/presets";
import { ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../src/admin/paths";
import { miniBeta } from "../../src/shared/preview";
import { HOME_NEWS_PATH, MY_TEAM_PATH, SCOUTING_PATH } from "../../src/frame/menu";
import { everyTeamWords, gotWords, newsKindWords, newsTableLabel, teamFilterLabel } from "../../src/home/words";
import { invitesPath } from "../../src/joining/paths";
import { ERROR_PAGE_TITLE, mainMenuLabel } from "../../src/frame/words";
import { PITCH_ASPECT } from "../../src/myTeam/tactics/pitch/pitchMarkings";
import { markedBy } from "../../src/myTeam/tactics/focusMarks";
import { RUN_MARK } from "../../src/myTeam/tactics/pitch/runs";
import { allFormationsWords, pitchLabel, runsWords } from "../../src/myTeam/tactics/words";
import { applyWords, cancelWords, WINDOW_TITLE } from "../../src/myTeam/tactics/formationWindow/words";
import { SIGN_IN_PATH } from "../../src/signIn/paths";
import { signInWords } from "../../src/signIn/words";
import { squadsPath } from "../../src/squads/paths";
import { NO_CONVEX_URL } from "../../src/shared/words";
import { tapsUnderTapSize } from "../../scripts/tap-targets.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";
import { test } from "../support/smoke/errorsTest";

/** The phone and the desk, as scripts/shoot.mjs shoots them. */
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 900 };
/** The page's and the panel's padding either side of the phone's pitch, at most. */
const PHONE_GUTTERS = 40;
/** The preview's bench centre-back, brought on to make a row of five. */
const OFF_THE_BENCH = "Murillo";
/** A sub-pixel's give, as layout rounds. */
const GIVE = 0.5;

type Box = { x: number; y: number; width: number; height: number };
const within = (inner: Box, outer: Box) =>
  inner.x >= outer.x - GIVE &&
  inner.y >= outer.y - GIVE &&
  inner.x + inner.width <= outer.x + outer.width + GIVE &&
  inner.y + inner.height <= outer.y + outer.height + GIVE;
const apart = (one: Box, other: Box) =>
  one.x + one.width <= other.x + GIVE || other.x + other.width <= one.x + GIVE || one.y + one.height <= other.y + GIVE || other.y + other.height <= one.y + GIVE;

/** Every player on the pitch inside his own cell, none touching another, and big enough to tap on
 *  the phone. */
async function expectPlayersApart(page: Page, onPhone: boolean, shape: string) {
  const blocks = await page
    .getByRole("group", { name: pitchLabel })
    .locator("button[aria-pressed]")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = (each: Element) => {
          const { x, y, width, height } = each.getBoundingClientRect();
          return { x, y, width, height };
        };
        return { name: button.getAttribute("aria-label")!, block: box(button), cell: box(button.parentElement!) };
      }),
    );
  expect(blocks.length, `${shape}: players on the pitch`).toBeGreaterThan(0);
  // The tap size at the phone's width, read from the page by the one tap-size check.
  const { tapSize: tap } = await page.evaluate(tapsUnderTapSize);
  for (const { name, block, cell } of blocks) {
    expect(within(block, cell), `${shape}: ${name} inside his cell`).toBe(true);
    if (onPhone) expect(Math.min(block.width, block.height), `${shape}: ${name} tappable`).toBeGreaterThanOrEqual(tap);
  }
  blocks.forEach((one, index) =>
    blocks.slice(index + 1).forEach((other) => expect(apart(one.block, other.block), `${shape}: ${one.name} clear of ${other.name}`).toBe(true)),
  );
}

/** A formation picked from the formation window (the approved formation window), through its
 *  back-line groups. */
async function pickFormation(page: Page, name: string) {
  await page.getByRole("button", { name: allFormationsWords }).click();
  for (const group of await page.getByRole("button", { name: /^Back \d/ }).all()) {
    await group.click();
    const tile = page.getByRole("radio", { name, exact: true }).and(page.locator("button"));
    if ((await tile.count()) === 0) continue;
    await tile.click();
    return page.getByRole("button", { name: applyWords }).click();
  }
  throw new Error(`No formation called ${name}`);
}

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  test("?preview=manager mounts the manager's landing page", async ({ page }) => {
    await page.goto("/?preview=manager");
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: mainMenuLabel })).toBeVisible();
    await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
  });

  // main.tsx's dev-only import() of the preview, naming no session, falls through to the live app.
  test("/ with no preview mounts the live app, which says VITE_CONVEX_URL isn't set", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("alert")).toHaveText(NO_CONVEX_URL);
  });

  // League home's News tab (#1356), on the preview's made-up moves (src/home/preview.ts).
  test("the News tab shows the newest move, narrows by Team, and opens a row's detail", async ({ page }) => {
    await page.goto(`${HOME_NEWS_PATH}?preview=manager`);
    const moves = page.getByRole("table", { name: newsTableLabel });
    await expect(moves.getByRole("row").nth(1)).toContainText("Kroos Control");
    await expect(moves.getByRole("row").nth(1)).toContainText("Kudus");

    await page.getByRole("combobox", { name: teamFilterLabel }).selectOption({ label: "Lingard Franca" });
    await expect(moves.getByRole("row")).toHaveCount(3);
    await expect(moves.getByRole("row").nth(1)).toContainText("Calvert-Lewin");

    await page.getByRole("combobox", { name: teamFilterLabel }).selectOption({ label: everyTeamWords });
    await moves.getByRole("button", { name: "Haaland Oates" }).click();
    const detail = page.getByRole("region", { name: newsKindWords.playerMoved });
    await expect(detail).toContainText(gotWords("Haaland Oates"));
    await expect(detail).toContainText("Konsa");
  });

  test("?preview=visitor shows the sign-in page", async ({ page }) => {
    await page.goto("/?preview=visitor");
    await expect(page).toHaveURL((url) => url.pathname === SIGN_IN_PATH);
    await expect(page.getByRole("heading", { name: signInWords.title })).toBeVisible();
    await expect(page.getByRole("button", { name: signInWords.send })).toBeVisible();
  });

  // The Tactics pitch, laid out by a real browser (plate.md, Marks: the pitch; Craig, 31 Oct 2026).
  for (const viewport of [PHONE, DESK]) {
    test.describe(`the Tactics pitch at ${viewport.width} wide`, () => {
      test.use({ viewport });

      test("is a real pitch's shape, and its whole length fits the window", async ({ page }) => {
        await page.goto(`${MY_TEAM_PATH}?preview=manager`);
        const box = (await page.getByRole("group", { name: pitchLabel }).boundingBox())!;
        expect(box.width / box.height, "width over length").toBeCloseTo(PITCH_ASPECT, 2);
        expect(box.height, "its length, against the window's height").toBeLessThanOrEqual(viewport.height);
        if (viewport === PHONE) expect(box.width, "the phone's pitch fills the panel").toBeGreaterThan(viewport.width - PHONE_GUTTERS);
        else {
          // On the desk it stands beside the Selection table at its own width (the approved picture).
          const width = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--spacing-pitch-desk")));
          expect(box.width, "the desk's pitch width").toBeCloseTo(width, 0);
        }
      });

      test("in every preset, each player stands inside his own cell, apart from the rest", async ({ page }) => {
        await page.goto(`${MY_TEAM_PATH}?preview=manager`);
        for (const { name } of DEFAULT_PRESETS) {
          await pickFormation(page, name);
          await expectPlayersApart(page, viewport === PHONE, name);
        }
        // Five abreast, the widest a row gets: 5-3-2's back five, the bench centre-back brought on
        // into its gap by the preset itself (presets only, #1022; the bench fills the shape, #1025).
        await pickFormation(page, "5-3-2");
        await expect(page.getByRole("group", { name: pitchLabel }).getByRole("button", { name: new RegExp(`^${OFF_THE_BENCH},`) })).toHaveCount(1);
        await expectPlayersApart(page, viewport === PHONE, "5-3-2, five at the back");
      });

      // The roles' runs (spec/05 Runs; #846): every one on the desk, with a switch to hide them;
      // on a phone only the tapped player's.
      test("shows the roles' runs as the desk or the phone should", async ({ page }) => {
        await page.goto(`${MY_TEAM_PATH}?preview=manager`);
        const thePitch = page.getByRole("group", { name: pitchLabel });
        const runs = thePitch.locator(`[${RUN_MARK}]`);
        const shownRuns = async () => (await runs.evaluateAll((all) => all.filter((run) => getComputedStyle(run).display !== "none"))).length;
        await expect(runs.first(), "a starter whose role moves").toBeAttached();
        const moving = await runs.count();
        const runsSwitch = page.getByRole("checkbox", { name: runsWords });
        if (viewport === DESK) {
          expect(await shownRuns(), "every run on the desk").toBe(moving);
          await runsSwitch.click();
          expect(await shownRuns(), "none once switched off").toBe(0);
        } else {
          await expect(runsSwitch, "no switch on a phone").toBeHidden();
          expect(await shownRuns(), "none until a player is tapped").toBe(0);
          const tapped = await runs.first().getAttribute(RUN_MARK);
          // His name, as his role's chip opens his role card instead (#848).
          await thePitch.locator(markedBy("player", Number(tapped))).locator("[data-slot-label]").click();
          const shown = await runs.evaluateAll((all, mark) => all.filter((run) => getComputedStyle(run).display !== "none").map((run) => run.getAttribute(mark)), RUN_MARK);
          expect(shown, "only the tapped player's").toEqual([tapped]);
        }
      });
    });
  }

  // The tap-size check measures what a thumb taps: a control through its label, never a bare
  // well or a hidden radio (#792, #295), and by its smaller side, so a tall narrow button fails;
  // a label taps go through is no tap (#817).
  test("the tap-size check passes a labelled control by its label, and lists a bare small one, a narrow one, and one whose label lets taps through", async ({ page }) => {
    await page.setContent(`
      <style>
        :root { --spacing-tap: 44px; }
        label { display: flex; min-height: 44px; align-items: center; }
        .well { width: 22px; height: 22px; margin: 0; }
        .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
        .narrow { width: 17px; height: 44px; padding: 0; }
        .through { pointer-events: none; }
      </style>
      <label><input type="checkbox" class="well">Compare Rice</label>
      <label><input type="radio" class="hidden" name="bye">No one (a bye)</label>
      <input type="checkbox" class="well" aria-label="Bare well">
      <input type="radio" class="hidden" aria-label="Bare hidden radio">
      <button class="narrow" aria-label="Narrow sort"></button>
      <label class="through"><input type="checkbox" class="well">Label taps go through</label>
    `);
    const { small } = await page.evaluate(tapsUnderTapSize);
    expect(small).toEqual(["Bare well (22px)", "Bare hidden radio (1px)", "Narrow sort (17px)", "input (22px)"]);
  });

  // The admin's and a commissioner's pages share the other pages' width on the desk (#296).
  test.describe("on the desk", () => {
    test.use({ viewport: DESK });
    const titleWidth = async (page: Page, path: string) => {
      await page.goto(path);
      // The title's container: the plate itself, or the page's section when the title is the plate,
      // so a plate carrying tabs beside its title (Scouting's, #1028) measures the same.
      return page
        .getByRole("main")
        .getByRole("heading", { level: 1 })
        .evaluate((title) => title.parentElement!.getBoundingClientRect().width);
    };
    const SHARING_THE_WIDTH = [
      `${squadsPath(miniBeta.leagueId)}?preview=commissioner`,
      `${invitesPath(miniBeta.leagueId)}?preview=commissioner`,
      `${ADMIN_PATH}?preview=admin`,
      `${ADMIN_FEEDS_PATH}?preview=admin`,
      `${ADMIN_FEEDBACK_PATH}?preview=admin`,
    ];
    for (const path of SHARING_THE_WIDTH) {
      test(`${path} is as wide as Scouting`, async ({ page }) => {
        const scouting = await titleWidth(page, `${SCOUTING_PATH}?preview=manager`);
        expect(await titleWidth(page, path)).toBeCloseTo(scouting, 0);
      });
    }

    // The formation window, opened, is on screen whole in a 1440 by 900 window, Cancel and Use this
    // inside it, in its longest group too (the approved formation window; #1159).
    test("the formation window, on its longest group, fits the window with Cancel and Use this inside it", async ({ page }) => {
      await page.goto(`${MY_TEAM_PATH}?preview=manager`);
      await page.getByRole("button", { name: allFormationsWords }).click();
      await page.getByRole("button", { name: /^Back 4/ }).click();
      const window = page.getByRole("region", { name: WINDOW_TITLE });
      const box = (await window.boundingBox())!;
      expect(box.y, "the window's top, on screen").toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, "the window's foot, on screen").toBeLessThanOrEqual(DESK.height);
      for (const name of [cancelWords, applyWords]) {
        const button = (await window.getByRole("button", { name, exact: true }).boundingBox())!;
        expect(button.y + button.height, `${name} inside the window`).toBeLessThanOrEqual(box.y + box.height);
      }
    });
  });

  test.describe("each built screen, on the phone", () => {
    test.use({ viewport: PHONE });

    for (const [session, path, title] of BUILT_SCREENS) {
      test(`?preview=${session} at ${path} shows "${title}", doesn't scroll sideways, and has no tap under the tap size`, async ({ page }) => {
        await page.goto(`${path}${path.includes("?") ? "&" : "?"}preview=${session}`);
        await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth, "the page's width, against the window's").toBeLessThanOrEqual(innerWidth);
        const { tapSize, small } = await page.evaluate(tapsUnderTapSize);
        expect(small, `taps under ${tapSize}px`).toEqual([]);
      });
    }
  });
});

test.describe("production bundle, no VITE_CONVEX_URL", { tag: "@bundle" }, () => {
  test("/ mounts and says VITE_CONVEX_URL isn't set", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("alert")).toHaveText(NO_CONVEX_URL);
  });

  // src/app/preview.ts's import.meta.env.DEV guard: the bundle must never hand out a preview session.
  test("?preview=manager does not open the preview frame", async ({ page }) => {
    await page.goto("/?preview=manager");
    await expect(page.getByRole("alert")).toHaveText(NO_CONVEX_URL);
    await expect(page.getByRole("navigation", { name: mainMenuLabel })).toHaveCount(0);
    await expect(page.getByRole("banner")).toHaveCount(0);
  });
});
