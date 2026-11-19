// The site writer's Never table (.claude/agents/matchday-voice.md): words that make the site read like
// an AI, a game menu or a form letter. This reads the table and fails when a words file shows one,
// naming the file and the word, so the table stays the one home of the list; it also fails on the
// marks no football site writes. Why: Craig (18 Nov 2026), "our tone and language is consistent,
// and not weird ai claude".

import { describe, expect, it } from "vitest";
import writer from "../../.claude/agents/matchday-voice.md?raw";
import { avoidedIn, shownText, WORDS_FILES } from "../support/wordsFiles";

/** The Never table's first column, row by row. */
function neverWords(markdown: string): string[] {
  const section = markdown.split(/^## Never$/m)[1]?.split(/^## /m)[0] ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Word |"))
    .map((line) => line.split("|")[1].trim())
    .filter((word) => word !== "");
}

/** Marks and spellings a UK football site never shows. A lone "—" is the empty-figure mark, never a
 *  dash in a sentence, so only one beside words counts; each line of shown text is one literal. */
const MARKS: { name: string; pattern: RegExp }[] = [
  { name: "an em dash", pattern: /^(?=.*\p{L}).*—/mu },
  { name: "an exclamation mark", pattern: /!/ },
  { name: "a US spelling", pattern: /\b(colors?|centers?|favorites?|organiz\w*|canceled)\b/i },
];

function marksIn(text: string): string[] {
  return MARKS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

describe("the site writer's Never table", () => {
  const words = neverWords(writer);

  it("is read from matchday-voice.md", () => {
    expect(words).toContain("successfully");
    expect(words).toContain("in order to");
    expect(words.every((word) => !word.includes("|"))).toBe(true);
  });

  it("finds no Never word and no wrong mark in any words file", () => {
    expect(Object.keys(WORDS_FILES)).toEqual(expect.arrayContaining(["src/scoring/words.ts", "convex/mail/letterWords.ts"]));
    const found = Object.entries(WORDS_FILES).flatMap(([path, source]) => {
      const text = shownText(source);
      return [...avoidedIn(text, words), ...marksIn(text)].map((what) => `${path}: "${what}"`);
    });
    expect(found).toEqual([]);
  });

  it("catches a planted word or mark in shown text, and leaves comments and code alone", () => {
    expect(avoidedIn(shownText('export const saved = "Saved successfully";'), words)).toEqual(["successfully"]);
    expect(marksIn(shownText("export const done = `Done — ${1} left!`;"))).toEqual(["an em dash", "an exclamation mark"]);
    expect(marksIn(shownText('export const kit = "Club colors";'))).toEqual(["a US spelling"]);
    const clean = '// saved successfully — color!\nexport const x = (more: boolean) => (!more ? "Saved." : "Colours saved.");\nexport const none = "—";';
    expect(avoidedIn(shownText(clean), words)).toEqual([]);
    expect(marksIn(shownText(clean))).toEqual([]);
  });
});
