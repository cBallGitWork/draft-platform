// Shoots an expanded board (scripts/design/expand.mjs) at one width, the whole page, and says what a
// picture can't: which fonts loaded, how tall the page is, whether it scrolls sideways, and every
// error the page raised. Any error fails the run, so a board that drew half of itself never passes
// as a picture. The /design skill's camera; scripts/shoot.mjs is the running app's.
//
// Usage: node scripts/design/shoot-board.mjs <page.html> <out.png> [width, default 1440]

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { DESK } from "../viewports.mjs";

const [page, out, width = String(DESK.width)] = process.argv.slice(2);
if (!page || !out || !(Number(width) > 0)) {
  console.error("Usage: node scripts/design/shoot-board.mjs <page.html> <out.png> [width]");
  process.exit(2);
}

// The Mac's Chrome, so Playwright's own browser needn't be downloaded (as scripts/shoot.mjs).
const browser = await chromium.launch({ channel: "chrome" });
try {
  const tab = await browser.newPage({ viewport: { width: Number(width), height: DESK.height } });
  const errors = [];
  tab.on("pageerror", (error) => errors.push(String(error)));
  tab.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await tab.goto(pathToFileURL(resolve(page)).href, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const report = await tab.evaluate(() => ({
    fonts: [...new Set([...document.fonts].filter((font) => font.status === "loaded").map((font) => `${font.family} ${font.weight}`))],
    height: document.documentElement.scrollHeight,
    scrollsSideways: document.documentElement.scrollWidth > innerWidth,
  }));
  await tab.screenshot({ path: resolve(out), fullPage: true });
  console.log(`${resolve(out)}: ${width} wide, ${report.height} tall; ${report.scrollsSideways ? "SCROLLS SIDEWAYS" : "no sideways scroll"}`);
  console.log(`fonts loaded: ${report.fonts.join(", ") || "none"}`);
  if (errors.length > 0) {
    console.error(`page errors:\n${errors.join("\n")}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
