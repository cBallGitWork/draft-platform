// The table and fixtures screen in the preview (src/preview.ts): five teams, so one plays the
// league's average each gameweek, over a season of Saturdays with a Christmas break unticked.

import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { usedGameweeksOf } from "../../convex/gameweeks/usedGameweeks";
import { previewChristmasBreak } from "../preview";
import type { TableSeam } from "./seam";
import { leagueTableOf, type Drawn } from "./drawnTable";

const firstDeadline = Date.now() - 8 * WEEK_MS + DAY_MS;
/** The preview league's teams, the preview manager's first, and how its season is drawn: My team's
 *  preview (src/myTeam/preview.ts) draws its fixtures alike. */
export const previewTeams = ["Saka Potatoes", "Team 2", "Kroos Control", "Pique Blinders", "Ctrl Alt Defeat"];
export const previewSeason = {
  gameweeks: usedGameweeksOf({ unusedGameweeks: previewChristmasBreak }),
  deadlineOf: (gameweek: number) => firstDeadline + (gameweek - 1) * WEEK_MS,
} satisfies Drawn;
/** The gameweeks begun, scored with made-up points; the last still live, and Team 2 never saving a lineup. */
const BEGUN = 8;
const scores = new Map(
  Array.from({ length: BEGUN }, (_, index) => [
    index + 1,
    new Map(previewTeams.map((team, teamIndex) => [team, team === "Team 2" ? 0 : 30 + ((index * 7 + teamIndex * 11) % 29)])),
  ]),
);
/** How the preview league is scored: My team's preview shows the same scores. */
export const previewScored = { ...previewSeason, scores, provisional: previewTeams, noLineup: ["Team 2"] } satisfies Drawn;
const table = leagueTableOf(previewTeams, previewScored);

export const previewTable: TableSeam = { useLeagueTable: () => table };
