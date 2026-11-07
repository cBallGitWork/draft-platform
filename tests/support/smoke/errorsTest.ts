// The smoke suite's test (tests/smoke/): each fails on any console error or uncaught page error it
// didn't expect, so a boot crash can't pass.

import { expect, test as base, type ConsoleMessage } from "@playwright/test";

/** The one error every page load logs: the app has no favicon, and the browser asks for one. */
const isFaviconMiss = (message: ConsoleMessage) => new URL(message.location().url || "about:blank").pathname === "/favicon.ico";

/** A test whose page records every console error but the favicon's, and every page error; any
 *  recorded fails it. */
export const test = base.extend<{ errors: string[] }>({
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
