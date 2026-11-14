// The focus ring is on every control (docs/design/plate.md, Colour roles: focus): a 2px cyan outline,
// offset 2px, drawn once in styles.css on :focus-visible. This holds that rule as written and fails
// any stylesheet or component that takes the outline away, by CSS or by a Tailwind class (#2137).
// The Tab check, that the ring really draws in a browser, is the smoke run's (tests/smoke/accessibility.spec.ts).

import { describe, expect, it } from "vitest";
import stylesCss from "../../src/styles.css?raw";

const SOURCES = import.meta.glob<string>("../../src/**/*.{ts,tsx,css}", { query: "?raw", import: "default", eager: true });

/** CSS, inline styles and Tailwind classes that remove or hide an outline. */
const REMOVES_OUTLINE: readonly RegExp[] = [
  /outline(?:-style)?\s*:\s*["']?(?:none|0)\b/,
  /outline-width\s*:\s*["']?0\b/,
  /outline(?:Style)?\s*:\s*["'](?:none|0)["']/,
  /outlineWidth\s*:\s*["']?0\b/,
  /(?<![\w-])outline-(?:none|hidden|0)(?![\w-])/,
  /(?<![\w-])outline-transparent(?![\w-])/,
];

/** Each line in the sources that removes an outline, as `file:line: text`. */
function removals(sources: Record<string, string>): string[] {
  return Object.entries(sources).flatMap(([file, text]) =>
    text
      .split("\n")
      .flatMap((line, at) => (REMOVES_OUTLINE.some((pattern) => pattern.test(line)) ? [`${file}:${at + 1}: ${line.trim()}`] : [])),
  );
}

describe("the focus ring", () => {
  it("is plate.md's 2px cyan outline, offset 2px, on every :focus-visible", () => {
    expect(stylesCss).toMatch(/--focus-ring:\s*2px solid var\(--color-derived\);/);
    expect(stylesCss).toMatch(/--focus-ring-offset:\s*2px;/);
    expect(stylesCss).toMatch(/:focus-visible\s*\{\s*outline:\s*var\(--focus-ring\);\s*outline-offset:\s*var\(--focus-ring-offset\);/);
  });

  it("is taken away by no stylesheet or component", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
    expect(removals(SOURCES)).toEqual([]);
  });

  it("tells a removal from an outline drawn", () => {
    const found = removals({
      "a.css": "button:focus { outline: none; }\n.chip { outline: 1px solid var(--color-muted); }",
      "b.tsx": 'className="px-2 focus:outline-none"\nconst LIVE = "outline -outline-offset-1 outline-muted";',
      "c.tsx": 'style={{ outline: "none" }}\nstyle={{ outlineWidth: 0 }}',
      "d.css": "a { outline-width: 0; }\n.x { outline-style: none }",
    });
    expect(found.map((line) => line.split(":").slice(0, 2).join(":"))).toEqual(["a.css:1", "b.tsx:1", "c.tsx:1", "c.tsx:2", "d.css:1", "d.css:2"]);
  });
});
