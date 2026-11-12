import { v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { CLUB_PLAYERS_MOST } from "../shared/players";
import { eachPlayerPage } from "../stats/seasonRebuilds";

// Scouting's row a player (#1559, the scoutingPlayers table): his name and club, what his
// positions are worked out from, and his newest season's totals, copied onto one row, so the
// players list reads one row a player where it read three (players, playerPositions and
// playerSeasonStats). Each write to one of those rows keeps his copy in step by calling
// `keepScoutingPlayer` in the same transaction: the football sync's player writes, the
// positions writes (playerPositions.ts) and the season totals' (seasonStats.ts). A copy is only
// written when it changed, so a feed read that changes nothing re-runs no list. `rebuild` copies
// every player afresh, for a deployment holding players from before the table.

/** How every player's row is copied afresh by hand. */
export const SCOUTING_REBUILD_COMMAND = `npx convex run scouting/scoutingPlayers:rebuild '{"cursor":null}'`;

export type ScoutingPlayer = Doc<"scoutingPlayers">;
type ScoutingFields = WithoutSystemFields<ScoutingPlayer>;

/** What a player with no positions row has his positions worked out from: nothing yet. */
const NO_POSITION_INPUTS: ScoutingFields["positions"] = { starts: [], approved: [], set: [], removed: [] };

/** Copies his row of `players`, his positions row and his newest season's totals onto his
 *  Scouting row, writing it only when it changed. A player the football sync doesn't hold has no
 *  row. Four reads. */
export async function keepScoutingPlayer(ctx: MutationCtx, code: number): Promise<void> {
  const [player, positions, totals, held] = await Promise.all([
    ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique(),
    ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", code)).unique(),
    ctx.db.query("playerSeasonStats").withIndex("by_playerCode_and_season", (q) => q.eq("playerCode", code)).order("desc").first(),
    scoutingPlayerByCode(ctx, code),
  ]);
  if (player === null) {
    if (held !== null) await ctx.db.delete("scoutingPlayers", held._id);
    return;
  }
  const row = scoutingFields(player, positions, totals);
  if (held === null) await ctx.db.insert("scoutingPlayers", row);
  else if (!sameValue(withoutSystemFields(held), row)) await ctx.db.replace("scoutingPlayers", held._id, row);
}

/** Each of these players' rows kept, as `keepScoutingPlayer`. */
export async function keepScoutingPlayers(ctx: MutationCtx, codes: Iterable<number>): Promise<void> {
  for (const code of new Set(codes)) await keepScoutingPlayer(ctx, code);
}

function scoutingFields(
  { code, name, fullName, clubCode, droppedAt }: Doc<"players">,
  positions: Doc<"playerPositions"> | null,
  totals: Doc<"playerSeasonStats"> | null,
): ScoutingFields {
  return {
    code,
    name,
    fullName,
    clubCode,
    ...(droppedAt !== undefined && { droppedAt }),
    positions: positions === null ? NO_POSITION_INPUTS : positionInputsOf(positions),
    ...(totals !== null && { totals: { season: totals.season, stats: totals.stats } }),
  };
}

function positionInputsOf({ _id, _creationTime, code, ...inputs }: Doc<"playerPositions">): ScoutingFields["positions"] {
  return inputs;
}

function withoutSystemFields({ _id, _creationTime, ...fields }: ScoutingPlayer): ScoutingFields {
  return fields;
}

/** Whether two stored values are the same, field by field whatever the fields' order; an absent
 *  field and one held as undefined are the same. */
export function sameValue(one: unknown, other: unknown): boolean {
  if (one === other) return true;
  if (typeof one !== "object" || typeof other !== "object" || one === null || other === null) return false;
  if (Array.isArray(one) || Array.isArray(other)) {
    return Array.isArray(one) && Array.isArray(other) && one.length === other.length && one.every((each, index) => sameValue(each, other[index]));
  }
  const fieldsOf = (value: object) => Object.entries(value).filter(([, each]) => each !== undefined);
  const otherFields = new Map(fieldsOf(other));
  const ownFields = fieldsOf(one);
  return ownFields.length === otherFields.size && ownFields.every(([field, each]) => otherFields.has(field) && sameValue(each, otherFields.get(field)));
}

/** His Scouting row, dropped or not, or null while none is held. */
export function scoutingPlayerByCode(ctx: QueryCtx, code: number): Promise<ScoutingPlayer | null> {
  return ctx.db
    .query("scoutingPlayers")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

/** The Scouting rows of the players at the club now, the dropped left out. */
export function currentScoutingPlayersAt(ctx: QueryCtx, clubCode: number): Promise<ScoutingPlayer[]> {
  return takeAllOrThrow(
    ctx.db.query("scoutingPlayers").withIndex("by_clubCode_and_droppedAt", (q) => q.eq("clubCode", clubCode).eq("droppedAt", undefined)),
    CLUB_PLAYERS_MOST,
    `More than ${CLUB_PLAYERS_MOST} players are held at club ${clubCode}, so they would be cut short`,
  );
}

/** Throws when the football sync holds a current player but no Scouting row is held at all: a
 *  deployment from before the table, whose rows `rebuild` copies. Two reads. */
export async function checkScoutingPlayersHeld(ctx: QueryCtx): Promise<void> {
  if ((await ctx.db.query("scoutingPlayers").first()) !== null) return;
  const player = await ctx.db
    .query("players")
    .withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined))
    .first();
  if (player !== null) throw new Error(`No Scouting row is held for any player; run ${SCOUTING_REBUILD_COMMAND}`);
}

/** Copies a page of players' rows, from `cursor` (null for the first), afresh, then runs on to the
 *  next page until every player is done. Safe to run again: each row is set, never added to. The
 *  football sync copies every player it sends too, so a deployment from before the table is put
 *  right by its next run if no one runs this by hand. */
export const rebuild = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    await eachPlayerPage(ctx, cursor, (codes) => keepScoutingPlayers(ctx, codes), internal.scouting.scoutingPlayers.rebuild);
    return null;
  },
});
