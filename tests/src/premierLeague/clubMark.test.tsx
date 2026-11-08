// A club's mark (#840; spec/12, Club colours): its real crest from the Premier League's image
// server by the club's code, or, where the crest won't load, a small square in its two colours.

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CLUB_COLOURS } from "../../../convex/football/clubColours";
import { ClubMark, crestUrl } from "../../../src/premierLeague/ClubName";
import { styledColour } from "../../support/src/styledColour";

const ARSENAL_CODE = 3;

describe("a club's mark", () => {
  it("is the club's crest, fetched by its season-stable code, hidden from screen readers", () => {
    const { container } = render(<ClubMark code={ARSENAL_CODE} />);
    const crest = container.querySelector("img")!;
    expect(crest.getAttribute("src")).toBe(crestUrl(ARSENAL_CODE));
    expect(crestUrl(ARSENAL_CODE)).toBe("https://resources.premierleague.com/premierleague/badges/70/t3.png");
    expect(crest.getAttribute("alt")).toBe("");
    expect(crest.className).toContain("size-club-mark");
  });

  it("falls back to a square in the club's two colours, first then second, when the crest won't load", () => {
    const { container } = render(<ClubMark code={ARSENAL_CODE} />);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    const square = container.querySelector<HTMLElement>('[data-club-mark="drawn"]')!;
    expect(square.getAttribute("aria-hidden")).toBe("true");
    expect(square.className).toContain("size-club-mark");
    const halves = [...square.children].map((half) => (half as HTMLElement).style.backgroundColor);
    expect(halves).toEqual([CLUB_COLOURS[ARSENAL_CODE].primary, CLUB_COLOURS[ARSENAL_CODE].secondary].map(styledColour));
  });

  it("draws a club with no colours held in white, so every code still has a mark", () => {
    const { container } = render(<ClubMark code={999} />);
    fireEvent.error(container.querySelector("img")!);
    const halves = [...container.querySelector('[data-club-mark="drawn"]')!.children].map((half) => (half as HTMLElement).style.backgroundColor);
    expect(halves).toEqual(["#FFFFFF", "#FFFFFF"].map(styledColour));
  });
});
