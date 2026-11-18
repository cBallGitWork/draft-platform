// The preview league's draw (src/app/preview.ts): its teams' made-up ids, its season of Saturdays
// with a Christmas break unticked, up to the preview's gameweek, and its head-to-head schedule.
// Every feature's preview reads it here, so none reaches into the table's preview for it (#2600).

import type { Id } from "../../convex/_generated/dataModel";
import type { DeadlineOf } from "../../convex/gameweeks/deadline";
import { seasonGameweeks, usedGameweeksOf } from "../../convex/gameweeks/usedGameweeks";
import { DAY_MS, seasonStartYear, WEEK_MS } from "../../convex/shared/time";
import type { LeagueTable } from "../../convex/table/leagueTable";
import { drawFixtures, type DrawRules, type GameweekFixtures } from "../../convex/table/roundRobin";
import type { GameweekScores, TieBreak } from "../../convex/table/standings";
import { gamesOf } from "../../convex/table/teamGames";
import { gameModeOf } from "../../convex/rules/gameMode";
import { previewChristmasBreak, previewGameweek, previewSeasonGameweeks, previewTeamNames } from "./preview";

export type Drawn = Partial<DrawRules> & {
  /** What the order is drawn from, as the league's id is on the server. */
  seed?: string;
  format?: LeagueTable["format"];
  /** The year the season starts, as the server reads it from the matches held: none by default. */
  season?: LeagueTable["season"];
  /** The gameweeks the league plays: every one its season has by default (#1618). */
  gameweeks?: readonly number[];
  /** The league's own deadline for each gameweek: none known by default. */
  deadlineOf?: DeadlineOf;
  scores?: GameweekScores<string>;
  /** The league's tie-breaks, in its order: a new league's by default, as the server's would be. */
  tieBreaks?: readonly TieBreak[];
  /** The teams whose scores are still provisional in the latest gameweek scored: as on the server,
   *  only the gameweek in play may still move, never one finished (#1965). */
  provisional?: readonly string[];
  unscored?: LeagueTable["unscored"];
  /** The teams on the auto team: none by default. */
  autoTeams?: readonly string[];
};

/** The draw's defaults, as the server's would be for a league with no rule changed. */
const DRAW_DEFAULTS = { gamesPerGameweek: 1, seed: "preview-league", gameweeks: seasonGameweeks(previewSeasonGameweeks) } as const;

/** The head-to-head schedule `drawn` says for `teams`, made in this order: none in total points.
 *  The draw hangs on the teams' order, never on what they are, so League home's preview draws it
 *  by name and plays the table's fixtures (#1969). */
export function drawnSchedule<Team>(teams: readonly Team[], drawn: Drawn = {}): GameweekFixtures<Team>[] {
  const { gamesPerGameweek, seed, gameweeks } = { ...DRAW_DEFAULTS, ...drawn };
  return gameModeOf({ format: drawn.format ?? "headToHead" }).hasMatchups ? drawFixtures(teams, gameweeks, () => ({ gamesPerGameweek }), seed) : [];
}

const firstDeadline = Date.now() - previewGameweek * WEEK_MS + DAY_MS;
/** A preview team's made-up id, from its name: League home's and the matchup's previews use it. */
export const previewIdOf = (team: string) => `preview-${team}` as Id<"teams">;
/** How the preview league's season is drawn: My team's preview (src/myTeam/preview.ts) draws its
 *  fixtures alike. */
export const previewSeason = {
  season: seasonStartYear(firstDeadline),
  gameweeks: usedGameweeksOf({ unusedGameweeks: previewChristmasBreak }, previewSeasonGameweeks),
  deadlineOf: (gameweek: number) => firstDeadline + (gameweek - 1) * WEEK_MS,
} satisfies Drawn;
/** The same draw as the table's, by team name: League home plays its fixtures. Scores never move
 *  the draw, so it is drawn from the season alone. */
export const previewSchedule = drawnSchedule(previewTeamNames, previewSeason);

/** The preview manager's opponent in `gameweek`, as the draw has it: null against the league's
 *  average or on a bye. */
export function previewOpponentOf(gameweek: number): string | null {
  const game = gamesOf(previewSchedule, previewTeamNames[0]).find((each) => each.gameweek === gameweek);
  return game?.against.kind === "team" ? game.against.team : null;
}
/** Whom the preview manager plays in the preview's gameweek: League home's, the matchup's and
 *  Scouting's owner of his men alike (#2450). */
export const previewOpponent = previewOpponentOf(previewGameweek) ?? previewTeamNames[1];
