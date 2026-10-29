import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { seasonRules } from "../rules/rulesHistory";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { pinnedLetter } from "../schema";
import { isSquadMove, SQUAD_MOVES } from "../squads/squadPlace";
import { memberOf } from "../shared/leagueAccess";
import { namedFixture } from "../table/roundRobin";
import { fixture, standingsOf } from "../table/leagueTable";
import { formOf, RESULTS } from "../table/standings";
import { shownRows, TICKER_MOST } from "./glance";

// League home (spec/12, League home; #387), its first slice: the glance (this gameweek's
// head-to-heads, the table and each team's form), the league's latest squad moves from its events
// (Mail's, #26), and the commissioner's latest letter, pinned. For anyone with a part in the league.
//
// Whether a gameweek has begun needs the time, and a query must not read the clock: Convex caches a
// query by its arguments (convex/_generated/ai/guidelines.md). So the screen passes `now`.

const homeRow = v.object({
  position: v.number(),
  teamId: v.id("teams"),
  teamName: v.string(),
  played: v.number(),
  won: v.number(),
  drawn: v.number(),
  lost: v.number(),
  points: v.number(),
  /** Its latest results, oldest first: none in total points, which has no matchups. */
  form: v.array(v.union(...RESULTS.map((result) => v.literal(result)))),
  /** Whether it is the team of the person reading. */
  mine: v.boolean(),
});

const squadMove = v.object({
  at: v.number(),
  kind: v.union(...SQUAD_MOVES.map((kind) => v.literal(kind))),
  playerName: v.string(),
  teamName: v.string(),
  /** The team he left, on a move; null otherwise. */
  fromTeamName: v.union(v.string(), v.null()),
});

export const leagueHome = v.object({
  format: leagueRulesShape.fields.format,
  /** This gameweek's head-to-heads (nextGameweek.ts's `thisGameweekOf`); null with none, as in total
   *  points or with fewer than two teams. */
  thisGameweek: v.union(v.null(), v.object({ gameweek: v.number(), fixtures: v.array(fixture), byes: v.array(v.string()) })),
  /** The rows league home shows (glance.ts's `shownRows`), in the table's order. */
  table: v.array(homeRow),
  /** How many teams the whole table has. */
  teams: v.number(),
  /** The latest TICKER_MOST squad moves, newest first. */
  squadMoves: v.array(squadMove),
  pinnedLetter: v.union(v.null(), pinnedLetter),
});
export type LeagueHome = Infer<typeof leagueHome>;

/** The league's latest TICKER_MOST squad moves, newest first: that many of each kind read, by the
 *  index, so no other event is read. */
async function latestSquadMoves(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Infer<typeof squadMove>[]> {
  const ofEachKind = await Promise.all(
    SQUAD_MOVES.map((kind) =>
      ctx.db
        .query("leagueEvents")
        .withIndex("by_leagueId_and_kind_and_at", (q) => q.eq("leagueId", leagueId).eq("event.kind", kind))
        .order("desc")
        .take(TICKER_MOST),
    ),
  );
  return ofEachKind
    .flat()
    .toSorted((one, other) => other.at - one.at)
    .slice(0, TICKER_MOST)
    .map(({ _id, at, event }) => {
      // The index read only these kinds; any other is a bug in it.
      if (!isSquadMove(event)) throw new Error(`League event ${_id} is a ${event.kind}, not a squad move`);
      const fromTeamName = event.kind === "playerMoved" ? event.fromTeamName : null;
      return { at, kind: event.kind, playerName: event.playerName, teamName: event.teamName, fromTeamName };
    });
}

/** League home's first slice, or null for a league made before rules were held (#25), which has no
 *  format to draw a table by. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.union(leagueHome, v.null()),
  handler: async (ctx, { leagueId, now }) => {
    const { league, team } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    const { rules, teamIds, schedule, scores, table, named } = await standingsOf(ctx, league, season);
    const deadlines = await leagueDeadlines(ctx, leagueId);
    const current = thisGameweekOf(schedule, (gameweek) => deadlines.get(gameweek) ?? null, now);
    const form = formOf(teamIds, schedule, scores);
    const mine = team?._id ?? null;
    return {
      format: rules.format,
      thisGameweek: current
        ? {
            gameweek: current.gameweek,
            fixtures: current.fixtures.map((each) => ({ teamId: each.team, ...namedFixture(each, named) })),
            byes: current.byes.map(named),
          }
        : null,
      table: shownRows(table.map(({ team, ...row }) => ({ teamId: team, ...row })), mine).map((row) => ({
        position: row.position,
        teamId: row.teamId,
        teamName: named(row.teamId),
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.points,
        form: form.get(row.teamId)!,
        mine: row.teamId === mine,
      })),
      teams: teamIds.length,
      squadMoves: await latestSquadMoves(ctx, leagueId),
      pinnedLetter: league.pinnedLetter ?? null,
    };
  },
});
