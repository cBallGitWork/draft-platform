// WCAG 2.5.3, label in name (spec/12 S12.14), read as axe's label-content-name-mismatch reads it in
// the smoke run (tests/smoke/accessibility.spec.ts), for a unit test with no browser: the words an
// element shows, its text run together as the page's is (an SVG's <title> is never drawn), must stand
// in its name, in order and together. Like axe, it drops what is in brackets and every mark that is
// not a letter or a figure, and doesn't care about case.

/** An element's words as axe compares them. */
const wordsOf = (text: string) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\([^()]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word !== "");

/** The text an element draws, its text nodes joined with nothing between them, as axe joins them. */
function shownText(element: Element): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.parentElement?.closest("title") === null) text += node.nodeValue ?? "";
  }
  return text;
}

/** Null where the element's name holds the words it shows, in order and together; otherwise both,
 *  to say what is missing. */
export function shownNotInName(element: Element): { shown: string[]; name: string[] } | null {
  const shown = wordsOf(shownText(element));
  const name = wordsOf(element.getAttribute("aria-label") ?? "");
  const holds = shown.length === 0 || name.some((_, start) => shown.every((word, at) => name[start + at] === word));
  return holds ? null : { shown, name };
}
