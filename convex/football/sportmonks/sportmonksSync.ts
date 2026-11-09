import { v, type Infer } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { outcomeOf } from "../../shared/errors";
import { CRON_TRIGGER, withHeartbeat } from "../../heartbeats/heartbeat";
import { emailIfFailed } from "../../admin/feedFailureEmails";
import { clubRecord, fixtureRecord, gameweekRecord, playerRecord, scoreRead, sportmonksSyncFields, syncTrigger, tableWrites } from "../../schema";
import { sameFields } from "../footballSync";
import { readSportmonks, sportmonksToken } from "./sportmonks";

// Sportmonks' six-hourly read stored (#1391): the Scottish Premiership's clubs, players, fixtures
// and rounds, and each match's score, on the football sync's cron, each into its own table
// (schema/sportmonks.ts), so nothing the site shows changes in this slice. Each run is a row the
// feeds page judges, and a failed one emails the admin, as every feed's does. Where the
// deployment has no `SPORTMONKS_API_TOKEN` (the live site) it reads nothing and writes no row.
// The live minute-by-minute reads: sportmonksLive.ts.
// From the CLI: `npx convex run football/sportmonks/sportmonksSync:run '{"trigger":"manual"}'`.

type TableWrites = Required<Infer<typeof tableWrites>>;
type SyncOutcome = Infer<typeof sportmonksSyncFields.outcome>;
type SportmonksTable = "sportmonksClubs" | "sportmonksPlayers" | "sportmonksFixtures" | "sportmonksRounds";
/** A round's key's step a season, past any round number, as footballSync.ts's gameweeks. */
const SEASON_KEY_STEP = 100;
const NO_WRITES: TableWrites = { received: 0, inserted: 0, updated: 0, marked: 0, unmarked: 0 };

/** What the log says, before the error, when a run fails. */
export const SPORTMONKS_SYNC_FAILED_LOG = "Sportmonks sync failed";

export const run = internalAction({
  args: { trigger: syncTrigger },
  returns: v.null(),
  handler: async (ctx, { trigger }) => {
    const token = sportmonksToken();
    if (token === null) return null;
    return withHeartbeat(trigger === CRON_TRIGGER ? "sportmonksSync" : null, async () => {
      const ranAt = Date.now();
      const outcome: SyncOutcome = await outcomeOf(SPORTMONKS_SYNC_FAILED_LOG, async () => {
        const football = await readSportmonks(token);
        const sync = internal.football.sportmonks.sportmonksSync;
        // Clubs first, so a player or a match never names a club not yet held.
        const clubs = await ctx.runMutation(sync.syncClubs, { rows: football.clubs, ranAt });
        const players = await ctx.runMutation(sync.syncPlayers, { rows: football.players, ranAt });
        const rounds = await ctx.runMutation(sync.syncRounds, { rows: football.gameweeks, ranAt });
        // A season with no matches yet sent leaves the held ones as they are, none marked.
        const fixtures = football.betweenSeasons ? NO_WRITES : await ctx.runMutation(sync.syncFixtures, { rows: football.fixtures, ranAt });
        const { reads, problems } = football.scores;
        const written = await ctx.runMutation(sync.writeScores, { reads, readAt: ranAt });
        return {
          ok: true as const,
          clubs,
          players,
          fixtures,
          rounds,
          ...(football.betweenSeasons && { betweenSeasons: true as const }),
          scores: { received: reads.length + problems.length, written, problems },
        };
      });
      await ctx.runMutation(internal.football.sportmonks.sportmonksSync.record, { trigger, ranAt, outcome });
      return null;
    });
  },
});

export const syncClubs = internalMutation({
  args: { rows: v.array(clubRecord), ranAt: v.number() },
  returns: tableWrites,
  handler: (ctx, { rows, ranAt }) => syncRows(ctx, "sportmonksClubs", rows, ranAt),
});

export const syncPlayers = internalMutation({
  args: { rows: v.array(playerRecord), ranAt: v.number() },
  returns: tableWrites,
  handler: (ctx, { rows, ranAt }) => syncRows(ctx, "sportmonksPlayers", rows, ranAt),
});

export const syncFixtures = internalMutation({
  args: { rows: v.array(fixtureRecord), ranAt: v.number() },
  returns: tableWrites,
  handler: (ctx, { rows, ranAt }) => syncRows(ctx, "sportmonksFixtures", rows, ranAt),
});

export const syncRounds = internalMutation({
  args: { rows: v.array(gameweekRecord), ranAt: v.number() },
  returns: tableWrites,
  handler: (ctx, { rows, ranAt }) => syncRows(ctx, "sportmonksRounds", rows, ranAt),
});

/** Each read written over the match's held score; returns how many rows changed. */
export const writeScores = internalMutation({
  args: { reads: v.array(scoreRead), readAt: v.number() },
  returns: v.number(),
  handler: async (ctx, { reads, readAt }) => {
    const written = await Promise.all(reads.map((read) => writeScore(ctx, read, readAt)));
    return written.filter(Boolean).length;
  },
});

export const record = internalMutation({
  args: sportmonksSyncFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("sportmonksSyncs", row);
    await emailIfFailed(ctx, "sportmonks", row);
    return null;
  },
});

/** A match's held score, or null before any read gave one. */
export function scoreOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"sportmonksScores"> | null> {
  return ctx.db
    .query("sportmonksScores")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** One read over the match's held score; false when it changed nothing. The newest read wins:
 *  Sportmonks is the only feed writing these. */
export async function writeScore(ctx: MutationCtx, read: Infer<typeof scoreRead>, readAt: number): Promise<boolean> {
  const held = await scoreOf(ctx, read.fixtureCode);
  if (held === null) {
    await ctx.db.insert("sportmonksScores", { ...read, readAt });
    return true;
  }
  if (sameFields(read, held)) return false;
  await ctx.db.patch("sportmonksScores", held._id, { ...read, readAt });
  return true;
}

type Keyed = { code: number } | { season: number; number: number };

/** A row's stable key: Sportmonks' id, or a round's season and number. */
function keyOf(row: Keyed): number {
  return "code" in row ? row.code : row.season * SEASON_KEY_STEP + row.number;
}

/** Every row sent upserted by its key, and every held row not sent marked dropped at `ranAt`, as
 *  footballSync.ts does: kept, never deleted, and unmarked when sent again. A table here holds at
 *  most a season's few hundred rows, so one mutation reads it whole. */
async function syncRows<Table extends SportmonksTable>(
  ctx: MutationCtx,
  table: Table,
  rows: (WithoutSystemFields<Doc<Table>> & Keyed)[],
  ranAt: number,
): Promise<TableWrites> {
  // Convex's types can't follow a table union through insert and patch: each row is its table's.
  type Patch = Partial<Doc<Table>>;
  const writes: TableWrites = { ...NO_WRITES, received: rows.length };
  const held = new Map<number, Doc<Table> & Keyed>();
  for (const row of (await ctx.db.query(table).collect()) as (Doc<Table> & Keyed)[]) held.set(keyOf(row), row);
  const sent = new Set<number>();
  for (const row of rows) {
    const key = keyOf(row);
    sent.add(key);
    const was = held.get(key);
    if (was === undefined) {
      await ctx.db.insert(table, row);
      writes.inserted += 1;
      continue;
    }
    const changed = !sameFields(row, was);
    const sentAgain = was.droppedAt !== undefined;
    if (changed) writes.updated += 1;
    if (sentAgain) writes.unmarked += 1;
    // `droppedAt: undefined` removes the mark (Convex drops a field patched to undefined).
    if (changed || sentAgain) await ctx.db.patch(table, was._id as Doc<Table>["_id"], { ...row, droppedAt: undefined } as Patch);
  }
  for (const [key, was] of held) {
    if (sent.has(key) || was.droppedAt !== undefined) continue;
    await ctx.db.patch(table, was._id as Doc<Table>["_id"], { droppedAt: ranAt } as unknown as Patch);
    writes.marked += 1;
  }
  return writes;
}
