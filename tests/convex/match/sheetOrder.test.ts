import { expect, test } from "vitest";
import { bySheetOrder } from "../../../convex/match/sheetOrder";
import type { Position } from "../../../convex/positions/positionTables";

// The match page's one order (#580), which the server's match page and the preview's both sort by.

const man = (name: string, side: "home" | "away" | null, started: boolean, position: Position | null) => ({ name, side, started, position });

test("home, then away, then any who left both; starters first; by position, none last; then by name", () => {
  const order = [
    man("Raya", "home", true, "GK"),
    man("Gabriel", "home", true, "CB"),
    man("Saliba", "home", true, "CB"),
    man("Havertz", "home", true, "ST"),
    man("Nwaneri", "home", true, null),
    man("Kepa", "home", false, "GK"),
    man("Pickford", "away", true, "GK"),
    man("Beto", "away", false, "ST"),
    man("Calvert-Lewin", null, true, "ST"),
  ];
  expect(order.toReversed().toSorted(bySheetOrder)).toEqual(order);
});
