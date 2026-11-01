// docs/design/plate.md names each colour by its token in src/styles.css, never its hex, so the
// value lives once. This holds every token plate.md names to one styles.css defines, so a renamed
// or removed token can't leave plate.md pointing at nothing.

import { describe, expect, it } from "vitest";
import plate from "../../docs/design/plate.md?raw";
import { colorTokenNames } from "../support/src/colorTokens";

/** Each `--color-<name>` a text mentions, once. */
function tokensNamed(text: string): string[] {
  return [...new Set([...text.matchAll(/--color-([a-z0-9-]+)/g)].map((match) => match[1]))];
}

describe("plate.md's colour tokens", () => {
  it("each exists in styles.css", () => {
    const named = tokensNamed(plate);
    expect(named.length).toBeGreaterThan(0);
    const defined = colorTokenNames();
    expect(named.filter((name) => !defined.has(name))).toEqual([]);
  });

  it("tells a token styles.css lacks apart from one it has", () => {
    const defined = colorTokenNames();
    expect(defined.has("ground")).toBe(true);
    expect(defined.has("panel")).toBe(true); // an rgb() value counts
    expect(tokensNamed("`--color-nowhere` and `--color-ground`").filter((name) => !defined.has(name))).toEqual(["nowhere"]);
  });
});
