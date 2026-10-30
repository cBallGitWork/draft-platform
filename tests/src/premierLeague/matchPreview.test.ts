import { expect, test } from "vitest";
import { bySheetOrder } from "../../../convex/match/sheetOrder";
import { previewMatch } from "../../../src/premierLeague/matchPreview";

// The preview's match lists its men in the server's order (#580): the same comparator, so the two
// can't drift.

test("the preview's men are in the match page's order, two same-position starters by name", () => {
  expect(previewMatch.men).toEqual(previewMatch.men.toSorted(bySheetOrder));
  const homeWingers = previewMatch.men.filter((man) => man.side === "home" && man.started && man.position === "W").map((man) => man.name);
  // The recording lists Philogene before Fatawu; the name breaks the tie.
  expect(homeWingers).toEqual(["Fatawu", "Philogene"]);
});
