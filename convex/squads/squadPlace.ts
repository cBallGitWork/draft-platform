import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { leagueEvent } from "../schema";
import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { takeAllOrThrow } from "../shared/cappedRead";

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

/** The league events that change a squad. Today a commissioner assigns, moves and releases players
 *  (#31); waiver claims and trades join them when built. */
export const SQUAD_MOVES = ["playerAssigned", "playerMoved", "playerReleased"] as const;

/** The most squad moves of each kind `squadAt` reads after a moment: Claude's sizing, well above a
 *  season's moves in one league. Past it this throws rather than return a wrong squad. */
export const SQUAD_MOVES_READ_MOST = 2000;

/** The team's squad rows, in the order its players joined it. */
export function squadOf(ctx: QueryCtx, teamId: Id<"teams">) {
  return ctx.db
    .query("squadPlayers")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .take(MOST_IN_SQUAD);
}

type LeagueEvent = Infer<typeof leagueEvent>;
type SquadMove = Extract<LeagueEvent, { kind: (typeof SQUAD_MOVES)[number] }>;
export const isSquadMove = (event: LeagueEvent): event is SquadMove => (SQUAD_MOVES as readonly string[]).includes(event.kind);

/** A league's squad moves filed at `at` or after, newest first: what `squadAt` undoes. */
export type SquadMovesSince = Doc<"leagueEvents">[];

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
  return movesOfEachKind.flat().toSorted((one, other) => other._creationTime - one._creationTime);
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
    if (event.kind !== "playerReleased" && event.teamId === teamId) {
      if (!held) throw new Error(`League event ${_id} put player ${playerCode} on team ${teamId}, but he isn't in its squad after it`);
      stayed = stayed.filter((code) => code !== playerCode);
      leftSince = leftSince.filter((code) => code !== playerCode);
    }
    const leftHere = event.kind === "playerReleased" ? event.teamId === teamId : event.kind === "playerMoved" && event.fromTeamId === teamId;
    if (leftHere) {
      if (held) throw new Error(`League event ${_id} took player ${playerCode} off team ${teamId}, but he is in its squad after it`);
      leftSince = [playerCode, ...leftSince];
    }
  }
  return [...stayed, ...leftSince];
}
