import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { adminOf } from "./leagueAccess";
import { positionsFromStarts, positionsOf, type ApproveMode, type PlayerPositions } from "./positions";
import type { Position } from "./positionTables";
import { approveMode, position } from "./schema";

// Each player's positions (#22): his row holds what the feeds gave (his starts, his label) and the
// admin's say, and `positionsOf` works his positions out from it on every read, so a change to
// either, or to the approve mode, needs no recount. Every function here is the admin's alone
// (spec/06, The admin oversees them; #87), checked on the server by his email.

type Row = Doc<"playerPositions">;

/** Spec/06: at first, positions from starts wait for the admin. */
const FIRST_APPROVE_MODE: ApproveMode = "proposals";

/** A player's row before any feed or the admin has written to it. */
const EMPTY_ROW: Omit<Row, "_id" | "_creationTime" | "code"> = { starts: [], approved: [], set: [], removed: [] };

/** His positions, worked out now; a player no feed has named yet has none. */
export const ofPlayer = query({
  args: { code: v.number() },
  handler: async (ctx, { code }): Promise<PlayerPositions> => {
    await adminOf(ctx);
    return positionsFrom((await findRow(ctx, code)) ?? EMPTY_ROW, await currentApproveMode(ctx));
  },
});

function positionsFrom(row: Pick<Row, "starts" | "plLabel" | "approved" | "confirmedLabel" | "set" | "removed">, approveMode: ApproveMode) {
  return positionsOf({
    starts: row.starts,
    plLabel: row.plLabel ?? null,
    admin: { approved: row.approved, confirmedLabel: row.confirmedLabel ?? null, set: row.set, removed: row.removed },
    approveMode,
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

/** Approves every player at the club, as `approvePlayer` does, and says how many. */
export const approveClub = mutation({
  args: { clubCode: v.number() },
  returns: v.number(),
  handler: async (ctx, { clubCode }): Promise<number> => {
    await adminOf(ctx);
    const players = await ctx.db.query("players").withIndex("by_clubCode", (q) => q.eq("clubCode", clubCode)).collect();
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

/** Whether positions from starts wait for his approval or count at once (spec/06). */
export const setApproveMode = mutation({
  args: { approveMode },
  returns: v.null(),
  handler: async (ctx, { approveMode: mode }) => {
    await adminOf(ctx);
    const settings = await ctx.db.query("positionSettings").unique();
    if (settings === null) await ctx.db.insert("positionSettings", { approveMode: mode });
    else await ctx.db.patch("positionSettings", settings._id, { approveMode: mode });
    return null;
  },
});

/** The most rows of players the queue reads: every man FPL lists in a season, with room. */
const PLAYERS_MOST = 1500;

/** The admin's queue (spec/06; spec/15): new signings, who have no starts and play on their label
 *  until he confirms it, and the men whose starts give positions waiting for his approval. By name. */
export const queue = query({
  args: {},
  returns: v.object({
    newSignings: v.array(v.object({ code: v.number(), name: v.string(), clubCode: v.number(), label: v.union(v.string(), v.null()) })),
    waiting: v.array(v.object({ code: v.number(), name: v.string(), clubCode: v.number(), proposals: v.array(position) })),
  }),
  handler: async (ctx) => {
    await adminOf(ctx);
    const approveMode = await currentApproveMode(ctx);
    const newSignings = [];
    const waiting = [];
    for (const row of await ctx.db.query("playerPositions").take(PLAYERS_MOST)) {
      const player = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", row.code)).unique();
      if (player === null || player.droppedAt !== undefined) continue;
      const { proposals } = positionsFrom(row, approveMode);
      const who = { code: row.code, name: player.name, clubCode: player.clubCode };
      if (row.starts.length === 0 && row.plLabel !== undefined && row.confirmedLabel !== row.plLabel) {
        newSignings.push({ ...who, label: row.plLabel });
      }
      if (proposals.length > 0) waiting.push({ ...who, proposals });
    }
    const byName = (one: { name: string }, other: { name: string }) => one.name.localeCompare(other.name);
    return { newSignings: newSignings.sort(byName), waiting: waiting.sort(byName) };
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

async function currentApproveMode(ctx: QueryCtx): Promise<ApproveMode> {
  return (await ctx.db.query("positionSettings").unique())?.approveMode ?? FIRST_APPROVE_MODE;
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
