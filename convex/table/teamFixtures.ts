import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { shownDeadline } from "../gameweeks/usedGameweeks";
import { seasonRules } from "../rules/rulesHistory";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { managerOf } from "../shared/leagueAccess";
import { standingsOf } from "./leagueTable";
import { LEAGUE_AVERAGE } from "./roundRobin";
import { teamFixturesFrom } from "./sentTables";
import { BYE } from "./teamGames";

// My team's Fixtures tab (#365, #436; spec/12, My team's tabs: "the team's head-to-head fixtures
// and results for the season"): the caller's team's head-to-head games, from the same schedule and
// scores the table and fixtures screen reads (leagueTable.ts's standingsOf), so a gameweek begun is
// as stored, one begun before the league existed has none (#282), and each game's score is the
// table's, provisional while live.

const against = v.union(
  v.object({ kind: v.literal("team"), teamName: v.string() }),
  v.object({ kind: v.literal(LEAGUE_AVERAGE) }),
  v.object({ kind: v.literal(BYE) }),
);

const teamGame = v.object({
  gameweek: v.number(),
  /** The league's own deadline in the gameweek (#139), as the table's fixtures show it. */
  deadline: shownDeadline,
  against,
  /** Each side's points, the average's for the league's average, once the gameweek is scored, and
   *  whether either may still move (spec/07); null before, on a bye, or in a gameweek unscored. */
  score: v.union(v.object({ team: v.number(), opponent: v.number(), provisional: v.boolean() }), v.null()),
});

export const teamFixtures = v.object({
  /** The team's own, for a link to its matchup in each gameweek (#34). */
  teamId: v.id("teams"),
  teamName: v.string(),
  format: leagueRulesShape.fields.format,
  /** Every game the team plays, in gameweek order: none in total points, with fewer than two
   *  teams, or in a gameweek begun with no head-to-head (playedFixtures.ts). */
  games: v.array(teamGame),
  /** Each gameweek the team has a game in that began but couldn't be scored, and why, as the table
   *  names them (#287). */
  unscored: v.array(v.object({ gameweek: v.number(), reason: v.string() })),
});
export type TeamFixtures = Infer<typeof teamFixtures>;

/** The caller's team's games in the league, or null for a league made before rules were held
 *  (#25), which has no format to draw them by. Refused for anyone who runs no team in it. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(teamFixtures, v.null()),
  handler: async (ctx, { leagueId }) => {
    const { league, team } = await managerOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    // As the table reads it: the format is the latest rules', the draw each gameweek's own.
    const { rules, schedule, results, unscored, named } = await standingsOf(ctx, league, season);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    return teamFixturesFrom({ team: { id: team._id, name: team.name }, format: rules.format, schedule, results, unscored, deadlineOf: deadlineIn, named });
  },
});
