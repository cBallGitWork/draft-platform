// The table and fixtures screen in the preview (src/app/preview.ts): the Pro League's nine teams, so
// one plays the league's average each gameweek, over a season of Saturdays with a Christmas break
// unticked, up to the preview's gameweek.

import { previewGameweek, previewSays, previewTeamNames } from "../shared/preview";
import { previewSeason, type Drawn } from "../shared/previewDraw";
import type { TableScreenSeam } from "./seam";
import { leagueTableOf } from "./drawnTable";
import { swapUnsavedOutcome } from "./words";

/** The gameweeks begun, scored with made-up points: up to the preview's own, the last still live. */
const BEGUN = previewGameweek;
/** The team that never saves a lineup: it scores nothing and is on the auto team, so the table shows its chip. */
export const previewAutoTeam = previewTeamNames[4];
const scores = new Map(
  Array.from({ length: BEGUN }, (_, index) => [
    index + 1,
    new Map(previewTeamNames.map((team, teamIndex) => [team, team === previewAutoTeam ? 0 : 30 + ((index * 7 + teamIndex * 11) % 29)])),
  ]),
);
/** How the preview league is scored: My team's preview shows the same scores. */
export const previewScored = { ...previewSeason, scores, provisional: previewTeamNames } satisfies Drawn;
/** The preview league's table: League home's table card and the waiver order read it too, so every
 *  screen tells the same story (#1969). */
export const previewLeagueTable = leagueTableOf(previewTeamNames, { ...previewScored, autoTeams: [previewAutoTeam] });
/** A team's made-up points in a gameweek begun, as the table has them: null in one to come. */
export const previewPointsOf = (gameweek: number, team: string) => scores.get(gameweek)?.get(team) ?? null;

const previewSwap = { swap: previewSays(swapUnsavedOutcome) };

export const previewTable: TableScreenSeam = { useLeagueTable: () => previewLeagueTable, useFixtureSwap: () => previewSwap };
