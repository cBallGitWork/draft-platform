import {
  paginationOptsValidator,
  type FunctionReference,
  type PaginationOptions,
  type PaginationResult,
  type WithoutSystemFields,
} from "convex/server";
import { v, type Infer, type Value } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx } from "../_generated/server";
import { outcomeOf } from "../shared/errors";
import { fixtureByCode } from "../shared/fixtures";
import { findClubByCode, playerByCode } from "../shared/players";
import { readFpl } from "./fpl/fpl";
import {
  clubRecord,
  fixtureRecord,
  footballSyncFields,
  syncTrigger,
  gameweekRecord,
  playerRecord,
  tableWrites,
} from "../schema";
import { BATCH_SIZE, LATEST_RUNS } from "../shared/syncRuns";
import { recordPassedDeadlines } from "../gameweeks/deadlineRecorder";
import { emailIfFailed } from "../admin/feedFailureEmails";
import { writeScores } from "./matchScores";

// Issue #21: the real Premier League's clubs, players, fixtures and gameweeks, copied in from the
// football layer, and each match's score (#49, matchScores.ts). crons.ts runs it on a schedule;
// from the CLI: `npx convex run football/footballSync:run '{"trigger":"manual"}'`, then `football/footballSync:latest`.
// A held row the feed stops sending is kept and marked `droppedAt`, never deleted, and only by a
// sync that read the whole list (#64). Rows are matched on their stable key, a player on his
// `code`, so one sent again is unmarked in his own row.

// The schema's counts are optional only for runs before #64; every run since writes them all.
type TableWrites = Required<Infer<typeof tableWrites>>;
const upserted = v.object({ inserted: v.number(), updated: v.number(), unmarked: v.number() });
type Upserted = Infer<typeof upserted>;

const footballTable = v.union(v.literal("clubs"), v.literal("players"), v.literal("fixtures"), v.literal("gameweeks"));
type FootballTable = Infer<typeof footballTable>;
/** A record or a held row, by the key it is matched on. */
type Keyed = { code: number } | { number: number };
const markedPage = v.object({ marked: v.number(), cursor: v.string(), isDone: v.boolean() });
type MarkedPage = Infer<typeof markedPage>;

export const run = internalAction({
  args: { trigger: syncTrigger },
  returns: v.null(),
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    const outcome: Infer<typeof footballSyncFields.outcome> = await outcomeOf("football sync failed", async () => {
      // The seam: swap `readFpl` for another feed's reader that returns the same `Football`.
      // It throws on a failed fetch or a changed payload, so only a whole list reaches `syncTable`.
      const football = await readFpl();
      return {
        ok: true as const,
        // Clubs first, so a player or a fixture never names a club not yet held.
        clubs: await syncTable(ctx, "clubs", internal.football.footballSync.upsertClubs, football.clubs, ranAt),
        players: await syncTable(ctx, "players", internal.football.footballSync.upsertPlayers, football.players, ranAt),
        fixtures: await syncTable(ctx, "fixtures", internal.football.footballSync.upsertFixtures, football.fixtures, ranAt),
        gameweeks: await syncTable(ctx, "gameweeks", internal.football.footballSync.upsertGameweeks, football.gameweeks, ranAt),
        scores: await writeScores(ctx, "fpl", ranAt, football.scores),
      };
    });
    await ctx.runMutation(internal.football.footballSync.record, { trigger, ranAt, outcome });
    return null;
  },
});

export const upsertClubs = internalMutation({
  args: { rows: v.array(clubRecord) },
  returns: upserted,
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "clubs", rows, (row) => findClubByCode(ctx, row.code)),
});

export const upsertPlayers = internalMutation({
  args: { rows: v.array(playerRecord) },
  returns: upserted,
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "players", rows, (row) => playerByCode(ctx, row.code)),
});

export const upsertFixtures = internalMutation({
  args: { rows: v.array(fixtureRecord) },
  returns: upserted,
  handler: async (ctx, { rows }): Promise<Upserted> => {
    // In the same transaction as the kickoffs it may move (#150, deadlineRecorder.ts).
    await recordPassedDeadlines(ctx);
    return upsertEach(ctx, "fixtures", rows, (row) => fixtureByCode(ctx, row.code));
  },
});

export const upsertGameweeks = internalMutation({
  args: { rows: v.array(gameweekRecord) },
  returns: upserted,
  handler: (ctx, { rows }): Promise<Upserted> =>
    upsertEach(ctx, "gameweeks", rows, (row) =>
      ctx.db.query("gameweeks").withIndex("by_number", (q) => q.eq("number", row.number)).unique(),
    ),
});

/** One page of `table`'s held rows not yet marked: each not in `sentKeys` is marked `droppedAt`.
 *  A page at a time, because a table's every unmarked row is read. */
export const markDropped = internalMutation({
  args: {
    table: footballTable,
    sentKeys: v.array(v.number()),
    droppedAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: markedPage,
  handler: async (ctx, { table, sentKeys, droppedAt, paginationOpts }): Promise<MarkedPage> => {
    // Dropping a match can move its gameweek's first kickoff: as upsertFixtures (#150).
    if (table === "fixtures") await recordPassedDeadlines(ctx);
    const sent = new Set(sentKeys);
    const page = await unmarkedPage(ctx, table, paginationOpts);
    const dropped = page.page.filter((held) => !sent.has(keyOf(held)));
    await Promise.all(dropped.map((held) => ctx.db.patch(table, held._id, { droppedAt })));
    return { marked: dropped.length, cursor: page.continueCursor, isDone: page.isDone };
  },
});

export const record = internalMutation({
  args: footballSyncFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("footballSyncs", row);
    await emailIfFailed(ctx, "football", row);
    return null;
  },
});

export const latest = internalQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("footballSyncs"), _creationTime: v.number(), ...footballSyncFields })),
  handler: async (ctx) => ctx.db.query("footballSyncs").order("desc").take(LATEST_RUNS),
});

/** One page of `table`'s rows not yet marked dropped, so a row marked by an earlier sync is never
 *  read again. Paging an index on `droppedAt` while marking is safe: a row this page marks leaves
 *  the range at or before the cursor, so no later page skips or repeats a row; and this run's
 *  upserts all finish before its first mark page (syncTable), so no kickoff moves a fixture past
 *  the cursor. */
function unmarkedPage(
  ctx: MutationCtx,
  table: FootballTable,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<FootballTable>>> {
  switch (table) {
    case "clubs":
      return ctx.db.query("clubs").withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined)).paginate(paginationOpts);
    case "players":
      return ctx.db.query("players").withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined)).paginate(paginationOpts);
    case "fixtures":
      return ctx.db
        .query("fixtures")
        .withIndex("by_droppedAt_and_kickoff", (q) => q.eq("droppedAt", undefined))
        .paginate(paginationOpts);
    case "gameweeks":
      return ctx.db.query("gameweeks").withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined)).paginate(paginationOpts);
  }
}

/** A row's stable key: a club's, player's or match's season-stable code, or a gameweek's number. */
function keyOf(row: Keyed): number {
  return "code" in row ? row.code : row.number;
}

/** Every row the feed sent, upserted in batches of `BATCH_SIZE`; then every held row it did not
 *  send is marked as dropped at `ranAt`. */
async function syncTable<Row extends Keyed>(
  ctx: ActionCtx,
  table: FootballTable,
  upsertBatch: FunctionReference<"mutation", "internal", { rows: Row[] }, Upserted>,
  rows: Row[],
  ranAt: number,
): Promise<TableWrites> {
  const writes: TableWrites = { received: rows.length, inserted: 0, updated: 0, marked: 0, unmarked: 0 };
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch: Upserted = await ctx.runMutation(upsertBatch, { rows: rows.slice(start, start + BATCH_SIZE) });
    writes.inserted += batch.inserted;
    writes.updated += batch.updated;
    writes.unmarked += batch.unmarked;
  }
  const sentKeys = rows.map(keyOf);
  let cursor: string | null = null;
  for (let isDone = false; !isDone; ) {
    const page: MarkedPage = await ctx.runMutation(
      internal.football.footballSync.markDropped,
      { table, sentKeys, droppedAt: ranAt, paginationOpts: { cursor, numItems: BATCH_SIZE } },
    );
    writes.marked += page.marked;
    ({ cursor, isDone } = page);
  }
  return writes;
}

/** Inserts each row new to its table and patches each that changed or was marked dropped, found
 *  by its stable key with `find`; a row already held as sent is not written. */
async function upsertEach<Table extends FootballTable>(
  ctx: MutationCtx,
  table: Table,
  rows: WithoutSystemFields<Doc<Table>>[],
  find: (row: WithoutSystemFields<Doc<Table>>) => Promise<Doc<Table> | null>,
): Promise<Upserted> {
  const upserted: Upserted = { inserted: 0, updated: 0, unmarked: 0 };
  await Promise.all(
    rows.map(async (row) => {
      const held = await find(row);
      if (held === null) {
        await ctx.db.insert(table, row);
        upserted.inserted += 1;
        return;
      }
      const changed = !sameFields(row, held);
      const sentAgain = held.droppedAt !== undefined;
      if (changed) upserted.updated += 1;
      if (sentAgain) upserted.unmarked += 1;
      // A record holds every field but `droppedAt`, so the patch rewrites the rest of the row, and
      // `droppedAt: undefined` removes the mark (Convex drops a field patched to undefined).
      if (changed || sentAgain) await ctx.db.patch(table, held._id, sentAgain ? { ...row, droppedAt: undefined } : row);
    }),
  );
  return upserted;
}

/** Every field the feed sent equals the held one. The records are flat, so `===` compares them;
 *  `droppedAt` is the platform's, never sent, so it is not compared. */
function sameFields(row: Record<string, Value>, held: Record<string, Value>): boolean {
  return Object.keys(row).every((field) => row[field] === held[field]);
}
