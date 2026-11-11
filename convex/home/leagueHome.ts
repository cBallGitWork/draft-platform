import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { matchdayMargins } from "../admin/platformSettings";
import { begunGameweeks, tableGameweek } from "../gameweekScorer/gameweekScores";
import { leagueReads } from "../gameweekScorer/teamGameweek";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { takeAllOrThrow } from "../shared/cappedRead";
import { GAMEWEEK_MATCHES_MOST } from "../shared/fixtures";
import { groupedBy } from "../shared/groupedBy";
import { DAY_MS } from "../shared/time";
import { LIVE_WINDOW_MS } from "../stats/liveStats";
import { commentary, type MatchupCommentary } from "../matchup/matchupShape";
import { commentaryReads, readCommentary } from "../matchup/readCommentary";
import { shownLine } from "../matchup/vidiprinter";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { pinnedLetter } from "../schema";
import { tradedSide } from "../schema/squads";
import { isListedMove, LISTED_MOVES, newestFirst } from "../squads/squadPlace";
import { statusOf } from "../stats/matchStats";
import { logFailure } from "../shared/errors";
import { memberOf } from "../shared/leagueAccess";
import { scoredFixture, standingsOf } from "../table/leagueTable";
import { scoredFixtures } from "../table/sentTables";
import { formOf, RESULTS } from "../table/standings";
import { shownRows, TICKER_MOST } from "./glance";
import { matchdayAt } from "./matchday";
import { homeRecap, shownRecap } from "./recaps";

// League home (spec/12, League home; #387): the glance (this gameweek's head-to-heads, scored once
// begun, the table and each team's form), the league's latest squad moves from its events (Mail's,
// #26), the commissioner's latest letter, pinned, the latest weekly recap (recaps.ts), and matchday mode (matchday.ts): while a matchday
// is open, the Vidiprinter of its matches' lines that move one of the league's head-to-heads. Its
// lines leave with the window; each stays on its matchup (Craig, 6 Nov 2026). For anyone with a
// part in the league.
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

const playerMove = v.object({
  at: v.number(),
  kind: v.union(...LISTED_MOVES.flatMap((kind) => (kind === "tradeMade" ? [] : [v.literal(kind)]))),
  playerName: v.string(),
  teamName: v.string(),
  /** The team he left, on a move; null otherwise. */
  fromTeamName: v.union(v.string(), v.null()),
});

/** A trade that went through, as one line (#1491): the offering team and what it gave, the team it
 *  went to and what came back. */
const tradeMove = v.object({
  at: v.number(),
  kind: v.literal("tradeMade"),
  fromTeamName: v.string(),
  toTeamName: v.string(),
  gives: tradedSide,
  gets: tradedSide,
});

const squadMove = v.union(playerMove, tradeMove);

export const leagueHome = v.object({
  format: leagueRulesShape.fields.format,
  /** This gameweek's head-to-heads (nextGameweek.ts's `thisGameweekOf`), each scored once the
   *  gameweek has begun, live until final; null with none, as in total points or with fewer than
   *  two teams. */
  thisGameweek: v.union(v.null(), v.object({ gameweek: v.number(), fixtures: v.array(scoredFixture), byes: v.array(v.string()) })),
  /** While one of the gameweek's matchdays is open, its Vidiprinter: newest first, only the lines
   *  that move a head-to-head, so no full-time line; null while the home is quiet. */
  matchday: v.union(v.null(), v.object({ gameweek: v.number(), commentary })),
  /** The rows league home shows (glance.ts's `shownRows`), in the table's order. */
  table: v.array(homeRow),
  /** How many teams the whole table has. */
  teams: v.number(),
  /** The latest TICKER_MOST squad moves, newest first. */
  squadMoves: v.array(squadMove),
  pinnedLetter: v.union(v.null(), pinnedLetter),
  /** The latest weekly recap, until the next gameweek's first matchday mode begins (recaps.ts);
   *  null with none. */
  recap: v.union(v.null(), shownRecap),
});
export type LeagueHome = Infer<typeof leagueHome>;

/** The league's latest TICKER_MOST squad moves, newest first: that many of each kind read, by the
 *  index, so no other event is read. */
async function latestSquadMoves(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Infer<typeof squadMove>[]> {
  const ofEachKind = await Promise.all(
    LISTED_MOVES.map((kind) =>
      ctx.db
        .query("leagueEvents")
        .withIndex("by_leagueId_and_kind_and_at", (q) => q.eq("leagueId", leagueId).eq("event.kind", kind))
        .order("desc")
        .take(TICKER_MOST),
    ),
  );
  return ofEachKind
    .flat()
    .toSorted(newestFirst)
    .slice(0, TICKER_MOST)
    .map(({ _id, at, event }) => {
      // The index read only these kinds; any other is a bug in it.
      if (!isListedMove(event)) throw new Error(`League event ${_id} is a ${event.kind}, not a listed squad move`);
      if (event.kind === "tradeMade") {
        const { kind, fromTeamName, toTeamName, gives, gets } = event;
        return { at, kind, fromTeamName, toTeamName, gives, gets };
      }
      const fromTeamName = event.kind === "playerMoved" ? event.fromTeamName : null;
      return { at, kind: event.kind, playerName: event.playerName, teamName: event.teamName, fromTeamName };
    });
}

/** League home's first slice. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: leagueHome,
  handler: async (ctx, { leagueId, now }) => {
    const { league, team } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const { rules, teamIds, schedule, results, scores, table, named } = await standingsOf(ctx, league, season);
    const current = thisGameweekOf(schedule, deadlineOf(await leagueDeadlines(ctx, leagueId)), now);
    const form = formOf(teamIds, schedule, scores);
    const mine = team?._id ?? null;
    return {
      format: rules.format,
      thisGameweek: current
        ? {
            gameweek: current.gameweek,
            fixtures: scoredFixtures(current, results, named),
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
      matchday: await matchdayOf(ctx, league, season, teamIds, now),
      squadMoves: await latestSquadMoves(ctx, leagueId),
      pinnedLetter: league.pinnedLetter ?? null,
      recap: await homeRecap(ctx, leagueId, results, now),
    };
  },
});

/** The matchday open at `now`, with its Vidiprinter, or null while none is. Read from the matches
 *  kicking off near `now`, not this gameweek's: a gameweek's first matchday opens hours before its
 *  first kickoff, while its deadline, and so the head-to-heads shown, may still be to come. */
async function matchdayOf(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules, teamIds: readonly Id<"teams">[], now: number): Promise<LeagueHome["matchday"]> {
  const margins = await matchdayMargins(ctx);
  // Any match whose matchday may be open: up to `beforeMs` to come, or kicked off within the day
  // before its latest final whistle and `afterMs` (matchday.ts). A window joined across more days
  // than that would leave its first day's lines out, while staying open.
  const near = await takeAllOrThrow(
    ctx.db.query("fixtures").withIndex("by_kickoff", (q) => q.gt("kickoff", now - DAY_MS - LIVE_WINDOW_MS - margins.afterMs).lte("kickoff", now + margins.beforeMs)),
    NEAR_MATCHES_MOST,
    `More than ${NEAR_MATCHES_MOST} matches kick off near ${now}, so league home's matchday would be cut short`,
  );
  const inPlay = near.filter((fixture): fixture is Doc<"fixtures"> & { gameweek: number } => fixture.droppedAt === undefined && fixture.gameweek !== null);
  const byGameweek = groupedBy(inPlay, ({ gameweek }) => gameweek);
  for (const [gameweek, fixtures] of [...byGameweek].toSorted(([one], [other]) => one - other)) {
    const matches = await Promise.all(
      fixtures.map(async ({ code, kickoff }) => ({ fixtureCode: code, kickoff, fullTimeAt: (await statusOf(ctx, code))?.fullTimeAt ?? null })),
    );
    const open = matchdayAt(matches, margins, now);
    if (open !== null) return { gameweek, commentary: await vidiprinterOf(ctx, league, season, teamIds, gameweek, new Set(open.fixtureCodes), now) };
  }
  return null;
}

/** The most matches kicking off in the few days around a matchday: a gameweek's, with room. More
 *  throws, never a silent cut. */
const NEAR_MATCHES_MOST = GAMEWEEK_MATCHES_MOST;

/** The lines of the `fixtureCodes` that move a head-to-head: priced for each lineup's men whose
 *  points count. One that can't be read is logged and says why, while the scores still show. */
async function vidiprinterOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  teamIds: readonly Id<"teams">[],
  gameweek: number,
  fixtureCodes: ReadonlySet<number>,
  now: number,
): Promise<MatchupCommentary> {
  // Before the deadline no lineup is locked, so no line moves a head-to-head yet.
  if (!(await begunGameweeks(ctx, league)).includes(gameweek)) return { kind: "read", lines: [], delayed: false };
  try {
    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season), gameweek, teamIds);
    const { lines, delayed } = await readCommentary(ctx, inGameweek, teamIds, now, commentaryReads(ctx), { countingOnly: true, fixtureCodes });
    return { kind: "read", lines: lines.filter((line) => line.points !== null).map(shownLine), delayed };
  } catch (error) {
    return { kind: "unread", reason: logFailure(`League ${league._id} (${league.name}) can't read gameweek ${gameweek}'s Vidiprinter`, error) };
  }
}
