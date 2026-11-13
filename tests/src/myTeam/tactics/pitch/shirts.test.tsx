// The shirts on the pitch (spec/12: "drawn in club colours"; plate.md, Marks): each player in his
// club's colour, a keeper in its second, inked in the page's own two inks so the number and the
// edge read on the shirt and on the grass.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CLUB_COLOURS, contrast, INKS, UNSET_COLOURS } from "../../../../../convex/football/clubColours";
import { ClubColoursProvider } from "../../../../../src/shared/clubColours";
import { Shirt } from "../../../../../src/myTeam/tactics/pitch/Pitch";
import { ARSENAL } from "../../../../support/convex/footballRows.harness";
import { colorToken } from "../../../../support/src/colorTokens";
import { blockOf, openedPitch, RAYA, SALIBA, SALIBAS_CELL } from "../../../../support/src/tacticsScreen.harness";

/** WCAG 2.2 AA: a shirt's edge on the grass is a shape, 3:1. */
const SHAPE_CONTRAST = 3;

const shirtOf = (block: HTMLElement) => block.querySelector("svg")!;

describe("the shirts", () => {
  it("inks a number and an edge only in the page's ground and fact colours", () => {
    expect(INKS).toEqual({ dark: colorToken("ground"), light: colorToken("fact") });
  });

  it("gives every shirt an edge that stands out on both stripes of the grass", () => {
    for (const stripe of [colorToken("pitch"), colorToken("pitch-stripe")]) {
      for (const ink of Object.values(INKS)) expect(contrast(ink, stripe)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    }
  });

  it("dresses an outfield player in his club's colour and his keeper in its second, hidden from screen readers", async () => {
    await openedPitch();
    const outfield = shirtOf(blockOf(SALIBA, SALIBAS_CELL));
    const keeper = shirtOf(blockOf(RAYA, { area: "goalkeeper", lane: "centre" }));

    expect(outfield.querySelector("path")!.style.fill).toBe(hexToRgb(CLUB_COLOURS[ARSENAL.code].primary));
    expect(keeper.querySelector("path")!.style.fill).toBe(hexToRgb(CLUB_COLOURS[ARSENAL.code].secondary));
    expect(outfield.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws Arsenal's shirt plain, its number without an outline", () => {
    const shirt = drawnShirt(ARSENAL.code, false);
    expect(shirt.querySelectorAll("rect")).toHaveLength(0);
    expect(shirt.querySelector("text")!.getAttribute("class")).toContain("stroke-none");
  });

  it("draws Newcastle's shirt in white stripes, its number outlined in the other ink so it reads", () => {
    const shirt = drawnShirt(NEWCASTLE_CODE, false);
    const stripes = shirt.querySelector("g")!;
    expect(stripes.style.fill).toBe(hexToRgb(CLUB_COLOURS[NEWCASTLE_CODE].secondary));
    expect(stripes.querySelectorAll("rect").length).toBeGreaterThan(0);
    // Newcastle's black takes the light ink, so the outline is the dark one.
    expect(shirt.getAttribute("class")).toContain("fill-fact");
    expect(shirt.querySelector("text")!.getAttribute("class")).toContain("stroke-ground");
  });

  it("draws Newcastle's keeper plain, apart from his outfield players", () => {
    expect(drawnShirt(NEWCASTLE_CODE, true).querySelectorAll("rect")).toHaveLength(0);
  });

  it("#838 draws the colours the admin set, and a club with none held in white", () => {
    const held = [{ code: ARSENAL.code, primary: "#000000", secondary: "#FFD700", pattern: "stripes" as const }];
    const { container } = render(
      <ClubColoursProvider held={held}>
        <Shirt number={9} clubCode={ARSENAL.code} goalkeeper={false} />
        <Shirt number={9} clubCode={NEWCASTLE_CODE} goalkeeper={false} />
      </ClubColoursProvider>,
    );
    const [arsenal, newcastle] = container.querySelectorAll("svg");
    expect(arsenal.querySelector("path")!.style.fill).toBe(hexToRgb("#000000"));
    expect(arsenal.querySelector("g")!.style.fill).toBe(hexToRgb("#FFD700"));
    expect(newcastle.querySelector("path")!.style.fill).toBe(hexToRgb(UNSET_COLOURS.primary));
  });
});

const NEWCASTLE_CODE = 4;

/** One shirt alone, numbered, as the pitch draws it. */
function drawnShirt(clubCode: number, goalkeeper: boolean): SVGSVGElement {
  const { container } = render(<Shirt number={9} clubCode={clubCode} goalkeeper={goalkeeper} />);
  return container.querySelector("svg")!;
}

/** The `rgb(r, g, b)` jsdom reads a `#rrggbb` style back as. */
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
