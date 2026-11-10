import { v, type Infer } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalAction, internalMutation, type ActionCtx, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { outcomeOf } from "../../shared/errors";
import { CRON_TRIGGER, withHeartbeat } from "../../heartbeats/heartbeat";
import { emailIfFailed } from "../../admin/feedFailureEmails";
import { clubRecord, fixtureRecord, gameweekRecord, playerRecord, scoreRead, sportmonksSyncFields, syncTrigger, tableWrites } from "../../schema";
import { keyOf, sameFields } from "../footballSync";
import { readSportmonks, SEEDED_COMPETITIONS, sportmonksToken, type SportmonksCompetition } from "./sportmonks";

// Sportmonks' six-hourly read stored (#1391): each competition that is on (#1414), its clubs,
// players, fixtures and rounds, every row naming its competition, and each match's score, on the
// football sync's cron, each into its own table (schema/sportmonks.ts), so nothing the site shows
// changes in this slice. Each competition's run is its own row the feeds page judges, and a failed
// one emails the admin, as every feed's does, so one the plan refuses fails alone. Where the
// deployment has no `SPORTMONKS_API_TOKEN` (the live site) it reads nothing and writes no row.
// The live minute-by-minute reads: sportmonksLive.ts.
// From the CLI: `npx convex run football/sportmonks/sportmonksSync:run '{"trigger":"manual"}'`.

type TableWrites = Required<Infer<typeof tableWrites>>;
type SyncOutcome = Infer<typeof sportmonksSyncFields.outcome>;
type SportmonksTable = "sportmonksClubs" | "sportmonksPlayers" | "sportmonksFixtures" | "sportmonksRounds";
const NO_WRITES: TableWrites = { received: 0, inserted: 0, updated: 0, marked: 0, unmarked: 0 };
/** The most competitions read back: the paid plan's five, with room. */
const COMPETITIONS_MOST = 50;

/** What the log says, before the error, when a run fails. */
export const SPORTMONKS_SYNC_FAILED_LOG = "Sportmonks sync failed";

export const run = internalAction({
  args: { trigger: syncTrigger },
  returns: v.null(),
  handler: async (ctx, { trigger }) => {
    const token = sportmonksToken();
    if (token === null) return null;
    return withHeartbeat(trigger === CRON_TRIGGER ? "sportmonksSync" : null, async () => {
      const competitions = await ctx.runMutation(internal.football.sportmonks.sportmonksSync.competitionsOn, {});
      // One after another, each its own run row: one the plan refuses fails alone.
      for (const competition of competitions) await syncCompetition(ctx, token, competition, trigger);
      return null;
    });
  },
});

/** One competition read and stored, and its run's row. */
async function syncCompetition(ctx: ActionCtx, token: string, competition: number, trigger: Infer<typeof syncTrigger>) {
  const ranAt = Date.now();
  const outcome: SyncOutcome = await outcomeOf(SPORTMONKS_SYNC_FAILED_LOG, async () => {
    const football = await readSportmonks(token, competition);
    const sync = internal.football.sportmonks.sportmonksSync;
    const args = { competition, ranAt };
    // Clubs first, so a player or a match never names a club not yet held.
    const clubs = await ctx.runMutation(sync.syncClubs, { ...args, rows: football.clubs });
    const players = await ctx.runMutation(sync.syncPlayers, { ...args, rows: football.players });
    const rounds = await ctx.runMutation(sync.syncRounds, { ...args, rows: football.gameweeks });
    // A season with no matches yet sent leaves the held ones as they are, none marked.
    const fixtures = football.betweenSeasons ? NO_WRITES : await ctx.runMutation(sync.syncFixtures, { ...args, rows: football.fixtures });
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
  await ctx.runMutation(internal.football.sportmonks.sportmonksSync.record, { competition, trigger, ranAt, outcome });
}

/** The competitions held, or, on a deployment holding none yet, the seeded ones. */
export async function competitionsHeld(ctx: QueryCtx): Promise<SportmonksCompetition[]> {
  const held = await ctx.db.query("sportmonksCompetitions").take(COMPETITIONS_MOST + 1);
  if (held.length > COMPETITIONS_MOST) throw new Error(`More than ${COMPETITIONS_MOST} Sportmonks competitions are held`);
  if (held.length === 0) return [...SEEDED_COMPETITIONS];
  return held.map(({ name, leagueId, on }) => ({ name, leagueId, on }));
}

/** The league ids of the competitions that are on; the list seeded first where none is held. */
export const competitionsOn = internalMutation({
  args: {},
  returns: v.array(v.number()),
  handler: async (ctx) => {
    if ((await ctx.db.query("sportmonksCompetitions").first()) === null) {
      for (const competition of SEEDED_COMPETITIONS) await ctx.db.insert("sportmonksCompetitions", competition);
    }
    return (await competitionsHeld(ctx)).filter(({ on }) => on).map(({ leagueId }) => leagueId);
  },
});

const syncArgs = { competition: v.number(), ranAt: v.number() };

export const syncClubs = internalMutation({
  args: { ...syncArgs, rows: v.array(clubRecord) },
  returns: tableWrites,
  handler: (ctx, { rows, ...run }) => syncRows(ctx, "sportmonksClubs", rows, run),
});

export const syncPlayers = internalMutation({
  args: { ...syncArgs, rows: v.array(playerRecord) },
  returns: tableWrites,
  handler: (ctx, { rows, ...run }) => syncRows(ctx, "sportmonksPlayers", rows, run),
});

export const syncFixtures = internalMutation({
  args: { ...syncArgs, rows: v.array(fixtureRecord) },
  returns: tableWrites,
  handler: (ctx, { rows, ...run }) => syncRows(ctx, "sportmonksFixtures", rows, run),
});

export const syncRounds = internalMutation({
  args: { ...syncArgs, rows: v.array(gameweekRecord) },
  returns: tableWrites,
  handler: (ctx, { rows, ...run }) => syncRows(ctx, "sportmonksRounds", rows, run),
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
    await emailIfFailed(ctx, "sportmonks", row, await competitionNamed(ctx, row.competition));
    return null;
  },
});

/** A competition by its league id, for a failure email's slot and words; null for none given. */
export async function competitionNamed(ctx: QueryCtx, leagueId: number | undefined): Promise<{ competition: number; name: string } | null> {
  if (leagueId === undefined) return null;
  const held = (await competitionsHeld(ctx)).find((each) => each.leagueId === leagueId);
  return { competition: leagueId, name: held?.name ?? `league ${leagueId}` };
}

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

/** A row keyed as footballSync.ts keys its own: Sportmonks' id, or a round's season and number. */
type Keyed = { code: number } | { season: number; number: number };

/** One competition's rows sent upserted by their key, every one naming the competition, and every
 *  held row of it not sent marked dropped at `ranAt`, as footballSync.ts does: kept, never
 *  deleted, and unmarked when sent again. A competition's rows here are at most a season's few
 *  hundred, so one mutation reads them whole. A row held under no competition (read before
 *  #1414) is taken as this one's; a club, man or match held under another competition is moved
 *  to this one, as Sportmonks' ids are one across its leagues. */
async function syncRows<Table extends SportmonksTable>(
  ctx: MutationCtx,
  table: Table,
  sentRows: (WithoutSystemFields<Doc<Table>> & Keyed)[],
  { competition, ranAt }: { competition: number; ranAt: number },
): Promise<TableWrites> {
  // Convex's types can't follow a table union through insert and patch: each row is its table's.
  type Patch = Partial<Doc<Table>>;
  type Held = Doc<Table> & Keyed & { competition?: number };
  const rows = sentRows.map((row) => ({ ...row, competition }));
  const writes: TableWrites = { ...NO_WRITES, received: rows.length };
  const held = new Map<number, Held>();
  for (const of of [competition, undefined]) {
    const rowsOf = ctx.db.query(table).withIndex("by_competition", (q) => q.eq("competition", of as Doc<Table>["competition"]));
    for (const row of (await rowsOf.collect()) as Held[]) held.set(keyOf(row), row);
  }
  const sent = new Set<number>();
  for (const row of rows) {
    const key = keyOf(row);
    sent.add(key);
    const was = held.get(key) ?? (await heldElsewhere(ctx, table, row));
    if (was === null) {
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
    if (sent.has(key)) continue;
    if (was.droppedAt === undefined) writes.marked += 1;
    else if (was.competition === competition) continue;
    await ctx.db.patch(table, was._id as Doc<Table>["_id"], { droppedAt: was.droppedAt ?? ranAt, competition } as unknown as Patch);
  }
  return writes;
}

/** A club, man or match sent for one competition but held under another, by Sportmonks' id; null
 *  for a round, which is keyed within its competition, or for one held nowhere. */
async function heldElsewhere<Table extends SportmonksTable>(ctx: MutationCtx, table: Table, row: Keyed) {
  if (!("code" in row) || table === "sportmonksRounds") return null;
  const coded = table as Exclude<SportmonksTable, "sportmonksRounds">;
  const found = await ctx.db
    .query(coded)
    .withIndex("by_code", (q) => q.eq("code", row.code))
    .first();
  return found as (Doc<Table> & Keyed & { competition?: number }) | null;
}
