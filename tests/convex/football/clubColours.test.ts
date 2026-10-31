import { describe, expect, it } from "vitest";
import { CLUB_COLOURS, contrast, INKS, kitOf } from "../../../convex/football/clubColours";
import bootstrap from "../../support/recorded/fpl-bootstrap-static.json";

// The shirts on the pitch (spec/12, plate.md Marks): every club's colours, and inks that read.

/** WCAG 2.2 AA: a squad number is small text. */
const TEXT_CONTRAST = 4.5;

const CLUB_CODES = Object.keys(CLUB_COLOURS).map(Number);
const UNKNOWN_CODE = 999;

describe("club colours", () => {
  it("has a row for every club in FPL's recorded season, by its code, with its short name", () => {
    const rows = Object.fromEntries(Object.entries(CLUB_COLOURS).map(([code, { shortName }]) => [code, shortName]));
    expect(rows).toEqual(Object.fromEntries(bootstrap.teams.map((team) => [team.code, team.short_name])));
  });

  it.each(CLUB_CODES.flatMap((code) => [[code, false], [code, true]] as const))("club %i's number reads on its shirt (keeper: %s)", (code, goalkeeper) => {
    const kit = kitOf(code, goalkeeper);
    expect(contrast(kit.shirt, INKS[kit.ink])).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it("dresses a keeper in his club's second colour, apart from his outfield players", () => {
    for (const code of CLUB_CODES) expect(kitOf(code, true).shirt).not.toBe(kitOf(code, false).shirt);
  });

  it("draws a club with no row in the white shirt the pitch had before colours", () => {
    expect(kitOf(UNKNOWN_CODE, false)).toEqual({ shirt: "#FFFFFF", ink: "dark" });
  });
});
