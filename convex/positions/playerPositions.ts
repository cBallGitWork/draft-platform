import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { adminOf } from "../shared/leagueAccess";
import { currentClubs, currentPlayersAt, playersNamed } from "../shared/players";
import { howPositionsCount, type HowPositionsCount } from "./positionSettings";
import { positionsFromStarts, positionsOf, type PlayerPositions } from "./positions";
import type { Position } from "./positionTables";
import { approveMode, changeThresholds, position } from "../schema";

// Each player's positions (#22): his row holds what the feeds gave (his starts, his label) and the
// admin's say, and `positionsOf` works his positions out from it on every read, so a change to
// either, or to the approve mode, needs no recount. Every function here is the admin's alone
// (spec/06, The admin oversees them; #87), checked on the server by his email.

type Row = Doc<"playerPositions">;
/** What a row holds about a player, without what identifies it. */
type RowFields = Omit<Row, "_id" | "_creationTime" | "code">;

/** A player's row before any feed or the admin has written to it. */
const EMPTY_ROW: RowFields = { starts: [], approved: [], set: [], removed: [] };

/** His positions, worked out now; a player no feed has named yet has none. */
export const ofPlayer = query({
  args: { code: v.number() },
  handler: async (ctx, { code }): Promise<PlayerPositions> => {
    await adminOf(ctx);
    return positionsFrom((await findRow(ctx, code)) ?? EMPTY_ROW, await howPositionsCount(ctx));
  },
});

/** His positions now, from his row and how positions count. */
function positionsFrom(row: RowFields, how: HowPositionsCount): PlayerPositions {
  return positionsOf({
    starts: row.starts,
    plLabel: row.plLabel ?? null,
    admin: { approved: row.approved, confirmedLabel: row.confirmedLabel ?? null, set: row.set, removed: row.removed },
    ...how,
  });
}

/** Approves what his starts give him now, and his label as it stands. */
export const approvePlayer = mutation({
  args: { code: v.number() },
  returns: v.null(),
  handler: async (ctx, { code }) => {
    await adminOf(ctx);
    await approve(ctx, await heldRow(ctx, code));
    return null;
  },
});

/** Approves every player at the club now, as `approvePlayer` does, and says how many. One who
 *  has left the Premier League is not approved, nor given a row. */
export const approveClub = mutation({
  args: { clubCode: v.number() },
  returns: v.number(),
  handler: async (ctx, { clubCode }): Promise<number> => {
    await adminOf(ctx);
    const players = await currentPlayersAt(ctx, clubCode);
    for (const player of players) await approve(ctx, await heldRow(ctx, player.code));
    return players.length;
  },
});

/** Gives him `position` until the admin removes it: support striker is set this way (spec/06). */
export const setPosition = mutation({
  args: { code: v.number(), position },
  returns: v.null(),
  handler: async (ctx, { code, position: given }) => {
    await adminOf(ctx);
    const row = await heldRow(ctx, code);
    await ctx.db.patch("playerPositions", row._id, { set: withOne(row.set, given), removed: withoutOne(row.removed, given) });
    return null;
  },
});

/** Takes `position` from him, wherever it came from, and keeps it off through every recount. */
export const removePosition = mutation({
  args: { code: v.number(), position },
  returns: v.null(),
  handler: async (ctx, { code, position: taken }) => {
    await adminOf(ctx);
    const row = await heldRow(ctx, code);
    await ctx.db.patch("playerPositions", row._id, { set: withoutOne(row.set, taken), removed: withOne(row.removed, taken) });
    return null;
  },
});

/** A player as the dashboard names him (spec/06): his full name for the links it gives. */
const queuedPlayer = { code: v.number(), name: v.string(), fullName: v.string(), clubCode: v.number() };

const positionsQueue = v.object({
  newSignings: v.array(v.object({ ...queuedPlayer, label: v.string() })),
  waiting: v.array(v.object({ ...queuedPlayer, proposals: v.array(position) })),
  /** Positions from starts a run elsewhere has flagged, then removed (spec/06, When positions change). */
  flagged: v.array(v.object({ ...queuedPlayer, position, startsElsewhere: v.number() })),
  removed: v.array(v.object({ ...queuedPlayer, position })),
  /** The clubs, by name, for approving one whole. */
  clubs: v.array(v.object({ code: v.number(), name: v.string() })),
  approveMode,
  thresholds: changeThresholds,
});
export type PositionsQueue = Infer<typeof positionsQueue>;

/** The admin's queue (spec/06; spec/15): new signings, whose starts give no position yet (fewer than
 *  3 at a place) and who play on their label until he confirms it, the men whose starts give
 *  positions waiting for his approval, and positions flagged or removed. By name. It reads the rows
 *  of today's players only, within players.ts's caps, which throw past them rather than lose the
 *  newest, who are the new signings (#214). */
export const queue = query({
  args: {},
  returns: positionsQueue,
  handler: async (ctx) => {
    await adminOf(ctx);
    const how = await howPositionsCount(ctx);
    const newSignings = [];
    const waiting = [];
    const flagged = [];
    const removed = [];
    const currentClubsHeld = await currentClubs(ctx);
    const currentPlayers = (await Promise.all(currentClubsHeld.map((club) => currentPlayersAt(ctx, club.code)))).flat();
    for (const player of currentPlayers) {
      const row = await findRow(ctx, player.code);
      if (row === null) continue;
      const positionsNow = positionsFrom(row, how);
      const who = { code: row.code, name: player.name, fullName: player.fullName, clubCode: player.clubCode };
      const onLabel = positionsFromStarts(row.starts).positions.length === 0;
      if (onLabel && row.plLabel !== undefined && row.confirmedLabel !== row.plLabel) {
        newSignings.push({ ...who, label: row.plLabel });
      }
      if (positionsNow.proposals.length > 0) waiting.push({ ...who, proposals: positionsNow.proposals });
      for (const { position: held, flaggedElsewhere } of positionsNow.positions) {
        if (flaggedElsewhere !== null) flagged.push({ ...who, position: held, startsElsewhere: flaggedElsewhere });
      }
      for (const lost of positionsNow.removed) removed.push({ ...who, position: lost });
    }
    const byName = (one: { name: string }, other: { name: string }) => one.name.localeCompare(other.name);
    const clubs = currentClubsHeld
      .map(({ code, name }) => ({ code, name }))
      .sort(byName);
    return {
      newSignings: newSignings.sort(byName),
      waiting: waiting.sort(byName),
      flagged: flagged.sort(byName),
      removed: removed.sort(byName),
      clubs,
      approveMode: how.approveMode,
      thresholds: how.thresholds,
    };
  },
});

const heldPosition = v.object({
  position,
  source: v.union(v.literal("starts"), v.literal("label"), v.literal("admin")),
  confirmed: v.boolean(),
  flaggedElsewhere: v.union(v.number(), v.null()),
});
const foundPlayer = v.object({ ...queuedPlayer, positions: v.array(heldPosition) });
export type FoundPlayerPositions = Infer<typeof foundPlayer>;

/** Players whose name matches, with their positions now, for the admin to correct any of them
 *  (spec/06). Never those who have left the Premier League. */
export const find = query({
  args: { text: v.string() },
  returns: v.array(foundPlayer),
  handler: async (ctx, { text }) => {
    await adminOf(ctx);
    if (!text.trim()) return [];
    const how = await howPositionsCount(ctx);
    const found = await playersNamed(ctx, text);
    return Promise.all(
      found.map(async (player) => ({
        code: player.code,
        name: player.name,
        fullName: player.fullName,
        clubCode: player.clubCode,
        positions: positionsFrom((await findRow(ctx, player.code)) ?? EMPTY_ROW, how).positions,
      })),
    );
  },
});

/** His row, made empty if he has none yet. */
export async function heldRow(ctx: MutationCtx, code: number): Promise<Row> {
  const row = await findRow(ctx, code);
  if (row !== null) return row;
  const id = await ctx.db.insert("playerPositions", { code, ...EMPTY_ROW });
  return (await ctx.db.get("playerPositions", id))!;
}

function findRow(ctx: QueryCtx, code: number): Promise<Row | null> {
  return ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", code)).unique();
}

/** Adds what his starts give him now to what the admin approved before, and confirms his label. */
async function approve(ctx: MutationCtx, row: Row): Promise<void> {
  const approved = positionsFromStarts(row.starts).positions.reduce(withOne, row.approved);
  await ctx.db.patch("playerPositions", row._id, { approved, confirmedLabel: row.plLabel });
}

function withOne(positions: Position[], added: Position): Position[] {
  return positions.includes(added) ? positions : [...positions, added];
}

function withoutOne(positions: Position[], dropped: Position): Position[] {
  return positions.filter((each) => each !== dropped);
}
