// The table and fixtures screen in the preview (src/app/preview.ts): the Pro League's nine teams, so
// one plays the league's average each gameweek, over a season of Saturdays with a Christmas break
// unticked, up to the preview's gameweek.

import { previewGamePoints } from "../matchup/preview";
import { previewGameweek, previewSays, previewTeamNames } from "../shared/preview";
import { previewSeason, type Drawn } from "../shared/previewDraw";
import type { TableScreenSeam } from "./seam";
import { leagueTableOf } from "./drawnTable";
import { swapUnsavedOutcome } from "./words";

/** The gameweeks begun, scored: up to the preview's own, the last still live. */
const BEGUN = previewGameweek;
/** The team that never saves a lineup: it is on the auto team, so the table shows its chip, and
 *  scores nothing but in a game with the manager, which the matchup scores. */
export const previewAutoTeam = previewTeamNames[4];
/** Each team's points in a gameweek: the manager's and his opponent's the matchup's totals (#2450,
 *  #2478), the rest made up. */
function scoresIn(gameweek: number): Map<string, number> {
  const played = new Map(previewGamePoints(gameweek).map(({ teamName, points }) => [teamName, points]));
  const madeUp = (team: string, teamIndex: number) => (team === previewAutoTeam ? 0 : 30 + (((gameweek - 1) * 7 + teamIndex * 11) % 29));
  return new Map(previewTeamNames.map((team, teamIndex) => [team, played.get(team) ?? madeUp(team, teamIndex)]));
}
const scores = new Map(Array.from({ length: BEGUN }, (_, index) => [index + 1, scoresIn(index + 1)]));
/** How the preview league is scored: My team's preview shows the same scores. */
export const previewScored = { ...previewSeason, scores, provisional: previewTeamNames } satisfies Drawn;
/** The preview league's table: League home's table card and the waiver order read it too, so every
 *  screen tells the same story (#1969). */
export const previewLeagueTable = leagueTableOf(previewTeamNames, { ...previewScored, autoTeams: [previewAutoTeam] });

const previewSwap = { swap: previewSays(swapUnsavedOutcome) };

export const previewTable: TableScreenSeam = { useLeagueTable: () => previewLeagueTable, useFixtureSwap: () => previewSwap };
