// Shoots one route of the running app at the phone's width and the desk's, into the checkout's
// .shots/ (printing each shot's absolute path), and says what a picture can't: whether the page
// scrolls sideways, and which taps are under the tap size at 390 (`--spacing-tap`, read from the
// page; plate.md, The phone). The ui-verifier agent's camera.
//
// Usage: node scripts/shoot.mjs <route> [name]
//   node scripts/shoot.mjs / sign-in
//   node scripts/shoot.mjs "/team/squad?preview=manager" squad
// The app must be running on this checkout's port (scripts/port.mjs); APP_URL overrides it.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { appPort, localUrl } from "./port.mjs";

const PHONE = { width: 390, height: 844 };
const WIDTHS = [PHONE, { width: 1440, height: 900 }];
const SHOTS_DIR = fileURLToPath(new URL("../.shots/", import.meta.url));

const [route, name = "shot"] = process.argv.slice(2);
if (!route) {
  console.error("Usage: node scripts/shoot.mjs <route> [name]");
  process.exit(2);
}
const url = new URL(route, process.env.APP_URL ?? localUrl(appPort())).href;
mkdirSync(SHOTS_DIR, { recursive: true });

// The Mac's Chrome, so Playwright's own browser needn't be downloaded.
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const viewport of WIDTHS) {
    const page = await browser.newPage({ viewport });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const path = join(SHOTS_DIR, `${name}-${viewport.width}.png`);
    await page.screenshot({ path, fullPage: true });
    const report = await page.evaluate(() => {
      const tapToken = getComputedStyle(document.documentElement).getPropertyValue("--spacing-tap").trim();
      if (!/^\d+px$/.test(tapToken)) throw new Error(`--spacing-tap (src/styles.css) is "${tapToken}", not a size in px`);
      const tapSize = parseInt(tapToken, 10);
      const small = [...document.querySelectorAll("a, button, input, select, textarea")]
        .map((el) => ({ el, height: Math.round(el.getBoundingClientRect().height) }))
        .filter(({ height }) => height > 0 && height < tapSize)
        .map(({ el, height }) => `${el.getAttribute("aria-label") ?? el.textContent?.trim()} (${height}px)`);
      return { tapSize, landedOn: location.pathname, scrollsSideways: document.documentElement.scrollWidth > innerWidth, small };
    });
    console.log(
      `${path}: landed on ${report.landedOn}; ${report.scrollsSideways ? "SCROLLS SIDEWAYS" : "no sideways scroll"}` +
        (viewport === PHONE ? `; taps under ${report.tapSize}px: ${report.small.join(", ") || "none"}` : ""),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
