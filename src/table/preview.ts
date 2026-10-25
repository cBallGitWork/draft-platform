// The table and fixtures screen in the preview (src/preview.ts): five teams, so one plays the
// league's average each gameweek, over a season of Saturdays with a Christmas break unticked.

import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { usedGameweeksOf } from "../../convex/gameweeks/usedGameweeks";
import { previewChristmasBreak } from "../preview";
import type { TableSeam } from "./seam";
import { leagueTableOf } from "./drawnTable";

const TEAMS = ["Saka Potatoes", "Team 2", "Kroos Control", "Pique Blinders", "Ctrl Alt Defeat"];
const firstDeadline = Date.now() - 8 * WEEK_MS + DAY_MS;
/** The gameweeks begun, scored with made-up points; the last still live, and Team 2 never saving a lineup. */
const BEGUN = 8;
const scores = new Map(
  Array.from({ length: BEGUN }, (_, index) => [
    index + 1,
    new Map(TEAMS.map((team, teamIndex) => [team, team === "Team 2" ? 0 : 30 + ((index * 7 + teamIndex * 11) % 29)])),
  ]),
);
const table = leagueTableOf(TEAMS, {
  gameweeks: usedGameweeksOf({ unusedGameweeks: previewChristmasBreak }),
  deadlineOf: (gameweek) => firstDeadline + (gameweek - 1) * WEEK_MS,
  scores,
  provisional: TEAMS,
  noLineup: ["Team 2"],
});

export const previewTable: TableSeam = { useLeagueTable: () => table };
