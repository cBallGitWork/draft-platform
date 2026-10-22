// docs/design/plate.md's Never list is copied into .claude/rules/ui.md so it loads with the screen
// files. This holds the copy equal to the original, item for item, so neither drifts alone.

import { describe, expect, it } from "vitest";
import uiRules from "../../.claude/rules/ui.md?raw";
import plate from "../../docs/design/plate.md?raw";

/** The numbered items under `## Never`: from the first `1.` line to the next blank line or heading. */
function neverList(markdown: string): string[] {
  const section = markdown.split(/^## Never$/m)[1] ?? "";
  const lines = section.split("\n");
  const start = lines.findIndex((line) => line.startsWith("1. "));
  if (start === -1) return [];
  const rest = lines.slice(start);
  const end = rest.findIndex((line) => line.trim() === "" || line.startsWith("#"));
  return end === -1 ? rest : rest.slice(0, end);
}

describe("the Never list, plate.md and its copy in .claude/rules/ui.md", () => {
  it("is the same in both", () => {
    expect(neverList(plate).length).toBeGreaterThan(0);
    expect(neverList(uiRules)).toEqual(neverList(plate));
  });

  it("tells an edited item apart, and finds no list where there is no Never section", () => {
    const edited = uiRules.replace("gradient buttons.", "gradient borders.");
    expect(edited).not.toBe(uiRules);
    expect(neverList(edited)).not.toEqual(neverList(plate));
    expect(neverList("# A doc\n\n1. not under Never\n")).toEqual([]);
  });
});
