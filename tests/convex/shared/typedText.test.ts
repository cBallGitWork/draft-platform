import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { TEAM_NAME_MAX } from "../../../convex/leagues/leagueLimits";
import { typedName, typedText } from "../../../convex/shared/typedText";
import { fuzzedTexts } from "../../support/convex/fuzz.harness";
import { EMOJI } from "../../support/convex/test.harness";

// Every typed text the server keeps (a league's or team's name, a letter, feedback, an override's
// reason) is trimmed, refused when blank and refused when longer than its most, in characters.

const MOST = 3;
const REFUSALS = { blank: "Blank.", tooLong: "Too long." };

const refusalOf = (typed: string) => {
  try {
    typedText(typed, MOST, REFUSALS);
  } catch (error) {
    if (error instanceof ConvexError) return error.data as string;
    throw error;
  }
  return null;
};

test("typed text comes back trimmed", () => {
  expect(typedText("  abc \n", MOST, REFUSALS)).toBe("abc");
});

test("blank text, or only spaces, is refused as blank", () => {
  expect(refusalOf("")).toBe(REFUSALS.blank);
  expect(refusalOf(" \t\n ")).toBe(REFUSALS.blank);
});

test("text of exactly the most characters is let in, and one more is refused as too long", () => {
  expect(refusalOf("abc")).toBeNull();
  expect(refusalOf("abcd")).toBe(REFUSALS.tooLong);
});

test("the spaces trimmed off don't count towards the most", () => {
  expect(refusalOf("   abc   ")).toBeNull();
});

test("an emoji counts as one character, though it is two UTF-16 units", () => {
  expect(typedText(EMOJI.repeat(MOST), MOST, REFUSALS)).toBe(EMOJI.repeat(MOST));
  expect(refusalOf(EMOJI.repeat(MOST + 1))).toBe(REFUSALS.tooLong);
});

test("a name is kept on one line: line breaks, tabs and runs of spaces inside it become one space", () => {
  expect(typedName(" Red\n\nArmy \t FC ", 11, REFUSALS)).toBe("Red Army FC");
  expect(() => typedName(" \n ", MOST, REFUSALS)).toThrow(ConvexError);
});

// Fuzzed (#2129): random typed texts against a name's most, 30 characters (spec/13, Creating a
// league). Only that most applies: any other text is kept, and a refusal never crashes.
describe("fuzzed: only the 30-character most applies", () => {
  const texts = fuzzedTexts("typed-text", 2 * TEAM_NAME_MAX);

  /** What `keep` gives back, or the refusal it threw: anything else thrown fails the test. */
  const outcome = (keep: typeof typedText, typed: string): { kept?: string; refused?: string } => {
    try {
      return { kept: keep(typed, TEAM_NAME_MAX, REFUSALS) };
    } catch (error) {
      if (error instanceof ConvexError) return { refused: error.data as string };
      throw error;
    }
  };

  test("a text is refused as blank or too long, or else kept trimmed", () => {
    for (const typed of texts) {
      const trimmed = typed.trim();
      const filled = trimmed.length > TEAM_NAME_MAX ? { refused: REFUSALS.tooLong } : { kept: trimmed };
      expect(outcome(typedText, typed), JSON.stringify(typed)).toEqual(trimmed === "" ? { refused: REFUSALS.blank } : filled);
    }
  });

  test("a name kept is one line of at most 30 characters, with single spaces", () => {
    for (const typed of texts) {
      const { kept, refused } = outcome(typedName, typed);
      if (kept === undefined) {
        expect([REFUSALS.blank, REFUSALS.tooLong], JSON.stringify(typed)).toContain(refused);
        continue;
      }
      expect(kept, JSON.stringify(typed)).toBe(typed.replace(/\s+/g, " ").trim());
      expect(kept.length).toBeLessThanOrEqual(TEAM_NAME_MAX);
      expect(kept).not.toMatch(/\s\s|[\t\r\n]/);
    }
  });
});
