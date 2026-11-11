import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { gameModeOf } from "../rules/gameMode";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { scheduleOf } from "./playedFixtures";
import { leagueScores } from "../gameweekScorer/gameweekScores";
import { leagueTableFrom, pointsOf, tableOf } from "./sentTables";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { onAutoTeam } from "../trades/tradeShut";
import { heldFixturesSeason } from "../shared/fixtures";

// The league's fixtures and table (#33; spec/09, spec/12 "table and fixtures"), for anyone with a
// part in it. Each gameweek the league has begun has its fixtures as stored once it began, none in
// one begun with no head-to-head (before the league was made, say: #282), and the rest are drawn
// from the teams, the gameweeks the league plays and the rules in force in each (playedFixtures.ts;
// #137, #266). The table counts the same fixtures the screen shows, each scored once its gameweek
// has begun (gameweekScores.ts, #29): live points count, marked provisional until final. A
// gameweek to come reads as the commissioner edited it (fixtureEdits.ts, spec/09).

export const fixture = v.object({
  /** The team's own, for a link to its matchup (#34). */
  teamId: v.id("teams"),
  /** Which of the team's games in the gameweek it is, from 1 (teamGames.ts's gameNumberAt), so
   *  the link opens this game's matchup where a team plays two a gameweek (#913). */
  game: v.number(),
  team: v.string(),
  /** The opponent's name, or null for the league's average. */
  opponent: v.union(v.string(), v.null()),
});

/** A fixture on the table's screen and league home, with its score. */
export const scoredFixture = v.object({
  ...fixture.fields,
  /** Each side's points, the average's for the league's average; null until the gameweek is scored. */
  points: v.union(v.object({ team: v.number(), opponent: v.number() }), v.null()),
});
export type ScoredFixture = Infer<typeof scoredFixture>;

/** A team's points in a gameweek scored (gameweekScores.ts's TeamGameweekTotal). */
const teamResult = v.object({
  teamId: v.id("teams"),
  teamName: v.string(),
  points: v.number(),
  provisional: v.boolean(),
});

const gameweekFixtures = v.object({
  gameweek: v.number(),
  /** The league's own deadline, under the rule in force in the gameweek (#139); the fixtures
   *  open on the first gameweek it hasn't locked. */
  deadline: shownDeadline,
  /** Each with its opponent's own id too, null for the league's average: a commissioner's fixture
   *  swap names both sides of each game (spec/09, Fixture edits). */
  fixtures: v.array(v.object({ ...scoredFixture.fields, opponentId: v.union(v.id("teams"), v.null()) })),
  /** The teams with a bye, in a league whose odd team out has one: one a game. */
  byes: v.array(v.string()),
});

const tableRow = v.object({
  teamId: v.id("teams"),
  teamName: v.string(),
  played: v.number(),
  won: v.number(),
  drawn: v.number(),
  lost: v.number(),
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  difference: v.number(),
  points: v.number(),
  /** Whether the team is on the auto team now (spec/09: the table marks it; trades/tradeShut.ts). */
  onAutoTeam: v.boolean(),
});

export const leagueTable = v.object({
  format: leagueRulesShape.fields.format,
  /** The year the season the table's matches belong to starts (shared/fixtures.ts's heldFixturesSeason):
   *  it follows FPL's season, not the clock (Craig, 6 Nov 2026, plSeasons.ts). Null while no match
   *  is held with a kickoff time. */
  season: v.union(v.number(), v.null()),
  /** Each gameweek the league plays head-to-head, with its fixtures: none in total points, with
   *  fewer than two teams, nor one begun with no head-to-head (playedFixtures.ts). */
  gameweeks: v.array(gameweekFixtures),
  table: v.array(tableRow),
  /** Every team's points in each gameweek begun and scored, in gameweek order: in either format. */
  results: v.array(v.object({ gameweek: v.number(), teams: v.array(teamResult) })),
  /** Each gameweek begun that couldn't be scored, and why: it counts for nothing in the table (#287). */
  unscored: v.array(v.object({ gameweek: v.number(), reason: v.string() })),
});
export type LeagueTable = Infer<typeof leagueTable>;

/** What a league's table and fixtures are drawn from, as `ofLeague` and league home read them:
 *  the latest rules, the teams, the head-to-head schedule (none in total points), each team's points
 *  in each gameweek begun and those that couldn't be scored (gameweekScores.ts), and the table they
 *  make. */
export async function standingsOf(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules) {
  // The format and tie-breaks are the latest rules'; the draw is each gameweek's own.
  const rules = season.latest;
  const teams = await teamsOf(ctx, league._id);
  const teamIds = teams.map((team) => team._id);
  const nameOf = new Map(teams.map((team) => [team._id, team.name]));
  const named = (teamId: Id<"teams">) => nameOf.get(teamId)!;

  const headToHead = gameModeOf(rules).hasMatchups;
  const schedule = headToHead ? await scheduleOf(ctx, league, season) : [];
  const { scores: results, unscored } = await leagueScores(ctx, league, season, teamIds);
  const scores = pointsOf(results);
  const table = tableOf(rules.format, teamIds, schedule, scores, rules.tieBreaks);
  const autoTeams = new Set(teams.filter(onAutoTeam).map((team) => team._id));
  return { rules, teamIds, schedule, results, unscored, scores, table, named, autoTeams };
}

/** The league's fixtures by gameweek and its table. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: leagueTable,
  handler: async (ctx, { leagueId }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const { rules, schedule, results, unscored, table, named, autoTeams } = await standingsOf(ctx, league, season);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    return leagueTableFrom({ format: rules.format, season: await heldFixturesSeason(ctx), schedule, results, unscored, table, deadlineOf: deadlineIn, named, autoTeams });
  },
});
