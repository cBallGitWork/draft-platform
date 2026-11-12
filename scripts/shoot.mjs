// Shoots one route of the running app at the desk's width, and at the phone's too with --phone,
// into the checkout's .shots/ (printing each shot's absolute path), and says what a picture can't:
// whether the page scrolls sideways, and at 390 which taps are under the tap size
// (scripts/tap-targets.mjs, the smoke run's check too). The ui-verifier agent's camera. Desk only
// by default: the phone waits until Craig asks (CLAUDE.md, Decided).
//
// Usage: node scripts/shoot.mjs <route> [name] [--phone]
//   node scripts/shoot.mjs / sign-in
//   node scripts/shoot.mjs "/team/squad?preview=manager" squad --phone
// A preview session's address is tests/support/smoke/previewUrl.ts's previewUrl, as the smoke specs build it.
// The app must be running on this checkout's port (scripts/port.mjs); APP_URL overrides it.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { appPort, localUrl } from "./port.mjs";
import { tapsUnderTapSize } from "./tap-targets.mjs";
import { CHECKOUT } from "./thisScript.mjs";
import { DESK, PHONE } from "./viewports.mjs";

const PHONE_FLAG = "--phone";
const SHOTS_DIR = join(CHECKOUT, ".shots");

const args = process.argv.slice(2);
const withPhone = args.includes(PHONE_FLAG);
const [route, name = "shot"] = args.filter((arg) => arg !== PHONE_FLAG);
const WIDTHS = withPhone ? [PHONE, DESK] : [DESK];
if (!route) {
  console.error(`Usage: node scripts/shoot.mjs <route> [name] [${PHONE_FLAG}]`);
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
    const { tapSize, small } = await page.evaluate(tapsUnderTapSize);
    const report = await page.evaluate(() => ({ landedOn: location.pathname, scrollsSideways: document.documentElement.scrollWidth > innerWidth }));
    console.log(
      `${path}: landed on ${report.landedOn}; ${report.scrollsSideways ? "SCROLLS SIDEWAYS" : "no sideways scroll"}` +
        (viewport === PHONE ? `; taps under ${tapSize}px: ${small.join(", ") || "none"}` : ""),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
