import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { hasBegun, SCREEN_READ } from "../gameweekScorer/gameweekScores";
import { liveScoresIn } from "../gameweekScorer/storedScores";
import { seasonRules } from "../rules/rulesHistory";
import { commentary, heldCommentary } from "../matchup/matchupShape";
import { gameModeOf } from "../rules/gameMode";
import { leagueRulesShape } from "../rules/leagueRulesShape";
import { pinnedLetter, tradedSide } from "../schema";
import { isListedMove, LISTED_MOVES, newestFirst, playerMoveKind } from "../squads/squadPlace";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { scoredFixture, standingsOf } from "../table/leagueTable";
import { gameweekVidiprinter, matchdayOfLines } from "../table/liveScores";
import { scoredFixtures } from "../table/sentTables";
import { formOf, RESULTS } from "../table/standings";
import { gamesOf } from "../table/teamGames";
import { leagueDeadlineOf } from "../gameweeks/leagueDeadlines";
import { shownRows, TICKER_MOST } from "./glance";
import { heldRecap, homeRecap, shownRecap } from "./recaps";
import { yourGameweek, yourGameweekOf } from "./yourGameweek";

// League home (spec/12, League home; #387): the glance (this gameweek's head-to-heads, scored once
// begun, the table and each team's form), the league's latest squad moves from its events (Mail's,
// #26), the commissioner's latest letter, pinned, the latest weekly recap (recaps.ts), and matchday mode (homeClock.ts): while a matchday
// is open, the Vidiprinter of its matches' lines that move one of the league's head-to-heads. Its
// lines leave with the window; each stays on its matchup (Craig, 6 Nov 2026). For anyone with a
// part in the league.
//
// Which gameweek this is, and whether a matchday is open, needs the time, and a query must not read
// the clock: Convex caches a query by its arguments (convex/_generated/ai/guidelines.md). So the
// screen judges homeClock.ts's `clockOf` times at its minute (homeAt.ts's `clockAt`, #2005), and
// these take what it says, with no minute, so they are read again only when their data changes
// (#1550; homeAt.ts).

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
  /** This gameweek's deadline, when its lineups lock: null with no gameweek, or while none of its
   *  matches has a kickoff time. */
  deadline: v.union(v.number(), v.null()),
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
  /** The panels on the reader's own team (yourGameweek.ts); null for someone running no team in it. */
  yours: v.union(v.null(), yourGameweek),
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

/** League home's first slice, its head-to-heads `gameweek`'s: homeAt.ts's `clockAt` says which. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), gameweek: v.union(v.number(), v.null()) },
  returns: heldLeagueHome,
  handler: async (ctx, { leagueId, gameweek }) => {
    const { league, team } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const { rules, teamIds, schedule, results, scores, table, named } = await standingsOf(ctx, league, season, SCREEN_READ);
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
      deadline: current ? (await leagueDeadlineOf(ctx, leagueId))(current.gameweek) : null,
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
      yours: team ? await yourGameweekOf(ctx, leagueId, rules, team, current && { gameweek: current.gameweek, opponents: opponentsIn(current, team._id) }) : null,
    };
  },
});

/** The teams `teamId` meets in `drawn`, each once (a league playing two a gameweek can meet one twice). */
const opponentsIn = (drawn: Parameters<typeof scoredFixtures>[0], teamId: Id<"teams">) => [
  ...new Set(gamesOf([drawn], teamId).flatMap(({ against }) => (against.kind === "team" ? [against.team] : []))),
];

/** The Vidiprinter of the matchday open in `gameweek`, of its matches `fixtureCodes`: homeAt.ts's
 *  `clockAt` says which. Its delay is a moment (commentaryAt.ts). */
export const matchdayOf = query({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), fixtureCodes: v.array(v.number()) },
  returns: heldCommentary,
  handler: async (ctx, { leagueId, gameweek, fixtureCodes }) => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
    // Before the deadline no lineup is locked, so no line moves a head-to-head yet.
    if (!(await hasBegun(ctx, league, gameweek))) return { kind: "read" as const, lines: [], delayedFrom: null };
    // While a match is on, the live tick has priced the gameweek's lines once for every viewer
    // (#2007); otherwise they are priced here, alike.
    const live = await liveScoresIn(ctx, leagueId, gameweek, teamIds);
    const priced = live?.vidiprinter ?? (await gameweekVidiprinter(ctx, league, season, teamIds, gameweek));
    return matchdayOfLines(priced, new Set(fixtureCodes));
  },
});
