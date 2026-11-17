#!/usr/bin/env node
// The QA testers' browser (Forge kit; the qa-tester agent, the /qa-panel skill).
// Every call opens a fresh page at the project's start address, plays the steps given, and prints
// what a user would see: the address, the page's text, its controls and any error the page threw;
// it saves a full-page screenshot for the tester to look at. A tester can't type an address: it
// gets where it goes by clicking, as a real user would (Krug's test scripts keep users off search
// for the same reason).
// The project's own settings are in .studio/qa-panel.json (port, startPath, width, chrome).
// Run from the project: node scripts/qa-walk.mjs <shot.png> '[{"click":"Home"}]'

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG_PATH = ".studio/qa-panel.json";
/** The width every studio picture and check uses. */
const DEFAULT_WIDTH = 1440;
const VIEW_HEIGHT = 900;
/** How long one step may wait for what it names, and how long the page settles after it. */
const STEP_TIMEOUT_MS = 5000;
const SETTLE_MS = 400;
/** What is printed, so one call never floods the tester's context. */
const TEXT_LIMIT = 6000;
const CONTROLS_LIMIT = 120;
const LABEL_LIMIT = 60;
const ERRORS_LIMIT = 20;
/** Each step names one of these and nothing else. */
const STEP_KINDS = ["click", "doubleClick", "clickRole", "fill", "key", "scroll", "back", "reload"];

/** The project's settings, or why they can't be used. */
export function readConfig(text) {
  const config = JSON.parse(text);
  if (!Number.isInteger(config.port)) throw new Error(`${CONFIG_PATH}: "port" must be a whole number`);
  if (typeof config.startPath !== "string" || !config.startPath.startsWith("/"))
    throw new Error(`${CONFIG_PATH}: "startPath" must start with /`);
  return { width: DEFAULT_WIDTH, chrome: true, ...config };
}

/** The steps, checked: each is one of STEP_KINDS, and none goes to an address. */
export function readSteps(text) {
  const steps = JSON.parse(text);
  if (!Array.isArray(steps)) throw new Error("the steps must be a JSON list");
  for (const step of steps) {
    const kinds = step && typeof step === "object" ? Object.keys(step) : [];
    if (kinds.length !== 1 || !STEP_KINDS.includes(kinds[0]))
      throw new Error(`a step is one of ${STEP_KINDS.join(", ")}; got ${JSON.stringify(step)}: a tester gets around by clicking, never by typing an address`);
  }
  return steps;
}

async function play(page, step) {
  const wait = { timeout: STEP_TIMEOUT_MS };
  if ("click" in step) return page.getByText(step.click).first().click(wait);
  if ("doubleClick" in step) return page.getByText(step.doubleClick).first().dblclick(wait);
  if ("clickRole" in step) return page.getByRole(step.clickRole[0], { name: step.clickRole[1] }).first().click(wait);
  if ("fill" in step) return page.getByLabel(step.fill[0]).first().fill(step.fill[1], wait);
  if ("key" in step) return page.keyboard.press(step.key);
  if ("scroll" in step) return page.mouse.wheel(0, step.scroll);
  if ("back" in step) return page.goBack();
  return page.reload();
}

async function walk(shot, stepsText) {
  const config = readConfig(readFileSync(CONFIG_PATH, "utf8"));
  const steps = readSteps(stepsText);
  // The project's own Playwright, so the kit adds no dependency.
  const { chromium } = createRequire(join(process.cwd(), "package.json"))("@playwright/test");
  const browser = await chromium.launch(config.chrome ? { channel: "chrome" } : {});
  const page = await browser.newPage({ viewport: { width: config.width, height: VIEW_HEIGHT } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && errors.push(`console error: ${message.text()}`));
  try {
    await page.goto(`http://localhost:${config.port}${config.startPath}`);
    for (const step of steps) {
      await play(page, step);
      await page.waitForTimeout(SETTLE_MS);
    }
  } catch (error) {
    console.log(`STEP FAILED: ${error.message.split("\n")[0]}`);
  }
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`ADDRESS: ${new URL(page.url()).pathname}`);
  console.log(`--- TEXT ---\n${(await page.innerText("body")).slice(0, TEXT_LIMIT)}`);
  const controls = await page.$$eval("button, a, [role=tab], input, select", (elements, limit) =>
    elements.map((element) => {
      const label = (element.getAttribute("aria-label") || element.innerText || element.getAttribute("placeholder") || "").trim();
      return label ? `${element.tagName.toLowerCase()}: ${label.slice(0, limit)}` : "";
    }).filter(Boolean), LABEL_LIMIT);
  console.log(`--- CONTROLS ---\n${[...new Set(controls)].slice(0, CONTROLS_LIMIT).join("\n")}`);
  console.log(`--- ERRORS ---\n${errors.length ? errors.slice(0, ERRORS_LIMIT).join("\n") : "none"}`);
  await browser.close();
}

const ranDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ranDirectly) {
  const [shot, stepsText = "[]"] = process.argv.slice(2);
  if (!shot) {
    console.error("usage: node scripts/qa-walk.mjs <shot.png> '<json steps>'");
    process.exit(1);
  }
  try {
    await walk(shot, stepsText);
  } catch (error) {
    console.error(`REFUSED: ${error.message}`);
    process.exit(1);
  }
}
