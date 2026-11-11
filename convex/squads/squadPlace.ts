import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { leagueEvent } from "../schema";
import { MOST_IN_SQUAD, MOST_TEAMS } from "../leagues/leagueLimits";
import { takeAllOrThrow } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";

// A player's place in a league's squads: one home for the read squads, squad numbers, the player
// card and the shortlist each make. It also holds a team's squad now (`squadOf`) and as it stood
// before a moment (`squadAt`, from the SQUAD_MOVES each change to a squad files), which lineups,
// tactics, the home page and the transactions list read.

/** The player's row in the squad of the team that holds him in this league, or null while he is a
 *  free agent. */
export function placeOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number) {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
    .unique();
}

/** The most squad rows one league holds: every team's squad full. */
const LEAGUE_SQUAD_ROWS_MOST = MOST_TEAMS * MOST_IN_SQUAD;

/** The codes of every player a team in this league holds, its squad rows read in one range rather
 *  than a `placeOf` per player (#1532): what the draft reads its undrafted players from. */
export async function heldCodesIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Set<number>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    LEAGUE_SQUAD_ROWS_MOST,
    `League ${leagueId} holds more than ${LEAGUE_SQUAD_ROWS_MOST} squad rows, so who is held can't be read`,
  );
  return new Set(rows.map(({ playerCode }) => playerCode));
}

/** Who owns a player in this league: the league's teams read once, then a lookup per player giving
 *  the team that holds him, or null while he is a free agent. A squad row naming a team outside the
 *  league throws: the squads are broken. */
export async function ownerOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<(playerCode: number) => Promise<Doc<"teams"> | null>> {
  const teams = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team]));
  return async (playerCode) => {
    const owned = await placeOf(ctx, leagueId, playerCode);
    if (owned === null) return null;
    const team = teams.get(owned.teamId);
    if (team === undefined) throw new Error(`player ${playerCode} is owned by team ${owned.teamId}, which isn't in league ${leagueId}`);
    return team;
  };
}

/** The squad moves of one player outside a trade, which both lists below hold: a new one must be
 *  added here, or the screens and the Transactions tab miss it. */
export const PLAYER_MOVES = ["playerAssigned", "playerMoved", "playerReleased", "playerDropped", "playerClaimed", "playerPickedUp"] as const;

/** The league events that change a squad. A commissioner assigns, moves and releases players
 *  (#31), a manager drops them (#1197) and picks up free agents (#1199), and a waiver run gives
 *  them for a claim (#1198), and a trade moves them (#383). */
export const SQUAD_MOVES = [...PLAYER_MOVES, "playerTraded"] as const;

/** The league events the screens list a team's moves from (My team's Transactions, League home,
 *  its News tab): every squad move but a trade's players, and each trade as one (#1491). */
export const LISTED_MOVES = [...PLAYER_MOVES, "tradeMade"] as const;
export type ListedKind = (typeof LISTED_MOVES)[number];
/** A listed move of one player: any but a trade, which the screens list with both its sides. */
export const playerMoveKind = v.union(...LISTED_MOVES.flatMap((kind) => (kind === "tradeMade" ? [] : [v.literal(kind)])));

/** Whether the move took a player off his team for no other: a release or a drop. */
const isLeaving = (kind: (typeof SQUAD_MOVES)[number]) => kind === "playerReleased" || kind === "playerDropped";

/** The most squad moves of each kind `squadAt` reads after a moment: Claude's sizing, well above a
 *  season's moves in one league. Past it this throws rather than return a wrong squad. */
export const SQUAD_MOVES_READ_MOST = 2000;

type Filed = Pick<Doc<"leagueEvents">, "at" | "_creationTime">;
/** The one order squad moves are read in, so every screen lists them alike (#630): newest first,
 *  and of two filed at the same instant the later filed first, as the league's own index orders
 *  them. */
export const newestFirst = (one: Filed, other: Filed) => other.at - one.at || other._creationTime - one._creationTime;

/** The team's squad rows, in the order its players joined it. */
export function squadOf(ctx: QueryCtx, teamId: Id<"teams">) {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .take(MOST_IN_SQUAD);
}

/** The codes of a squad's players the football sync doesn't hold: data gone wrong, which a screen
 *  shows as rows of their own after the others, never hiding them (Craig, 31 Oct 2026, #323). */
export const unheldCodes = v.array(v.number());

/** Squad rows split by whether the football sync holds each one's player: the held with their
 *  player, in the rows' order, and the codes of the rest. */
export async function heldOrNot(ctx: QueryCtx, rows: readonly Doc<"squadPlayers">[]) {
  const read = await Promise.all(rows.map(async (row) => ({ row, player: await playerByCode(ctx, row.playerCode) })));
  return {
    held: read.flatMap(({ row, player }) => (player === null ? [] : [{ row, player }])),
    unheld: read.flatMap(({ row, player }) => (player === null ? [row.playerCode] : [])),
  };
}

type LeagueEvent = Infer<typeof leagueEvent>;
type SquadMove = Extract<LeagueEvent, { kind: (typeof SQUAD_MOVES)[number] }>;
export const isSquadMove = (event: LeagueEvent): event is SquadMove => (SQUAD_MOVES as readonly string[]).includes(event.kind);
export type ListedMove = Extract<LeagueEvent, { kind: ListedKind }>;
export const isListedMove = (event: LeagueEvent): event is ListedMove => (LISTED_MOVES as readonly string[]).includes(event.kind);
/** Whether the squad move took its player off `teamId` for another team: a move or a trade. */
export const movedOff = (event: SquadMove, teamId: Id<"teams">) => (event.kind === "playerMoved" || event.kind === "playerTraded") && event.fromTeamId === teamId;

/** A league's squad moves filed at `at` or after, newest first: what `squadAt` undoes. */
export type SquadMovesSince = Doc<"leagueEvents">[];
/** The league's squad moves since a moment, as `squadMovesSince` or `squadMovesFrom` reads them. */
export type MovesSinceOf = (at: number) => Promise<SquadMovesSince>;

/** The league's squad moves filed at `at` or after, newest first. Read once for every team. */
export async function squadMovesSince(ctx: QueryCtx, leagueId: Id<"leagues">, at: number): Promise<SquadMovesSince> {
  const movesOfEachKind = await Promise.all(
    SQUAD_MOVES.map((kind) =>
      takeAllOrThrow(
        ctx.db
          .query("leagueEvents")
          .withIndex("by_leagueId_and_kind_and_at", (q) => q.eq("leagueId", leagueId).eq("event.kind", kind).gte("at", at)),
        SQUAD_MOVES_READ_MOST,
        `League ${leagueId} has more than ${SQUAD_MOVES_READ_MOST} ${kind} moves since ${at}, so its squads then can't be read`,
      ),
    ),
  );
  return movesOfEachKind.flat().toSorted(newestFirst);
}

/** The league's squad moves since any moment from `earliest` on, the league's read once, from
 *  `earliest`, and each ask handed its newest-first slice (#1542): a season of gameweeks reads one
 *  list rather than one for each deadline. A moment before `earliest` throws: it wasn't read. */
export function squadMovesFrom(ctx: QueryCtx, leagueId: Id<"leagues">, earliest: number): MovesSinceOf {
  let read: Promise<SquadMovesSince> | undefined;
  return async (at) => {
    if (at < earliest) throw new Error(`League ${leagueId}'s squad moves were read from ${earliest}, not from ${at}`);
    const moves = await (read ??= squadMovesSince(ctx, leagueId, earliest));
    const end = moves.findIndex((move) => move.at < at);
    return end === -1 ? moves : moves.slice(0, end);
  };
}

/** The team's player codes as its squad stood before `movesSince`: today's squad with each of them
 *  undone, newest first. Those still in it keep the order they joined; those who have left since
 *  follow, in the order they left. A move that doesn't fit the squad it undoes (one who joined but
 *  isn't there, one who left but is) throws: the history is broken. */
export async function squadAt(ctx: QueryCtx, teamId: Id<"teams">, movesSince: SquadMovesSince): Promise<number[]> {
  let stayed = (await squadOf(ctx, teamId)).map(({ playerCode }) => playerCode);
  let leftSince: number[] = [];
  for (const { _id, event } of movesSince) {
    // Only these kinds were read; any other is a bug in the read.
    if (!isSquadMove(event)) throw new Error(`League event ${_id} is a ${event.kind}, not a squad move`);
    const { playerCode } = event;
    const held = stayed.includes(playerCode) || leftSince.includes(playerCode);
    if (!isLeaving(event.kind) && event.teamId === teamId) {
      if (!held) throw new Error(`League event ${_id} put player ${playerCode} on team ${teamId}, but he isn't in its squad after it`);
      stayed = stayed.filter((code) => code !== playerCode);
      leftSince = leftSince.filter((code) => code !== playerCode);
    }
    const leftHere = isLeaving(event.kind) ? event.teamId === teamId : movedOff(event, teamId);
    if (leftHere) {
      if (held) throw new Error(`League event ${_id} took player ${playerCode} off team ${teamId}, but he is in its squad after it`);
      leftSince = [playerCode, ...leftSince];
    }
  }
  return [...stayed, ...leftSince];
}
