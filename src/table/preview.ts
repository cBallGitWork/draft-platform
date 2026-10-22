// The table and fixtures screen in the preview (src/preview.ts): five teams, so one plays the
// league's average each gameweek, over a season of Saturdays with a Christmas break unticked.

import { DAY_MS, WEEK_MS } from "../../convex/shared/time";
import { usedGameweeksOf } from "../../convex/gameweeks/usedGameweeks";
import { previewChristmasBreak } from "../preview";
import type { TableSeam } from "./seam";
import { leagueTableOf } from "./drawnTable";

const firstDeadline = Date.now() - 8 * WEEK_MS + DAY_MS;
const table = leagueTableOf(["Saka Potatoes", "Team 2", "Kroos Control", "Pique Blinders", "Ctrl Alt Defeat"], {
  gameweeks: usedGameweeksOf({ unusedGameweeks: previewChristmasBreak }),
  deadlineOf: (gameweek) => firstDeadline + (gameweek - 1) * WEEK_MS,
});

export const previewTable: TableSeam = { useLeagueTable: () => table };
