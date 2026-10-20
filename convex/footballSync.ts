import type { FunctionReference, WithoutSystemFields } from "convex/server";
import { v, type Infer, type Value } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, TableNames } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "./_generated/server";
import { readFpl } from "./fpl";
import {
  clubRecord,
  fixtureRecord,
  footballSyncFields,
  footballSyncTrigger,
  gameweekRecord,
  playerRecord,
  tableWrites,
} from "./schema";

// Issue #21: the real Premier League's clubs, players, fixtures and gameweeks, copied in from the
// football layer. crons.ts runs it on a schedule; from the CLI:
// `npx convex run footballSync:run '{"trigger":"manual"}'`, then `footballSync:latest`.

type TableWrites = Infer<typeof tableWrites>;
type Upserted = Omit<TableWrites, "received">;

/** Rows per mutation: well inside Convex's per-transaction limits, and a season's ~700 players in four. */
export const BATCH_SIZE = 200;

export const run = internalAction({
  args: { trigger: footballSyncTrigger },
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    let outcome: Infer<typeof footballSyncFields.outcome>;
    try {
      // The seam: swap `readFpl` for another feed's reader that returns the same `Football`.
      const football = await readFpl();
      outcome = {
        ok: true,
        // Clubs first, so a player or a fixture never names a club not yet held.
        clubs: await writeAll(ctx, internal.footballSync.upsertClubs, football.clubs),
        players: await writeAll(ctx, internal.footballSync.upsertPlayers, football.players),
        fixtures: await writeAll(ctx, internal.footballSync.upsertFixtures, football.fixtures),
        gameweeks: await writeAll(ctx, internal.footballSync.upsertGameweeks, football.gameweeks),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`football sync failed: ${message}`);
      outcome = { ok: false, error: message };
    }
    await ctx.runMutation(internal.footballSync.record, { trigger, ranAt, outcome });
  },
});

export const upsertClubs = internalMutation({
  args: { rows: v.array(clubRecord) },
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "clubs", rows, (row) =>
      ctx.db.query("clubs").withIndex("by_code", (q) => q.eq("code", row.code)).unique(),
    ),
});

export const upsertPlayers = internalMutation({
  args: { rows: v.array(playerRecord) },
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "players", rows, (row) =>
      ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", row.code)).unique(),
    ),
});

export const upsertFixtures = internalMutation({
  args: { rows: v.array(fixtureRecord) },
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "fixtures", rows, (row) =>
      ctx.db.query("fixtures").withIndex("by_code", (q) => q.eq("code", row.code)).unique(),
    ),
});

export const upsertGameweeks = internalMutation({
  args: { rows: v.array(gameweekRecord) },
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "gameweeks", rows, (row) =>
      ctx.db.query("gameweeks").withIndex("by_number", (q) => q.eq("number", row.number)).unique(),
    ),
});

export const record = internalMutation({
  args: footballSyncFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("footballSyncs", row);
  },
});

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("footballSyncs").order("desc").take(5),
});

/** Every row, in batches of `BATCH_SIZE`, one mutation each. */
async function writeAll<Row>(
  ctx: ActionCtx,
  upsertBatch: FunctionReference<"mutation", "internal", { rows: Row[] }, Upserted>,
  rows: Row[],
): Promise<TableWrites> {
  const writes: TableWrites = { received: rows.length, inserted: 0, updated: 0 };
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch: Upserted = await ctx.runMutation(upsertBatch, { rows: rows.slice(start, start + BATCH_SIZE) });
    writes.inserted += batch.inserted;
    writes.updated += batch.updated;
  }
  return writes;
}

/** Inserts each row new to its table and patches each that changed, found by its stable key with
 *  `find`; a row already held as sent is not written. */
async function upsertEach<Table extends TableNames>(
  ctx: MutationCtx,
  table: Table,
  rows: WithoutSystemFields<Doc<Table>>[],
  find: (row: WithoutSystemFields<Doc<Table>>) => Promise<Doc<Table> | null>,
): Promise<Upserted> {
  const upserted: Upserted = { inserted: 0, updated: 0 };
  await Promise.all(
    rows.map(async (row) => {
      const held = await find(row);
      if (held === null) {
        await ctx.db.insert(table, row);
        upserted.inserted += 1;
      } else if (!sameFields(row, held)) {
        // No record has an optional field, so a patch with every field rewrites the whole row.
        await ctx.db.patch(table, held._id, row);
        upserted.updated += 1;
      }
    }),
  );
  return upserted;
}

/** Every field the feed sent equals the held one. The records are flat, so `===` compares them. */
function sameFields(row: Record<string, Value>, held: Record<string, Value>): boolean {
  return Object.keys(row).every((field) => row[field] === held[field]);
}
