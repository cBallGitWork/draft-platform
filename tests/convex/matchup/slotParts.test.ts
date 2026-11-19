import { expect, test } from "vitest";
import type { Cell } from "../../../convex/lineup/pitch";
import { placeOf } from "../../../convex/matchup/slotParts";
import type { SlotPoints } from "../../../convex/scoring/teamPoints";

// The matchup labels a slot as the Tactics pitch does: the slot behind the striker by the role
// played there (spec/06 `S06.10`).

const BEHIND_STRIKER: Cell = { area: "attackingMidfield", lane: "centre" };
const pricedAt = (role?: string): SlotPoints => ({
  playerCode: 1,
  cell: BEHIND_STRIKER,
  ...(role === undefined ? {} : { role }),
  counts: true,
  matches: [],
  matchesCounted: [],
  points: null,
  provisional: false,
});

test.each([
  ["attackingMidfieldShadowStriker", "SS"],
  ["numberTen", "CAM"],
  ["pressingTen", "CAM"],
  [undefined, "CAM"],
])("S06.10: the matchup's slot behind the striker on %s reads %s", (role, label) => {
  expect(placeOf(pricedAt(role))).toEqual({ lane: "centre", label });
});
