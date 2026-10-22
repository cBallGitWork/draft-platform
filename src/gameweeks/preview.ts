// The gameweeks screen in the preview (src/preview.ts): a made-up season (weeklySeason.ts).

import { previewChristmasBreak, previewSays } from "../preview";
import type { GameweeksSeam } from "./seam";
import { weeklySeason } from "./weeklySeason";

/** Saturday mornings from mid-August, so the first ten or so have begun by late October, with a
 *  Christmas break unticked. Ticking changes nothing, and says so. */
const season = weeklySeason(Date.UTC(2026, 7, 15, 10, 0), previewChristmasBreak);
export const previewGameweeks: GameweeksSeam = {
  useLeagueGameweeks: () => ({
    gameweeks: season,
    setUsed: previewSays("no gameweek was changed"),
  }),
};
