// The checks every page the smoke run opens must pass (tests/smoke/builtScreens.spec.ts), which the
// random clicker (tests/clicker/) runs after each of its steps too: no error page and no sideways
// scroll. The console and outside-request checks are errorsTest.ts's.

import { expect, type Page } from "@playwright/test";
import { ERROR_PAGE_TITLE } from "../../../src/frame/words";

/** Fails if the page shows the app's error page or is wider than its window. */
export async function expectPageSound(page: Page) {
  await expect(page.getByRole("heading", { name: ERROR_PAGE_TITLE })).toHaveCount(0);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, "the page's width, against the window's").toBeLessThanOrEqual(innerWidth);
}
