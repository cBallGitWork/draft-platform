import { describe, expect, it } from "vitest";
import { CLUB_COLOURS, coloursFrom, contrast, INKS, isColour, kitOf, SEEDED_COLOURS, UNSET_COLOURS } from "../../../convex/football/clubColours";
import bootstrap from "../../support/recorded/fpl-bootstrap-static.json";

// The shirts on the pitch (spec/12, plate.md Marks): every club's first colours, inks that read,
// and the one read of a club's colours from what the table holds (#838).

/** WCAG 2.2 AA: a squad number is small text. */
const TEXT_CONTRAST = 4.5;

const CLUB_CODES = Object.keys(CLUB_COLOURS).map(Number);
const UNKNOWN_CODE = 999;
const NEWCASTLE_CODE = 4;
const ARSENAL_CODE = 3;

/** Every club's colours as the table holds them once seeded. */
const seeded = coloursFrom(SEEDED_COLOURS);
const kitAt = (code: number | null, goalkeeper: boolean) => kitOf(seeded(code), goalkeeper);

describe("club colours", () => {
  it("has a row for every club in FPL's recorded season, by its code, with its short name", () => {
    const rows = Object.fromEntries(Object.entries(CLUB_COLOURS).map(([code, { shortName }]) => [code, shortName]));
    expect(rows).toEqual(Object.fromEntries(bootstrap.teams.map((team) => [team.code, team.short_name])));
  });

  it.each(CLUB_CODES.flatMap((code) => [[code, false], [code, true]] as const))("club %i's number reads on its shirt (keeper: %s)", (code, goalkeeper) => {
    const kit = kitAt(code, goalkeeper);
    expect(contrast(kit.shirt, INKS[kit.ink])).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it("dresses a keeper in his club's second colour, apart from his outfield players", () => {
    for (const code of CLUB_CODES) expect(kitAt(code, true).shirt).not.toBe(kitAt(code, false).shirt);
  });

  it("starts Newcastle, Brentford, Palace, Brighton and Sunderland striped, and the rest plain (spec/12, Club colours)", () => {
    const striped = Object.values(CLUB_COLOURS).filter((club) => club.pattern === "stripes").map((club) => club.shortName);
    expect(striped.toSorted()).toEqual(["BHA", "BRE", "CRY", "NEW", "SUN"]);
  });

  it("trims a striped shirt in the club's second colour, and dresses its keeper plain", () => {
    expect(kitAt(NEWCASTLE_CODE, false)).toEqual({ shirt: "#241F20", trim: "#FFFFFF", pattern: "stripes", ink: "light" });
    expect(kitAt(NEWCASTLE_CODE, true).pattern).toBe("plain");
  });

  it("draws a club with no row in the white shirt the pitch had before colours", () => {
    expect(kitAt(UNKNOWN_CODE, false)).toEqual({ shirt: "#FFFFFF", trim: "#FFFFFF", pattern: "plain", ink: "dark" });
  });

  it("draws a player with no club held, as for one the football sync doesn't hold (#323), in the same shirt", () => {
    expect(kitAt(null, false)).toEqual(kitAt(UNKNOWN_CODE, false));
  });
});

describe("a club's colours as held (#838)", () => {
  it("reads a seeded club's colours from the file", () => {
    const { primary, secondary, pattern } = CLUB_COLOURS[ARSENAL_CODE];
    expect(seeded(ARSENAL_CODE)).toEqual({ primary, secondary, pattern });
  });

  it("reads the admin's colours where he has set them, and white for a club with none held, file or not", () => {
    const coloursOf = coloursFrom([{ code: NEWCASTLE_CODE, primary: "#000000", secondary: "#FFD700", pattern: "plain" }]);
    expect(coloursOf(NEWCASTLE_CODE)).toEqual({ primary: "#000000", secondary: "#FFD700", pattern: "plain" });
    expect(coloursOf(ARSENAL_CODE)).toEqual(UNSET_COLOURS);
    expect(coloursOf(null)).toEqual(UNSET_COLOURS);
  });

  it.each([
    ["#E50107", true],
    ["#e50107", true],
    ["E50107", false],
    ["#E5010", false],
    ["#GGGGGG", false],
    ["red", false],
  ])("takes %s as a colour: %s", (colour, taken) => {
    expect(isColour(colour)).toBe(taken);
  });
});
