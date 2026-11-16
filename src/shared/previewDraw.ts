// The preview league's draw (src/shared/preview.ts's teams): its season of Saturdays, who plays whom
// each gameweek and the manager's opponent. It sits below every feature's preview so Scouting's and
// the player card's, which own and score the men, never import the table's, whose scores add up the
// matchup's men (#2478).

import type { Id } from "../../convex/_generated/dataModel";
import { usedGameweeksOf, seasonGameweeks } from "../../convex/gameweeks/usedGameweeks";
import { gameModeOf } from "../../convex/rules/gameMode";
import { DAY_MS, seasonStartYear, WEEK_MS } from "../../convex/shared/time";
import { drawFixtures, type DrawRules, type GameweekFixtures } from "../../convex/table/roundRobin";
import { gamesOf } from "../../convex/table/teamGames";
import type { LeagueTable } from "../table/seam";
import { previewChristmasBreak, previewGameweek, previewSeasonGameweeks, previewTeamNames } from "./preview";

/** What a schedule is drawn from: the server's draw rules, the seed (the league's id on the
 *  server), the format and the gameweeks the league plays. */
export type DrawnSchedule = Partial<DrawRules> & {
  seed?: string;
  format?: LeagueTable["format"];
  /** The gameweeks the league plays: every one its season has by default (#1618). */
  gameweeks?: readonly number[];
};

/** The draw's defaults, as the server's would be for a league with no rule changed. */
const DRAW_DEFAULTS = { gamesPerGameweek: 1, seed: "preview-league", gameweeks: seasonGameweeks(previewSeasonGameweeks) } as const;

/** The head-to-head schedule `drawn` says for `teams`, made in this order: none in total points.
 *  The draw hangs on the teams' order, never on what they are, so League home's preview draws it
 *  by name and plays the table's fixtures (#1969). */
export function drawnSchedule<Team>(teams: readonly Team[], drawn: DrawnSchedule = {}): GameweekFixtures<Team>[] {
  const { gamesPerGameweek, seed, gameweeks } = { ...DRAW_DEFAULTS, ...drawn };
  return gameModeOf({ format: drawn.format ?? "headToHead" }).hasMatchups ? drawFixtures(teams, gameweeks, () => ({ gamesPerGameweek }), seed) : [];
}

/** The gameweeks begun: up to the preview's own, the last still live. */
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
};
/** The table's draw, by team name: League home plays its fixtures. */
export const previewSchedule = drawnSchedule(previewTeamNames, previewSeason);

/** The preview manager's opponent in `gameweek`, as the draw has it: null against the league's
 *  average or on a bye. */
export function previewOpponentOf(gameweek: number): string | null {
  const game = gamesOf(previewSchedule, previewTeamNames[0]).find((each) => each.gameweek === gameweek);
  return game?.against.kind === "team" ? game.against.team : null;
}
/** Whom the preview manager plays in the preview's gameweek: League home's, the matchup's and
 *  Scouting's owner of his men alike (#2450). */
export const previewOpponent = previewOpponentOf(BEGUN) ?? previewTeamNames[1];
