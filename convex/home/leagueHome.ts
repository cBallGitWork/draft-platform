import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { hasBegun, tableGameweek } from "../gameweekScorer/gameweekScores";
import { leagueReads } from "../gameweekScorer/teamGameweek";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { commentary, heldCommentary, type HeldCommentary } from "../matchup/matchupShape";
import { commentaryReads, readCommentary } from "../matchup/readCommentary";
import { shownLine } from "../matchup/vidiprinter";
import { gameModeOf } from "../rules/gameMode";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { pinnedLetter, tradedSide } from "../schema";
import { isListedMove, LISTED_MOVES, newestFirst, playerMoveKind } from "../squads/squadPlace";
import { leagueLabel, logFailure } from "../shared/errors";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { scoredFixture, standingsOf } from "../table/leagueTable";
import { scoredFixtures } from "../table/sentTables";
import { formOf, RESULTS } from "../table/standings";
import { shownRows, TICKER_MOST } from "./glance";
import { heldRecap, homeRecap, shownRecap } from "./recaps";

// League home (spec/12, League home; #387): the glance (this gameweek's head-to-heads, scored once
// begun, the table and each team's form), the league's latest squad moves from its events (Mail's,
// #26), the commissioner's latest letter, pinned, the latest weekly recap (recaps.ts), and matchday mode (homeClock.ts): while a matchday
// is open, the Vidiprinter of its matches' lines that move one of the league's head-to-heads. Its
// lines leave with the window; each stays on its matchup (Craig, 6 Nov 2026). For anyone with a
// part in the league.
//
// Which gameweek this is, and whether a matchday is open, needs the time, and a query must not read
// the clock: Convex caches a query by its arguments (convex/_generated/ai/guidelines.md). So the
// screen passes `now` to one small query, homeClock.ts's `clockOf`, and these take what it says,
// with no minute, so they are read again only when their data changes (#1550; homeAt.ts).

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
  kind: playerMoveKind,
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

/** League home as `ofLeague` sends it: no matchday, which `matchdayOf` reads, and the recap with the
 *  moment it leaves (homeAt.ts puts them together at the screen's minute). */
export const heldLeagueHome = leagueHome.omit("matchday", "recap").extend({ recap: v.union(v.null(), heldRecap) });
export type HeldLeagueHome = Infer<typeof heldLeagueHome>;

/** League home's first slice, its head-to-heads `gameweek`'s: homeClock.ts's `clockOf` says which. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), gameweek: v.union(v.number(), v.null()) },
  returns: heldLeagueHome,
  handler: async (ctx, { leagueId, gameweek }) => {
    const { league, team } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const { rules, teamIds, schedule, results, scores, table, named } = await standingsOf(ctx, league, season);
    const current = gameweek === null ? undefined : schedule.find((each) => each.gameweek === gameweek);
    const form = formOf(gameModeOf(rules), teamIds, schedule, scores);
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
      squadMoves: await latestSquadMoves(ctx, leagueId),
      pinnedLetter: league.pinnedLetter ?? null,
      recap: await homeRecap(ctx, leagueId, results),
    };
  },
});

/** The Vidiprinter of the matchday open in `gameweek`, of its matches `fixtureCodes`: homeClock.ts's
 *  `clockOf` says which. Its delay is a moment (commentaryAt.ts). */
export const matchdayOf = query({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), fixtureCodes: v.array(v.number()) },
  returns: heldCommentary,
  handler: async (ctx, { leagueId, gameweek, fixtureCodes }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
    return vidiprinterOf(ctx, league, season, teamIds, gameweek, new Set(fixtureCodes));
  },
});

/** The lines of the `fixtureCodes` that move a head-to-head: priced for each lineup's men whose
 *  points count. One that can't be read is logged and says why, while the scores still show. */
async function vidiprinterOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  teamIds: readonly Id<"teams">[],
  gameweek: number,
  fixtureCodes: ReadonlySet<number>,
): Promise<HeldCommentary> {
  // Before the deadline no lineup is locked, so no line moves a head-to-head yet.
  if (!(await hasBegun(ctx, league, gameweek))) return { kind: "read", lines: [], delayedFrom: null };
  try {
    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season), gameweek, teamIds);
    const { lines, delayedFrom } = await readCommentary(ctx, inGameweek, teamIds, commentaryReads(ctx), { countingOnly: true, fixtureCodes });
    return { kind: "read", lines: lines.filter((line) => line.points !== null).map(shownLine), delayedFrom };
  } catch (error) {
    return { kind: "unread", reason: logFailure(`${leagueLabel(league)} can't read gameweek ${gameweek}'s Vidiprinter`, error) };
  }
}
