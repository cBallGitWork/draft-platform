// The servers, and which tag runs on which: playwright.config.ts. Each test fails on any console
// error or uncaught page error it didn't expect, so a boot crash can't pass.

import { expect, test as base, type ConsoleMessage, type Page } from "@playwright/test";
import { LANES } from "../../convex/lineup/pitch";
import { DEFAULT_PRESETS } from "../../convex/lineup/presets";
import { ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../src/admin/paths";
import { miniBeta } from "../../src/app/preview";
import { MY_TEAM_PATH, SCOUTING_PATH } from "../../src/frame/menu";
import { invitesPath } from "../../src/joining/paths";
import { ERROR_PAGE_TITLE, mainMenuLabel } from "../../src/frame/words";
import { PITCH_ASPECT } from "../../src/myTeam/tactics/pitchMarkings";
import { moveLabel, pitchLabel, presetLabel, putHereLabel } from "../../src/myTeam/tactics/words";
import { SIGN_IN_PATH } from "../../src/signIn/paths";
import { signInWords } from "../../src/signIn/words";
import { squadsPath } from "../../src/squads/paths";
import { NO_CONVEX_URL } from "../../src/shared/words";
import { tapsUnderTapSize } from "../../scripts/tap-targets.mjs";
import { BUILT_SCREENS } from "../support/smoke/builtScreens";

/** The one error every page load logs: the app has no favicon, and the browser asks for one. */
const isFaviconMiss = (message: ConsoleMessage) => new URL(message.location().url || "about:blank").pathname === "/favicon.ico";

/** A test whose page records every console error but the favicon's, and every page error; any
 *  recorded fails it. */
const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !isFaviconMiss(message)) {
          errors.push(`console: ${message.text()} (${message.location().url})`);
        }
      });
      page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
      await use(errors);
      expect(errors, "console or page errors").toEqual([]);
    },
    { auto: true },
  ],
});

/** The phone and the desk, as scripts/shoot.mjs shoots them. */
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 900 };
/** The page's and the panel's padding either side of the phone's pitch, at most. */
const PHONE_GUTTERS = 40;
/** The preview's bench centre-back, brought on to make a row of five. */
const OFF_THE_BENCH = "Murillo";
/** The one screen whose taps are still narrower than the tap size, and the issue that widens them:
 *  the Tactics squad table's name links and Move buttons, left while other builders worked in
 *  src/myTeam/tactics/ (#817). Its phone test fails once they're fixed, so this comes out then. */
const TAPS_STILL_NARROW = { path: MY_TEAM_PATH, issue: "#865" };
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
          // On the desk it is the centrepiece: the window's height, but for the room it leaves.
          const clearance = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--spacing-pitch-clearance")));
          expect(box.height, "the desk's pitch is the window's height").toBeCloseTo(viewport.height - clearance, 0);
        }
      });

      test("in every preset, each player stands inside his own cell, apart from the rest", async ({ page }) => {
        await page.goto(`${MY_TEAM_PATH}?preview=manager`);
        for (const { name } of DEFAULT_PRESETS) {
          await page.getByRole("combobox", { name: presetLabel }).selectOption(name);
          await expectPlayersApart(page, viewport === PHONE, name);
        }
        // Five abreast, the widest a row gets: 5-3-2's back five, the bench centre-back in its gap.
        await page.getByRole("combobox", { name: presetLabel }).selectOption("5-3-2");
        await page.getByRole("button", { name: moveLabel(OFF_THE_BENCH), exact: true }).click();
        const gaps = LANES.map((lane) => page.getByRole("button", { name: putHereLabel(OFF_THE_BENCH, "defence", lane) }));
        for (const gap of gaps) if ((await gap.count()) > 0) await gap.click();
        await expect(page.getByRole("group", { name: pitchLabel }).getByRole("button", { name: new RegExp(`^${OFF_THE_BENCH},`) })).toHaveCount(1);
        await expectPlayersApart(page, viewport === PHONE, "5-3-2, five at the back");
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
      return (await page.getByRole("main").getByRole("heading", { level: 1 }).boundingBox())!.width;
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
  });

  test.describe("each built screen, on the phone", () => {
    test.use({ viewport: PHONE });

    for (const [session, path, title] of BUILT_SCREENS) {
      test(`?preview=${session} at ${path} shows "${title}", doesn't scroll sideways, and has no tap under the tap size`, async ({ page }) => {
        await page.goto(`${path}?preview=${session}`);
        await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth, "the page's width, against the window's").toBeLessThanOrEqual(innerWidth);
        const { tapSize, small } = await page.evaluate(tapsUnderTapSize);
        if (path === TAPS_STILL_NARROW.path) {
          expect(small, `${TAPS_STILL_NARROW.issue} fixed? Take TAPS_STILL_NARROW out`).not.toEqual([]);
        } else expect(small, `taps under ${tapSize}px`).toEqual([]);
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
