// The table and fixtures screen in the preview (src/app/preview.ts): the Pro League's nine teams, so
// one plays the league's average each gameweek, over a season of Saturdays with a Christmas break
// unticked (../shared/previewDraw.ts), up to the preview's gameweek. The manager's and his
// opponent's score each gameweek is the matchup's, its men's points their cards' (#2478); the rest
// are made up.

import { previewGameweek, previewSays, previewTeamNames } from "../shared/preview";
import { previewIdOf, previewOpponent, previewOpponentOf, previewSchedule, previewSeason } from "../shared/previewDraw";
import { previewGamePoints } from "../matchup/preview";
import type { TableScreenSeam } from "./seam";
import { leagueTableOf, type Drawn } from "./drawnTable";
import { swapUnsavedOutcome } from "./words";

export { previewIdOf, previewOpponent, previewOpponentOf, previewSchedule, previewSeason };

/** The gameweeks begun, scored: up to the preview's own, the last still live. */
const BEGUN = previewGameweek;
/** The team that never saves a lineup: it is on the auto team, so the table shows its chip, and
 *  scores nothing but in its game with the manager, which the matchup scores. */
export const previewAutoTeam = previewTeamNames[4];
/** A team's made-up points in a gameweek, but the manager's and his opponent's, the matchup's. */
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
