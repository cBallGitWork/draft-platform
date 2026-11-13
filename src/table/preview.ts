// The table and fixtures screen in the preview (src/app/preview.ts): the Pro League's nine teams, so
// one plays the league's average each gameweek, over a season of Saturdays with a Christmas break
// unticked, up to the preview's gameweek.

import { DAY_MS, seasonStartYear, WEEK_MS } from "../../convex/shared/time";
import { usedGameweeksOf } from "../../convex/gameweeks/usedGameweeks";
import { previewChristmasBreak, previewGameweek, previewSays, previewSeasonGameweeks, previewTeamNames } from "../shared/preview";
import type { Id } from "../../convex/_generated/dataModel";
import type { TableScreenSeam } from "./seam";
import { leagueTableOf, type Drawn } from "./drawnTable";
import { swapUnsavedOutcome } from "./words";

/** The gameweeks begun, scored with made-up points: up to the preview's own, the last still live. */
const BEGUN = previewGameweek;
const firstDeadline = Date.now() - BEGUN * WEEK_MS + DAY_MS;
/** A preview team's made-up id, from its name: League home's and the matchup's previews use it. */
export const previewIdOf = (team: string) => `preview-${team}` as Id<"teams">;
/** How the preview league's season is drawn: My team's preview (src/myTeam/preview.ts) draws its
 *  fixtures alike. */
export const previewSeason = {
  season: seasonStartYear(firstDeadline),
  gameweeks: usedGameweeksOf({ unusedGameweeks: previewChristmasBreak }, previewSeasonGameweeks),
  deadlineOf: (gameweek: number) => firstDeadline + (gameweek - 1) * WEEK_MS,
} satisfies Drawn;
/** The team that never saves a lineup: it scores nothing and is on the auto team, so the table shows its chip. */
export const previewAutoTeam = "Team 5";
const scores = new Map(
  Array.from({ length: BEGUN }, (_, index) => [
    index + 1,
    new Map(previewTeamNames.map((team, teamIndex) => [team, team === previewAutoTeam ? 0 : 30 + ((index * 7 + teamIndex * 11) % 29)])),
  ]),
);
/** How the preview league is scored: My team's preview shows the same scores. */
export const previewScored = { ...previewSeason, scores, provisional: previewTeamNames } satisfies Drawn;
const table = leagueTableOf(previewTeamNames, { ...previewScored, autoTeams: [previewAutoTeam] });

const previewSwap = { swap: previewSays(swapUnsavedOutcome) };

export const previewTable: TableScreenSeam = { useLeagueTable: () => table, useFixtureSwap: () => previewSwap };
