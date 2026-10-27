// The servers, and which tag runs on which: playwright.config.ts. Each test fails on any console
// error or uncaught page error it didn't expect, so a boot crash can't pass.

import { expect, test as base, type ConsoleMessage } from "@playwright/test";
import { joinPath } from "../../convex/joining/joiningShared";
import { ADMIN_PATH } from "../../src/admin/paths";
import { ADMIN_TITLE } from "../../src/admin/words";
import { MAIL_PATH, TABLE_PATH } from "../../src/frame/menu";
import { ERROR_PAGE_TITLE, mainMenuLabel } from "../../src/frame/words";
import { gameweeksPath } from "../../src/gameweeks/paths";
import { GAMEWEEKS_TITLE } from "../../src/gameweeks/words";
import { invitesPath } from "../../src/joining/paths";
import { INVITES_TITLE, joinPageWords } from "../../src/joining/words";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../src/leagues/paths";
import { LEAGUES_TITLE, NEW_LEAGUE_TITLE } from "../../src/leagues/words";
import { MAIL_TITLE } from "../../src/mail/words";
import { miniBeta } from "../../src/preview";
import { SIGN_IN_PATH } from "../../src/sign-in/paths";
import { signInWords } from "../../src/sign-in/words";
import { squadsPath } from "../../src/squads/paths";
import { SQUADS_TITLE } from "../../src/squads/words";
import { TABLE_PAGE_TITLE } from "../../src/table/words";
import { NO_CONVEX_URL } from "../../src/words";

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

/** The phone, as scripts/shoot.mjs shoots it. */
const PHONE = { width: 390, height: 844 };

/** Built screens past the landing page: the preview session that reaches each (src/preview.ts),
 *  its address, and its page's title. The invite link's tokens are joining/preview.ts's: one to
 *  ask with, one asked, one switched off. */
const BUILT_SCREENS: readonly (readonly [session: string, path: string, title: string])[] = [
  ["manager", TABLE_PATH, TABLE_PAGE_TITLE],
  ["manager", MAIL_PATH, MAIL_TITLE],
  ["manager", LEAGUES_PATH, LEAGUES_TITLE],
  ["commissioner", gameweeksPath(miniBeta.leagueId), GAMEWEEKS_TITLE],
  ["commissioner", squadsPath(miniBeta.leagueId), SQUADS_TITLE],
  ["commissioner", invitesPath(miniBeta.leagueId), INVITES_TITLE],
  // The admin's alone: a commissioner is sent back to Your leagues.
  ["admin", NEW_LEAGUE_PATH, NEW_LEAGUE_TITLE],
  ["newcomer", joinPath("preview"), miniBeta.name],
  ["newcomer", joinPath("waiting"), miniBeta.name],
  ["newcomer", joinPath("gone"), joinPageWords.title],
  ["admin", ADMIN_PATH, ADMIN_TITLE],
];

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

  test.describe("each built screen, on the phone", () => {
    test.use({ viewport: PHONE });

    for (const [session, path, title] of BUILT_SCREENS) {
      test(`?preview=${session} at ${path} shows "${title}" and doesn't scroll sideways`, async ({ page }) => {
        await page.goto(`${path}?preview=${session}`);
        await expect(page.getByRole("main").getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth, "the page's width, against the window's").toBeLessThanOrEqual(innerWidth);
      });
    }
  });
});

test.describe("production bundle, no VITE_CONVEX_URL", { tag: "@bundle" }, () => {
  test("/ mounts and says VITE_CONVEX_URL isn't set", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("alert")).toHaveText(NO_CONVEX_URL);
  });

  // src/preview.ts's import.meta.env.DEV guard: the bundle must never hand out a preview session.
  test("?preview=manager does not open the preview frame", async ({ page }) => {
    await page.goto("/?preview=manager");
    await expect(page.getByRole("alert")).toHaveText(NO_CONVEX_URL);
    await expect(page.getByRole("navigation", { name: mainMenuLabel })).toHaveCount(0);
    await expect(page.getByRole("banner")).toHaveCount(0);
  });
});
