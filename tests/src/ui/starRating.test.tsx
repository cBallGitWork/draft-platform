// A player's stars for a role (plate.md, Marks: Stars; spec/05 Roles; #11): SVG, filled in half-star
// steps, named "Role fit 4 of 5"; "?" with we aren't sure yet, and "—" with no match.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NO_DATA, UNSURE } from "../../../convex/stars/starsShape";
import { noFigureWords } from "../../../src/shared/words";
import { noDataLabel, StarRating, starsLabel, unsureGlyph, unsureLabel } from "../../../src/ui/StarRating";

const SUBJECT = "Role fit";

describe("a star rating", () => {
  it("is drawn, not typed, filled to its half star and named by it", () => {
    render(<StarRating stars={3.5} subject={SUBJECT} />);
    const set = screen.getByRole("img", { name: starsLabel(SUBJECT, 3.5) });
    expect(set.tagName.toLowerCase()).toBe("svg");
    expect(set.textContent).not.toContain("★");
    // Three and a half of five 10-unit stars.
    expect(set.querySelector("clipPath rect")?.getAttribute("width")).toBe("35");
    expect(set.querySelectorAll("polygon")).toHaveLength(10);
  });

  it("is ? where he has too few matches to be sure, saying so on hover", () => {
    render(<StarRating stars={UNSURE} subject={SUBJECT} />);
    const mark = screen.getByRole("img", { name: unsureLabel(SUBJECT) });
    expect(mark.textContent).toBe(unsureGlyph);
    expect(mark.getAttribute("title")).toContain("we aren't sure yet");
  });

  it("is — where he has no match", () => {
    render(<StarRating stars={NO_DATA} subject={SUBJECT} />);
    expect(screen.getByRole("img", { name: noDataLabel(SUBJECT) }).textContent).toBe(noFigureWords);
  });
});
