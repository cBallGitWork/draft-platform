// The servers, and which tag runs on which: playwright.config.ts. Each test fails on any console
// error or uncaught page error it didn't expect, so a boot crash can't pass.

import { expect, test as base, type ConsoleMessage } from "@playwright/test";
import { ERROR_PAGE_TITLE } from "../../src/frame/words";
import { NO_CONVEX_URL } from "../../src/liveApp";
import { SIGN_IN_PATH } from "../../src/router";

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

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  test("?preview=manager mounts the manager's landing page", async ({ page }) => {
    await page.goto("/?preview=manager");
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
  });

  test("?preview=visitor shows the sign-in page", async ({ page }) => {
    await page.goto("/?preview=visitor");
    await expect(page).toHaveURL((url) => url.pathname === SIGN_IN_PATH);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send the link" })).toBeVisible();
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
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await expect(page.getByRole("banner")).toHaveCount(0);
  });
});
