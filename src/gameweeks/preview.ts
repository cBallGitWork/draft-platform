// A made-up season for the gameweeks screen's preview (src/preview.ts): a deadline every
// Saturday morning from mid-August, so the first ten or so have begun by late October, and a
// Christmas break unticked.

import { GAMEWEEKS } from "../../convex/usedGameweeks";
import type { GameweeksSeam } from "./seam";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const FIRST_DEADLINE = Date.UTC(2026, 7, 15, 10, 0);
const CHRISTMAS = [17, 18, 19];

const season = Array.from({ length: GAMEWEEKS }, (_, index) => ({
  gameweek: index + 1,
  used: !CHRISTMAS.includes(index + 1),
  deadline: FIRST_DEADLINE + index * WEEK,
}));

/** The made-up season; ticking changes nothing, and says so. */
export const previewGameweeks: GameweeksSeam = {
  useLeagueGameweeks: () => ({
    gameweeks: season,
    setUsed: async () => "This is a preview: no gameweek was changed.",
  }),
};
