import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { typedText } from "../../../convex/shared/typedText";
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
