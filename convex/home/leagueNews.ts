import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { namedPlayer, pinnedLetter, tradedSide } from "../schema";
import { takeAllOrThrow, takeShown } from "../shared/cappedRead";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { isListedMove, LISTED_MOVES, newestFirst, playerMoveKind } from "../squads/squadPlace";

// League home's News tab (#1356; spec/12, League home; docs/design/approved/home/, The News tab):
// every team's completed moves, newest first, over the whole season, from the squad events Mail and
// My team's Transactions read. Pending claims are never events, and a failed claim or a blocked
// trade files none, so they never show; a commissioner action that isn't a squad move is only his
// letter. A trade that went through is one row (#1491); one made before that shows as its players'
// moves. For anyone with a part in the league.
//
// Paged, never read whole: each call reads up to NEWS_READ_OF_EACH_KIND of each kind older than its
// cursor, by the league's kind-and-time index, and returns those it has read every row down to.

/** How many moves a page shows at most. */
export const NEWS_PAGE = 20;
/** How many of each kind one page reads past its cursor: Claude's sizing. With a Team filter a page
 *  may hold fewer than NEWS_PAGE, and Older moves reads on. */
export const NEWS_READ_OF_EACH_KIND = 100;
/** The most moves of one kind filed at the same instant: a waiver run's or a trade's, with room.
 *  More throws, never a silent cut. */
const SAME_INSTANT_MOST = 200;

const squadMoveKind = v.union(...LISTED_MOVES.map((kind) => v.literal(kind)));
type SquadMoveKind = Infer<typeof squadMoveKind>;

/** Where a page ends: the oldest move it read every move down to. The next page starts below it. */
const newsCursor = v.object({ at: v.number(), filed: v.number() });
type NewsCursor = Infer<typeof newsCursor>;

const playerNewsMove = v.object({
  at: v.number(),
  /** When it was filed, which orders two moves at the same instant. */
  filed: v.number(),
  kind: playerMoveKind,
  teamId: v.id("teams"),
  teamName: v.string(),
  /** The player who joined the team, if one did. */
  joined: v.union(namedPlayer, v.null()),
  /** The player who left it, if one did: on a claim or a pickup, the one dropped for him. */
  left: v.union(namedPlayer, v.null()),
  /** Whether the one who left went onto waivers, rather than back to the free agents; null when
   *  no one left by a drop. */
  toWaivers: v.union(v.boolean(), v.null()),
  /** The team a moved player came from, and its name then; null for any other kind. */
  fromTeamId: v.union(v.id("teams"), v.null()),
  fromTeamName: v.union(v.string(), v.null()),
});

/** A trade that went through, as one row (#1491): the offering team and what it gave, the team it
 *  went to and what came back, as named then. */
const tradeNewsMove = v.object({
  at: v.number(),
  filed: v.number(),
  kind: v.literal("tradeMade"),
  teamId: v.id("teams"),
  teamName: v.string(),
  otherTeamId: v.id("teams"),
  otherTeamName: v.string(),
  /** What the offering team gave, and what it got back. */
  gives: tradedSide,
  gets: tradedSide,
});

const newsMove = v.union(playerNewsMove, tradeNewsMove);
export type NewsMove = Infer<typeof newsMove>;

export const leagueNews = v.object({
  moves: v.array(newsMove),
  /** Where the next page starts; null once every move has been shown. */
  older: v.union(newsCursor, v.null()),
  /** The league's teams for the Team filter, in the order they were made. */
  teams: v.array(v.object({ teamId: v.id("teams"), teamName: v.string() })),
  pinnedLetter: v.union(v.null(), pinnedLetter),
});
export type LeagueNews = Infer<typeof leagueNews>;

type Row = Doc<"leagueEvents">;
const cursorOf = (row: Row): NewsCursor => ({ at: row.at, filed: row._creationTime });
/** Whether the row sits below the cursor, in the order the moves are listed. */
const below = (row: Row, cursor: NewsCursor) => row.at < cursor.at || (row.at === cursor.at && row._creationTime < cursor.filed);

/** One kind's moves filed at the instant `at`, newest first. */
const kindAt = (ctx: QueryCtx, leagueId: Id<"leagues">, kind: SquadMoveKind, at: number) =>
  takeAllOrThrow(
    ctx.db
      .query("leagueEvents")
      .withIndex("by_leagueId_and_kind_and_at", (q) => q.eq("leagueId", leagueId).eq("event.kind", kind).eq("at", at))
      .order("desc"),
    SAME_INSTANT_MOST,
    `League ${leagueId} has more than ${SAME_INSTANT_MOST} ${kind} moves at ${at}, so its News can't page past them`,
  );

/** One kind's moves below `before`, newest first, and whether it has more past those read. */
async function kindBelow(ctx: QueryCtx, leagueId: Id<"leagues">, kind: SquadMoveKind, before: NewsCursor | null) {
  const older = await takeShown(
    ctx.db
      .query("leagueEvents")
      .withIndex("by_leagueId_and_kind_and_at", (q) => {
        const ofKind = q.eq("leagueId", leagueId).eq("event.kind", kind);
        return before === null ? ofKind : ofKind.lt("at", before.at);
      })
      .order("desc"),
    NEWS_READ_OF_EACH_KIND,
  );
  if (before === null) return older;
  const sameInstant = await kindAt(ctx, leagueId, kind, before.at);
  return { rows: [...sameInstant.filter((row) => below(row, before)), ...older.rows], more: older.more };
}

/** The move as the News tab lists it. */
function moveOf({ _id, _creationTime, at, event }: Row): NewsMove {
  // Only squad moves were read; any other is a bug in the read.
  if (!isListedMove(event)) throw new Error(`League event ${_id} is a ${event.kind}, not a listed squad move`);
  if (event.kind === "tradeMade") {
    const { kind, fromTeamId, fromTeamName, toTeamId, toTeamName, gives, gets } = event;
    return { at, filed: _creationTime, kind, teamId: fromTeamId, teamName: fromTeamName, otherTeamId: toTeamId, otherTeamName: toTeamName, gives, gets };
  }
  const player = { playerCode: event.playerCode, playerName: event.playerName };
  const done = { at, filed: _creationTime, kind: event.kind, teamId: event.teamId, teamName: event.teamName, fromTeamId: null, fromTeamName: null };
  switch (event.kind) {
    case "playerAssigned":
      return { ...done, joined: player, left: null, toWaivers: null };
    case "playerMoved":
      return { ...done, joined: player, left: null, toWaivers: null, fromTeamId: event.fromTeamId, fromTeamName: event.fromTeamName };
    case "playerReleased":
      return { ...done, joined: null, left: player, toWaivers: null };
    case "playerDropped":
      return { ...done, joined: null, left: player, toWaivers: event.toWaivers };
    case "playerClaimed":
    case "playerPickedUp": {
      const { dropped } = event;
      return {
        ...done,
        joined: player,
        left: dropped && { playerCode: dropped.playerCode, playerName: dropped.playerName },
        toWaivers: dropped && dropped.toWaivers,
      };
    }
  }
}

/** Whether the drop is the one a claim or a pickup made, at the same instant for the same team: that
 *  move's row already names him, so his drop has no row of its own, as it has no letter. */
const madeFor = (drop: NewsMove, joining: readonly NewsMove[]) =>
  drop.kind === "playerDropped" &&
  joining.some((move) => (move.kind === "playerClaimed" || move.kind === "playerPickedUp") && move.at === drop.at && move.teamId === drop.teamId && move.left?.playerCode === drop.left?.playerCode);

/** Whether the move names the team: the one a player joined or left, the one a move took him from,
 *  or either side of a trade. */
const names = (move: NewsMove, teamId: Id<"teams">) => move.teamId === teamId || (move.kind === "tradeMade" ? move.otherTeamId : move.fromTeamId) === teamId;

/** The claims and pickups at the instant of a page's cursor, already shown above it, whose drops may
 *  sit below it. */
async function joiningAt(ctx: QueryCtx, leagueId: Id<"leagues">, before: NewsCursor | null): Promise<NewsMove[]> {
  if (before === null) return [];
  const read = await Promise.all((["playerClaimed", "playerPickedUp"] as const).map((kind) => kindAt(ctx, leagueId, kind, before.at)));
  return read.flat().map(moveOf);
}

/** A page of the league's moves below `before`, newest first: those of `kind` only, and those
 *  naming `teamId` only (a move names the team he left too), when given. */
export const ofLeague = query({
  args: {
    leagueId: v.id("leagues"),
    before: v.union(newsCursor, v.null()),
    teamId: v.union(v.id("teams"), v.null()),
    kind: v.union(squadMoveKind, v.null()),
  },
  returns: leagueNews,
  handler: async (ctx, { leagueId, before, teamId, kind }) => {
    const { league } = await memberOf(ctx, leagueId);
    const kinds = kind === null ? LISTED_MOVES : [kind];
    const ofEachKind = await Promise.all(kinds.map((each) => kindBelow(ctx, leagueId, each, before)));
    // Every move at or above the newest of the cut kinds' last rows has been read: the page ends there.
    const ends = ofEachKind.flatMap(({ rows, more }) => (more ? [rows.at(-1)!] : [])).toSorted(newestFirst);
    const end = ends.at(0) ?? null;
    const read = ofEachKind
      .flatMap(({ rows }) => rows)
      .filter((row) => end === null || newestFirst(row, end) <= 0)
      .toSorted(newestFirst)
      .map(moveOf);
    const joining = [...read, ...(await joiningAt(ctx, leagueId, before))];
    const shown = read.filter((move) => !madeFor(move, joining) && (teamId === null || names(move, teamId)));
    const cut = shown.length > NEWS_PAGE;
    const moves = shown.slice(0, NEWS_PAGE);
    const last = moves.at(-1);
    return {
      moves,
      older: cut && last ? { at: last.at, filed: last.filed } : end && cursorOf(end),
      teams: (await teamsOf(ctx, leagueId)).map((team) => ({ teamId: team._id, teamName: team.name })),
      pinnedLetter: league.pinnedLetter ?? null,
    };
  },
});
