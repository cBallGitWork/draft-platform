// The app loaded in a real browser, with no Convex deployment (playwright.config.ts). Each test
// fails on any console error or uncaught page error it didn't expect, so a boot crash can't pass.
// The `dev` project's tests are tagged @dev and run on Vite's dev server; @bundle runs on the
// production build.

import { expect, test as base, type ConsoleMessage } from "@playwright/test";
import { NO_CONVEX_URL } from "../src/liveApp";

/** The one error every page load logs: the app has no favicon, and the browser asks for one. */
const isFaviconMiss = (message: ConsoleMessage) => new URL(message.location().url || "about:blank").pathname === "/favicon.ico";

/** A test whose page records every console error and page error; after the test, any not
 *  matched by `allowedErrors` fails it. */
const test = base.extend<{ allowedErrors: ((message: ConsoleMessage) => boolean)[]; errors: string[] }>({
  allowedErrors: [[isFaviconMiss], { option: true }],
  errors: [
    async ({ page, allowedErrors }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !allowedErrors.some((allowed) => allowed(message))) {
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

/** React Router's own fallback when a route throws. */
const CRASHED = "Something went wrong!";

test.describe("dev server, signed out of Convex", { tag: "@dev" }, () => {
  test("?preview=manager mounts the manager's landing page", async ({ page }) => {
    await page.goto("/?preview=manager");
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByText(CRASHED)).toHaveCount(0);
  });

  test("?preview=visitor shows the sign-in page", async ({ page }) => {
    await page.goto("/?preview=visitor");
    await expect(page).toHaveURL(/\/sign-in$/);
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
