// Every contrast pair docs/design/plate.md states (Colour roles), worked out again with contrast()
// on styles.css's tokens, so a token changed under a stated ratio fails here (#2137). The page's
// lightest point is plate.md's own reading, `#282e2d`; a see-through panel or the glow is counted
// over what it sits on. A ratio plate.md states that no pair here holds fails too.

import { describe, expect, it } from "vitest";
import plate from "../../docs/design/plate.md?raw";
import { contrast } from "../../convex/football/clubColours";
import { colorToken, seenOver } from "../support/src/colorTokens";

/** WCAG 2.1 AA's least contrast for text (1.4.3) and for a control's edge (1.4.11). */
const TEXT_CONTRAST = 4.5;
const EDGE_CONTRAST = 3;

/** The page at its lightest, the glow's brightest point with the grain counted (plate.md, ground). */
const PAGE_LIGHTEST = "#282e2d";

const token = colorToken;
const pageGlow = () => seenOver("--ground-glow", token("ground"));
const panelOver = (backdrop: string) => seenOver("--color-panel", backdrop);

/** Each pair plate.md states, as it words it, its two colours and the ratio it gives. */
const STATED: readonly [string, () => [string, string], number][] = [
  ["muted on a panel, at the page's lightest", () => [token("muted"), panelOver(PAGE_LIGHTEST)], 6.8],
  ["muted straight on the page, at its lightest", () => [token("muted"), PAGE_LIGHTEST], 5.6],
  ["muted on the glow alone", () => [token("muted"), pageGlow()], 6.4],
  ["white on the plate", () => [token("fact"), token("plate")], 12.8],
  ["role text on the plate", () => [token("soft"), token("plate")], 8.1],
  ["cyan on the plate", () => [token("derived"), token("plate")], 10.4],
  ["white on the stepper", () => [token("fact"), token("stepper")], 10.3],
  ["the action's ink", () => [token("ground"), token("fact")], 18.7],
  ["the column head's ink", () => [token("ground"), token("head")], 9.9],
  ["the unread badge", () => [token("ground"), token("event")], 8.9],
  ["the danger action's ink", () => [token("event"), token("alert")], 7.8],
  ["the danger action's ink, pressed", () => [token("event"), token("ground")], 8.9],
  ["the danger action's ink, busy", () => [token("muted"), token("alert")], 6.6],
  ["the danger action's white under the pointer", () => [token("fact"), token("alert")], 16.4],
  ["the danger action's orange edge on a confirm's solid panel", () => [token("event"), token("panel-solid")], 8.2],
  ["muted on the stepper, only a step that can't be taken", () => [token("muted"), token("stepper")], 4.2],
  ["muted on the bar, never used there", () => [token("muted"), token("bar")], 4.1],
  ["cyan on the pitch's light stripe, never used there", () => [token("derived"), token("pitch")], 3.77],
];

/** The pairs plate.md states that fall short of AA, and so may never carry text a manager reads. */
const BELOW_AA = new Set([
  "muted on the stepper, only a step that can't be taken",
  "muted on the bar, never used there",
  "cyan on the pitch's light stripe, never used there",
]);

/** A ratio rounded as plate.md writes it: to as many decimals as the stated one has. */
function asWritten(ratio: number, stated: number): number {
  const decimals = String(stated).split(".")[1]?.length ?? 0;
  return Number(ratio.toFixed(decimals));
}

/** Fixture difficulty's fills and inks, which plate.md gives as hex (not yet tokens). */
function difficultyPairs(): [string, string][] {
  return [...plate.matchAll(/\d `(#[0-9a-f]{6})` ink `(#[0-9a-f]{6})`/g)].map((found) => [found[1], found[2]]);
}

/** Every `N.N:1` plate.md's Colour roles state, once each. */
function ratiosStated(): number[] {
  const roles = plate.slice(plate.indexOf("## Colour roles"), plate.indexOf("## Type"));
  return [...new Set([...roles.matchAll(/(\d+(?:\.\d+)?):1/g)].map((found) => Number(found[1])))];
}

describe("plate.md's contrast pairs", () => {
  it.each(STATED)("%s gives the ratio plate.md states", (pair, colours, stated) => {
    const ratio = contrast(...colours());
    expect(asWritten(ratio, stated)).toBe(stated);
    if (BELOW_AA.has(pair)) expect(ratio).toBeLessThan(TEXT_CONTRAST);
    else expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it("every fixture difficulty ink on its fill gives 5.2:1 or better", () => {
    const pairs = difficultyPairs();
    expect(pairs).toHaveLength(5);
    expect(Math.min(...pairs.map(([fill, ink]) => asWritten(contrast(fill, ink), 5.2)))).toBe(5.2);
  });

  it("the focus ring's cyan stands out on the page, a panel and the plate", () => {
    for (const backdrop of [PAGE_LIGHTEST, panelOver(PAGE_LIGHTEST), token("plate"), token("bar")])
      expect(contrast(token("derived"), backdrop)).toBeGreaterThanOrEqual(EDGE_CONTRAST);
  });

  it("each ratio plate.md states is one a pair here holds", () => {
    const held = new Set([...STATED.map(([, , stated]) => stated), 5.2]);
    expect(ratiosStated().filter((ratio) => !held.has(ratio))).toEqual([]);
  });
});
