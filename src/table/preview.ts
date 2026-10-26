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
const table = leagueTableOf(previewTeams, previewSeason);

export const previewTable: TableSeam = { useLeagueTable: () => table };
