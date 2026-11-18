// The table and fixtures screen in the preview (src/app/preview.ts): the Pro League's nine teams, so
// one plays the league's average each gameweek, over a season of Saturdays with a Christmas break
// unticked, up to the preview's gameweek.

import { DAY_MS, seasonStartYear, WEEK_MS } from "../../convex/shared/time";
import { usedGameweeksOf } from "../../convex/gameweeks/usedGameweeks";
import { previewChristmasBreak, previewGameweek, previewSays, previewSeasonGameweeks, previewTeamNames } from "../shared/preview";
import type { Id } from "../../convex/_generated/dataModel";
import type { TableScreenSeam } from "./seam";
import { gamesOf } from "../../convex/table/teamGames";
import { drawnSchedule, leagueTableOf, type Drawn } from "./drawnTable";
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
/** The same draw as the table's, by team name: League home plays its fixtures. */
export const previewSchedule = drawnSchedule(previewTeamNames, previewScored);

/** The preview manager's opponent in `gameweek`, as the draw has it: null against the league's
 *  average or on a bye. */
export function previewOpponentOf(gameweek: number): string | null {
  const game = gamesOf(previewSchedule, previewTeamNames[0]).find((each) => each.gameweek === gameweek);
  return game?.against.kind === "team" ? game.against.team : null;
}
/** Whom the preview manager plays in the preview's gameweek: League home's, the matchup's and
 *  Scouting's owner of his men alike (#2450). */
export const previewOpponent = previewOpponentOf(BEGUN) ?? previewTeamNames[1];
/** A team's made-up points in a gameweek begun, as the table has them: null in one to come. */
export const previewPointsOf = (gameweek: number, team: string) => scores.get(gameweek)?.get(team) ?? null;

const previewSwap = { swap: previewSays(swapUnsavedOutcome) };

export const previewTable: TableScreenSeam = { useLeagueTable: () => previewLeagueTable, useFixtureSwap: () => previewSwap };
