// What the site shows, read once for the words checks: tests/src/glossaryAvoid.test.ts (SPEC.md's
// Avoid column) and tests/src/siteVoice.test.ts (matchday-voice.md's Never table). A words file is
// everything a screen or a letter says (ARCHITECTURE.md, Where code lives): `src/**/words.ts` and
// convex's `*Words.ts`.

import ts from "typescript";
import { SOURCE_PREFIX } from "./importLines";

const RAW = import.meta.glob<string>(["../../src/**/words.ts", "../../convex/**/*Words.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Each words file's source, keyed by its repo path ("src/scoring/words.ts"). */
export const WORDS_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([path, source]) => [path.replace(SOURCE_PREFIX, ""), source]),
);

/** The text a source file shows: its string and template literals, never comments, names or imports. */
export function shownText(source: string): string {
  const shown: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      shown.push(node.text);
    }
    node.forEachChild(visit);
  };
  visit(ts.createSourceFile("words.ts", source, ts.ScriptTarget.Latest));
  return shown.join("\n");
}

/** Each word or phrase the text holds whole, any case; a hyphen joins a word ("auto-subs" isn't "subs"). */
export function avoidedIn(text: string, words: string[]): string[] {
  // RegExp.escape is in Node 24 but not yet in TypeScript's ES2023 lib.
  const escaped = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return words.filter((word) => new RegExp(`(?<![\\w-])${escaped(word)}(?![\\w-])`, "i").test(text));
}
