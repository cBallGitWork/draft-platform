// The table and fixtures screen in the preview (src/preview.ts): five teams, so one plays the
// league's average each gameweek, over a season of Saturdays with a Christmas break unticked.

import { DAY_MS, WEEK_MS } from "../../convex/time";
import { GAMEWEEKS } from "../../convex/usedGameweeks";
import type { TableSeam } from "./seam";
import { leagueTableOf } from "./drawnTable";

const BREAK = [17, 18, 19];
const firstDeadline = Date.now() - 8 * WEEK_MS + DAY_MS;
const table = leagueTableOf(["Saka Potatoes", "Team 2", "Kroos Control", "Pique Blinders", "Ctrl Alt Defeat"], {
  gameweeks: Array.from({ length: GAMEWEEKS }, (_, index) => index + 1).filter((gameweek) => !BREAK.includes(gameweek)),
  deadlineOf: (gameweek) => firstDeadline + (gameweek - 1) * WEEK_MS,
});

export const previewTable: TableSeam = { useLeagueTable: () => table };
