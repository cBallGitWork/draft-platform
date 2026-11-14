// The random clicker's steps (tests/clicker/clicker.spec.ts, #2138): from a seed, a run of clicks,
// double-clicks, typing from the fuzz list, Back, reloads and resizes on one preview screen, each
// said in a line so a failure names the steps that led to it. The same seed takes the same steps.

import { errors, type Locator, type Page } from "@playwright/test";
import { CHAOS_KEY, CHAOS_MODES } from "../../../src/shared/preview";
import { PREVIEW_KEY, type PreviewName } from "../../../src/app/preview";
import { DESK, PHONE } from "../../../scripts/viewports.mjs";
import { fuzzedTexts, pickFrom } from "../convex/fuzz.harness";
import { previewUrl } from "./previewUrl";

/** The env keys a run reads: its seed (playwright.clicker.config.ts sets one if it's missing), and
 *  how many steps each screen takes. */
export const CLICKER_SEED_KEY = "CLICKER_SEED";
export const CLICKER_STEPS_KEY = "CLICKER_STEPS";
/** How many steps each screen takes unless CLICKER_STEPS says otherwise. */
export const DEFAULT_STEPS = 40;

/** What can be pressed: a link, a button, a form control, an element playing one. A file box opens
 *  the system's file chooser, so it's left alone. */
const PRESSABLE =
  "a[href], button, input:not([type=file]):not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option]";
/** What can be typed in. */
const TYPABLE = "input:not([type]), input[type=text], input[type=search], input[type=email], input[type=number], input[type=url], input[type=tel], textarea";
/** Neither switched off nor read-only. */
const LIVE = ":not(:disabled):not([aria-disabled=true]):not([readonly])";
/** The longest text a step types. */
const LONGEST_TYPED = 40;
/** How long a press may wait for its control to take it: past that, something covers it or it
 *  moved, and the step is said as missed. */
const PRESS_MS = 1_500;
/** How long the page is given to settle after a step before it is checked. */
const SETTLE_MS = 150;
/** The marker a document the run opened carries, so one the app's own full-page load replaced
 *  (without the preview's address) is told apart. */
const OPENED_MARK = "__clickerOpened";

/** The chaos each screen's run is under, from its seed: none, or one of the switch's modes. */
const CHAOS_CHOICES = [null, ...CHAOS_MODES] as const;
export type ClickerChaos = (typeof CHAOS_CHOICES)[number];

/** A screen's run: what it opens, and what it draws from. */
export type ClickerRun = {
  page: Page;
  session: PreviewName;
  start: string;
  chaos: ClickerChaos;
  random: () => number;
  texts: readonly string[];
};

/** A run's chaos and its fuzz texts, both from its seed. */
export const chaosOf = (random: () => number): ClickerChaos => pickFrom(random, CHAOS_CHOICES);
export const textsOf = (seed: string) => fuzzedTexts(seed, LONGEST_TYPED);

/** `path` opened as the run's preview person, under its chaos, whatever preview or chaos it held. */
function addressOf({ session, chaos }: ClickerRun, path: string) {
  const url = new URL(path, "http://app.invalid");
  url.searchParams.delete(PREVIEW_KEY);
  url.searchParams.delete(CHAOS_KEY);
  if (chaos !== null) url.searchParams.set(CHAOS_KEY, chaos);
  return previewUrl(`${url.pathname}${url.search}`, session);
}

/** Opens `path` afresh, as the run's preview person, and waits for the screen's main part. */
export async function openAt(run: ClickerRun, path: string) {
  await run.page.goto(addressOf(run, path));
  await run.page.evaluate((mark) => Object.assign(window, { [mark]: true }), OPENED_MARK);
  await run.page.getByRole("main").waitFor();
}

/** The path the page is at, if it is still the app's; else the run's start. */
function hereOrStart(run: ClickerRun) {
  const url = new URL(run.page.url());
  return url.protocol.startsWith("http") ? `${url.pathname}${url.search}` : run.start;
}

/** A pick among the visible controls `selector` finds, or null when there are none. */
async function anyOf(run: ClickerRun, selector: string): Promise<Locator | null> {
  const found = run.page.locator(selector).filter({ visible: true });
  const count = await found.count();
  return count === 0 ? null : found.nth(Math.floor(run.random() * count));
}

/** How a control is named in a step's line, and whether pressing it leaves the app (another site,
 *  or a new window). */
const describe = (control: Locator) =>
  control.evaluate((element) => {
    const labels = "labels" in element && element.labels instanceof NodeList ? [...element.labels].map((label) => label.textContent) : [];
    const name = [element.getAttribute("aria-label"), ...labels, element.getAttribute("placeholder"), element.textContent]
      .map((text) => text?.trim().replace(/\s+/g, " ").slice(0, 40))
      .find((text) => text) ?? "";
    const leaves =
      element instanceof HTMLAnchorElement && (element.target === "_blank" || new URL(element.href, location.href).origin !== location.origin);
    return { said: `${element.tagName.toLowerCase()} "${name}"`, leaves };
  });

/** Runs `press`, saying it missed when its control never took it in time. */
async function pressed(said: string, press: () => Promise<unknown>) {
  try {
    await press();
    return said;
  } catch (error) {
    if (error instanceof errors.TimeoutError) return `${said}: missed, covered or gone`;
    throw error;
  }
}

async function click(run: ClickerRun, times: 1 | 2) {
  const control = await anyOf(run, `:is(${PRESSABLE})${LIVE}`);
  if (control === null) return "click: nothing to press";
  const { said, leaves } = await describe(control);
  const verb = times === 1 ? "click" : "double-click";
  if (leaves) return `${verb} ${said}: left alone, it leaves the app`;
  const options = await control.evaluate((element) => (element instanceof HTMLSelectElement ? element.options.length : null));
  if (options !== null) {
    const index = Math.floor(run.random() * options);
    return pressed(`choose option ${index} of ${said}`, () => control.selectOption({ index }, { timeout: PRESS_MS }));
  }
  return pressed(`${verb} ${said}`, () => (times === 1 ? control.click({ timeout: PRESS_MS }) : control.dblclick({ timeout: PRESS_MS })));
}

async function type(run: ClickerRun) {
  const box = await anyOf(run, `:is(${TYPABLE})${LIVE}`);
  if (box === null) return "type: nothing to type in";
  const { said } = await describe(box);
  const text = pickFrom(run.random, run.texts);
  return pressed(`type ${JSON.stringify(text)} in ${said}`, async () => {
    await box.fill("", { timeout: PRESS_MS });
    await box.pressSequentially(text, { timeout: PRESS_MS });
  });
}

async function back(run: ClickerRun) {
  await run.page.goBack();
  return "back";
}

async function reload(run: ClickerRun) {
  const path = hereOrStart(run);
  await openAt(run, path);
  return `reload ${path}`;
}

async function resize(run: ClickerRun) {
  const width = PHONE.width + Math.floor(run.random() * (DESK.width - PHONE.width + 1));
  await run.page.setViewportSize({ width, height: DESK.height });
  return `resize to ${width} wide`;
}

const singleClick = (run: ClickerRun) => click(run, 1);
const doubleClick = (run: ClickerRun) => click(run, 2);

/** The steps, each as likely as its count here: mostly presses and typing. */
const STEPS = [singleClick, singleClick, singleClick, doubleClick, type, type, back, reload, resize];

/** Takes one step from the run's seed and says it. If the app replaced the document with one that
 *  isn't the preview's (Back past the start, a full-page load), the screen is opened again there. */
export async function takeStep(run: ClickerRun): Promise<string> {
  const said = await pickFrom(run.random, STEPS)(run);
  await run.page.waitForTimeout(SETTLE_MS);
  const opened = await run.page.evaluate((mark) => mark in window, OPENED_MARK);
  if (opened) return said;
  const url = new URL(run.page.url());
  if (url.searchParams.has(PREVIEW_KEY)) {
    await run.page.evaluate((mark) => Object.assign(window, { [mark]: true }), OPENED_MARK);
    return said;
  }
  const path = hereOrStart(run);
  await openAt(run, path);
  return `${said}, then off the preview, so ${path} opened again`;
}
