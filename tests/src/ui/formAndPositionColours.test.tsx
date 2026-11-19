// Colour that means something (spec/12): a form row's chips each in their result's colour
// (src/ui/FormChips), and a player's position codes each in their own area's colour
// (src/ui/PositionCodes).

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { POSITION_NAMES } from "../../../src/shared/words";
import { FormChips } from "../../../src/ui/FormChips";
import { PositionCodes } from "../../../src/ui/PositionCodes";

const classOf = (title: string) => screen.getByTitle(title).className;
const resultChips = () => [...screen.getByRole("img").querySelectorAll("abbr")].map((chip) => chip.className);

describe("a form row", () => {
  it("S12.28: draws a win green, a draw grey and a loss red", () => {
    render(<FormChips form={["won", "drawn", "lost"]} />);

    const [won, drawn, lost] = resultChips();
    expect(won).toContain("bg-form-won");
    expect(drawn).toContain("bg-form-drawn");
    expect(lost).toContain("bg-form-lost");
    for (const result of [won, drawn, lost]) expect(result).toContain("text-ground");
  });

  it("S12.28: keeps a live last result as an outline, uncoloured, until it locks", () => {
    render(<FormChips form={["won", "lost"]} live />);

    const last = resultChips()[1];
    expect(last).toContain("outline-muted");
    expect(last).not.toContain("bg-form-lost");
  });
});

describe("a two-position player", () => {
  it("S12.30: writes each code in its own area's colour", () => {
    render(<PositionCodes positions={["CDM", "CM"]} />);

    expect(classOf(POSITION_NAMES.CDM)).toContain("bg-area-defensive-midfield");
    expect(classOf(POSITION_NAMES.CM)).toContain("text-area-midfield");
  });

  it("S12.29: sets a code whose colour can't be read as words on its chip's fill and ink", () => {
    render(<PositionCodes positions={["ST", "W"]} spaced />);

    expect(classOf(POSITION_NAMES.ST)).toContain("text-area-attack");
    expect(classOf(POSITION_NAMES.ST)).not.toContain("bg-");
    expect(classOf(POSITION_NAMES.W)).toContain("bg-area-attacking-midfield");
    expect(classOf(POSITION_NAMES.W)).toContain("text-fact");
  });
});
