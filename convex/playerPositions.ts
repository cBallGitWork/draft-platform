import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { positionsFromStarts, positionsOf, type ApproveMode, type PlayerPositions } from "./positions";
import type { Position } from "./positionTables";
import { approveMode, position } from "./schema";

// Each player's positions (#22): his row holds what the feeds gave (his starts, his label) and the
// admin's say, and `positionsOf` works his positions out from it on every read, so a change to
// either, or to the approve mode, needs no recount. The admin's screen is #87; until sign-in (#20)
// these are internal functions, run from the dashboard or the CLI:
// `npx convex run playerPositions:approveClub '{"clubCode":3}'`.

type Row = Doc<"playerPositions">;

/** Spec/06: at first, positions from starts wait for the admin. */
const FIRST_APPROVE_MODE: ApproveMode = "proposals";

/** His positions, worked out now; a player no feed has named yet has none. */
export const ofPlayer = internalQuery({
  args: { code: v.number() },
  handler: async (ctx, { code }): Promise<PlayerPositions> => {
    const row = (await findRow(ctx, code)) ?? EMPTY_ROW;
    return positionsOf({
      starts: row.starts,
      plLabel: row.plLabel ?? null,
      admin: { approved: row.approved, confirmedLabel: row.confirmedLabel ?? null, set: row.set, removed: row.removed },
      approveMode: await currentApproveMode(ctx),
    });
  },
});

/** Approves what his starts give him now, and his label as it stands. */
export const approvePlayer = internalMutation({
  args: { code: v.number() },
  handler: async (ctx, { code }) => approve(ctx, await heldRow(ctx, code)),
});

/** Approves every player at the club, as `approvePlayer` does, and says how many. */
export const approveClub = internalMutation({
  args: { clubCode: v.number() },
  handler: async (ctx, { clubCode }): Promise<number> => {
    const players = await ctx.db.query("players").withIndex("by_clubCode", (q) => q.eq("clubCode", clubCode)).collect();
    for (const player of players) await approve(ctx, await heldRow(ctx, player.code));
    return players.length;
  },
});

/** Gives him `position` until the admin removes it: support striker is set this way (spec/06). */
export const setPosition = internalMutation({
  args: { code: v.number(), position },
  handler: async (ctx, { code, position: set }) => {
    const row = await heldRow(ctx, code);
    await ctx.db.patch("playerPositions", row._id, { set: withOne(row.set, set), removed: withoutOne(row.removed, set) });
  },
});

/** Takes `position` from him, wherever it came from, and keeps it off through every recount. */
export const removePosition = internalMutation({
  args: { code: v.number(), position },
  handler: async (ctx, { code, position: removed }) => {
    const row = await heldRow(ctx, code);
    await ctx.db.patch("playerPositions", row._id, { set: withoutOne(row.set, removed), removed: withOne(row.removed, removed) });
  },
});

export const setApproveMode = internalMutation({
  args: { approveMode },
  handler: async (ctx, { approveMode: mode }) => {
    const settings = await ctx.db.query("positionSettings").unique();
    if (settings === null) await ctx.db.insert("positionSettings", { approveMode: mode });
    else await ctx.db.patch("positionSettings", settings._id, { approveMode: mode });
  },
});

/** A player's row before any feed or the admin has written to it. */
const EMPTY_ROW: Omit<Row, "_id" | "_creationTime" | "code"> = { starts: [], approved: [], set: [], removed: [] };

/** His row, made empty if he has none yet. */
export async function heldRow(ctx: MutationCtx, code: number): Promise<Row> {
  const row = await findRow(ctx, code);
  if (row !== null) return row;
  const id = await ctx.db.insert("playerPositions", { code, ...EMPTY_ROW });
  return { _id: id, _creationTime: Date.now(), code, ...EMPTY_ROW };
}

function findRow(ctx: QueryCtx, code: number): Promise<Row | null> {
  return ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", code)).unique();
}

async function currentApproveMode(ctx: QueryCtx): Promise<ApproveMode> {
  return (await ctx.db.query("positionSettings").unique())?.approveMode ?? FIRST_APPROVE_MODE;
}

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
