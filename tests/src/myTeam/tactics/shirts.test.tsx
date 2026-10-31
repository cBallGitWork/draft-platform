// The shirts on the pitch (spec/12: "drawn in club colours"; plate.md, Marks): each player in his
// club's colour, a keeper in its second, inked in the page's own two inks so the number and the
// edge read on the shirt and on the grass.

import { describe, expect, it } from "vitest";
import { CLUB_COLOURS, contrast, INKS } from "../../../../convex/football/clubColours";
import stylesCss from "../../../../src/styles.css?raw";
import { ARSENAL } from "../../../support/convex/footballRows.harness";
import { blockOf, openedPitch, RAYA, SALIBA } from "../../../support/src/tacticsScreen.harness";

/** WCAG 2.2 AA: a shirt's edge on the grass is a shape, 3:1. */
const SHAPE_CONTRAST = 3;

const token = (name: string) => stylesCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))![1];
const shirtOf = (block: HTMLElement) => block.querySelector("svg")!;

describe("the shirts", () => {
  it("inks a number and an edge only in the page's ground and fact colours", () => {
    expect(INKS).toEqual({ dark: token("ground"), light: token("fact") });
  });

  it("gives every shirt an edge that stands out on both stripes of the grass", () => {
    for (const stripe of [token("pitch"), token("pitch-stripe")]) {
      for (const ink of Object.values(INKS)) expect(contrast(ink, stripe)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    }
  });

  it("dresses an outfield player in his club's colour and his keeper in its second, hidden from screen readers", async () => {
    await openedPitch();
    const outfield = shirtOf(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    const keeper = shirtOf(blockOf(RAYA, { area: "goalkeeper", lane: "centre" }));

    expect(outfield.querySelector("path")!.style.fill).toBe(hexToRgb(CLUB_COLOURS[ARSENAL.code].primary));
    expect(keeper.querySelector("path")!.style.fill).toBe(hexToRgb(CLUB_COLOURS[ARSENAL.code].secondary));
    expect(outfield.getAttribute("aria-hidden")).toBe("true");
  });
});

/** The `rgb(r, g, b)` jsdom reads a `#rrggbb` style back as. */
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
