// SPEC.md's Glossary has an Avoid column: the words the site never says. This reads that column and
// fails when a words file shows one of them, naming the file and the word, so the column stays the
// one home of the list. The words files and how their text is read: tests/support/wordsFiles.ts.
// Why: Craig (31 Oct 2026), "You keep saying 'a player was paid' — UK people don't say that"; docs/research/lexicon.md has the
// UK words.

import { describe, expect, it } from "vitest";
import spec from "../../SPEC.md?raw";
import { avoidedIn, shownText, WORDS_FILES } from "../support/wordsFiles";

/** The Glossary table's cells, row by row: Term, Meaning, Avoid. */
function glossaryRows(markdown: string): string[][] {
  const section = markdown.split(/^## Glossary$/m)[1]?.split(/^## /m)[0] ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Term |"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

/**
 * The Avoid column's words that are wrong in every sense. One with a bracket ("player (for a
 * person)") or one the glossary also defines as a term ("team", avoided for a club) is wrong only
 * in one sense, which a word check can't tell, so it is left to review.
 */
function avoidedWords(markdown: string): string[] {
  const rows = glossaryRows(markdown);
  const terms = new Set(rows.flatMap(([term = ""]) => term.split(",").map((word) => word.trim().toLowerCase())));
  // A bracket stays whole, so a quote in it ("classic alone ("…, …", Craig, 11 Nov 2026)") is one word.
  const avoid = rows.flatMap(([, , words = ""]) => (words.match(/(?:\([^)]*\)|[^,;(])+/g) ?? []).map((word) => word.trim()));
  return [...new Set(avoid.filter((word) => word !== "" && !word.includes("(") && !terms.has(word.toLowerCase())))];
}

describe("the Glossary's Avoid column", () => {
  const words = avoidedWords(spec);

  it("is read from SPEC.md, with the words avoided in one sense only left out", () => {
    expect(words).toContain("paid");
    expect(words).toContain("watchlist");
    expect(words).not.toContain("team");
    expect(words.some((word) => word.includes("("))).toBe(false);
  });

  it("finds no avoided word in any words file", () => {
    const someOfEach = ["src/scoring/words.ts", "convex/mail/letterWords.ts"];
    expect(Object.keys(WORDS_FILES)).toEqual(expect.arrayContaining(someOfEach));
    const found = Object.entries(WORDS_FILES).flatMap(([path, source]) =>
      avoidedIn(shownText(source), words).map((word) => `${path}: "${word}"`),
    );
    expect(found).toEqual([]);
  });

  it("catches a planted word in shown text, and leaves comments, names and longer words alone", () => {
    const planted = 'export const scoredWords = (name: string) => `${name} was paid 6 points`;';
    expect(avoidedIn(shownText(planted), words)).toEqual(["paid"]);
    for (const kind of ["'paid'", "`paid`", 'export default "paid";', "`${1} paid ${2} more`"]) {
      expect(avoidedIn(shownText(kind), words)).toEqual(["paid"]);
    }
    const clean = '// he is paid nothing here\nconst paidKey = "Auto-subs and the Watchlists page";';
    expect(avoidedIn(shownText(clean), words)).toEqual([]);
  });
});
