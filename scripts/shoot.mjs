// Shoots one route of the running app at the phone's width and the desk's, into .shots/, and
// says what a picture can't: whether the page scrolls sideways, and which taps are under 44px
// at 390 (plate.md, The phone). The ui-verifier agent's camera.
//
// Usage: node scripts/shoot.mjs <route> [name]
//   node scripts/shoot.mjs / sign-in
//   node scripts/shoot.mjs "/team/squad?preview=manager" squad
// The app must be running on this folder's port (scripts/port.mjs); APP_URL overrides it.

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { folderPort } from "./port.mjs";

const PHONE = { width: 390, height: 844 };
const WIDTHS = [PHONE, { width: 1440, height: 900 }];
const SMALLEST_TAP = 44;
const SHOTS_DIR = ".shots";

const [route, name = "shot"] = process.argv.slice(2);
if (!route) {
  console.error("Usage: node scripts/shoot.mjs <route> [name]");
  process.exit(2);
}
const url = new URL(route, process.env.APP_URL ?? `http://localhost:${folderPort(process.cwd())}`).href;
mkdirSync(SHOTS_DIR, { recursive: true });

// The Mac's Chrome, so Playwright's own browser needn't be downloaded.
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const viewport of WIDTHS) {
    const page = await browser.newPage({ viewport });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const path = `${SHOTS_DIR}/${name}-${viewport.width}.png`;
    await page.screenshot({ path, fullPage: true });
    const report = await page.evaluate((smallestTap) => {
      const small = [...document.querySelectorAll("a, button, input, select, textarea")]
        .map((el) => ({ el, height: Math.round(el.getBoundingClientRect().height) }))
        .filter(({ height }) => height > 0 && height < smallestTap)
        .map(({ el, height }) => `${el.getAttribute("aria-label") ?? el.textContent?.trim()} (${height}px)`);
      return { landedOn: location.pathname, scrollsSideways: document.documentElement.scrollWidth > innerWidth, small };
    }, SMALLEST_TAP);
    console.log(
      `${path}: landed on ${report.landedOn}; ${report.scrollsSideways ? "SCROLLS SIDEWAYS" : "no sideways scroll"}` +
        (viewport === PHONE ? `; taps under ${SMALLEST_TAP}px: ${report.small.join(", ") || "none"}` : ""),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
