import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx } from "../_generated/server";
import { errorMessage, outcomeOf } from "../shared/errors";
import { codesByOpta, namedMen } from "../football/feedIds";
import { fplSeason, readFplBootstrap } from "../football/fpl/fpl";
import { readPlSeasons } from "../football/premierLeague/plSeasons";
import { heldRow, patchRow } from "./playerPositions";
import { warnEveryLeague } from "./positionWarnings";
import { matchSlots, requireFixtureCode, type MatchSlot } from "../football/premierLeague/plMatch";
import { START_WINDOW, type Start } from "./positions";
import { formationPosition, isDrawn, labelPositions } from "./positionTables";
import { PL_FULL_TIME, readPlFixture, readPlFixtures, readPlSquad, type RawPlFixture, type RawPlSquadPlayer } from "../football/premierLeague/premierLeague";
import { positionsSyncFields, startRecord, syncTrigger } from "../schema";
import { inBatches, latestRuns } from "../shared/syncRuns";
import { emailIfFailed } from "../admin/feedFailureEmails";
import { CRON_TRIGGER, scheduleHeartbeat } from "../heartbeats/heartbeat";
import { londonHour } from "../shared/moments";

// Issue #22: each player's starts, from the Premier League's team sheets for last season and this
// (spec/06: his last 38 starts count, across both), and his label, from this season's squads or
// else the sheets (docs/positions.md), and his club number from the squads (#13, `clubNumbers`).
// A match's sheets are read once; the squads every run, so a changed label or number arrives. From the CLI:
// `npx convex run positions/positionsSync:run '{"trigger":"manual"}'`, then `positions/positionsSync:latest`.
// crons.ts runs it daily at 06:00 UK time (#1194), and a cron's run with matches left carries on
// at once; one run by hand stays one run.

/** Matches whose sheets one run reads, one at a time: two seasons' first 450 take three runs, each
 *  well inside an action's ten minutes. */
export const MATCHES_PER_RUN = 150;

/** The UK hour the daily run starts (Craig, 5 Nov 2026, #1194): early, so a weekend's starts count
 *  before the next deadline. */
export const DAILY_RUN_UK_HOUR = 6;

/** The UTC hours crons.ts fires `daily` at: 06:00 UK is one of them in winter and the other in summer. */
export const DAILY_RUN_UTC_HOURS = [DAILY_RUN_UK_HOUR - 1, DAILY_RUN_UK_HOUR] as const;

/** The cron's: starts a run when it is `DAILY_RUN_UK_HOUR` in the UK, and does nothing the hour the
 *  clocks put it at the other. */
export const daily = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (londonHour(Date.now()) === DAILY_RUN_UK_HOUR) {
      await ctx.scheduler.runAfter(0, internal.positions.positionsSync.run, { trigger: CRON_TRIGGER });
    }
    return null;
  },
});

type Synced = Omit<Extract<Infer<typeof positionsSyncFields.outcome>, { ok: true }>, "ok">;
const matchStarts = v.array(v.object({ playerCode: v.number(), start: startRecord }));

/** What the log says, before the error, when a sync fails. */
export const SYNC_FAILED_LOG = "positions sync failed";

export const run = internalAction({
  args: { trigger: syncTrigger },
  returns: v.null(),
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    const outcome: Infer<typeof positionsSyncFields.outcome> = await outcomeOf(SYNC_FAILED_LOG, async () => {
      const synced = await syncPositions(ctx);
      const { unknownFormations, unknownLabels, matchesRefused } = synced;
      if ([unknownFormations, unknownLabels, matchesRefused].some((found) => found.length > 0)) {
        console.error(`positions sync: ${JSON.stringify({ unknownFormations, unknownLabels, matchesRefused })}`);
      }
      return { ok: true as const, ...synced };
    });
    await ctx.runMutation(internal.positions.positionsSync.record, { trigger, ranAt, outcome });
    if (trigger !== CRON_TRIGGER) return null;
    // A run that filed nothing new (every match it read refused) would only read the same again.
    if (outcome.ok && outcome.matchesLeft > 0 && outcome.matchesRead > outcome.matchesRefused.length) {
      await ctx.scheduler.runAfter(0, internal.positions.positionsSync.run, { trigger });
    } else {
      // The cron's last run: the daily sync's heartbeat.
      await scheduleHeartbeat(ctx, "positionsSync");
    }
    return null;
  },
});

/** Of these matches, by FPL fixture code, those whose sheets are not yet read. */
export const unreadMatches = internalQuery({
  args: { fixtureCodes: v.array(v.number()) },
  returns: v.array(v.number()),
  handler: async (ctx, { fixtureCodes }): Promise<number[]> => {
    const read = await Promise.all(
      fixtureCodes.map((fixtureCode) =>
        ctx.db.query("positionSheets").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)).unique(),
      ),
    );
    return fixtureCodes.filter((_, index) => read[index] === null);
  },
});

/** One match's starts, filed on each starter's row, and the match marked read; a match already
 *  read adds nothing. Returns how many starts were added. */
export const recordStarts = internalMutation({
  args: { fixtureCode: v.number(), starts: matchStarts },
  returns: v.number(),
  handler: async (ctx, { fixtureCode, starts }): Promise<number> => {
    const read = await ctx.db.query("positionSheets").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)).unique();
    if (read !== null) return 0;
    for (const { playerCode, start } of starts) {
      const row = await heldRow(ctx, playerCode);
      await patchRow(ctx, row, { starts: withStart(row.starts, start) });
    }
    await ctx.db.insert("positionSheets", { fixtureCode });
    return starts.length;
  },
});

/** Each player's club number as this season's squads give it, null where his squad gives him
 *  none, which takes away the one held (spec/05, Squad numbers). Returns how many changed. */
export const recordClubNumbers = internalMutation({
  args: { numbers: v.array(v.object({ code: v.number(), number: v.union(v.number(), v.null()) })) },
  returns: v.number(),
  handler: async (ctx, { numbers }): Promise<number> => {
    let changed = 0;
    for (const { code, number } of numbers) {
      const held = await ctx.db.query("clubNumbers").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if ((held?.number ?? null) === number) continue;
      if (held === null) await ctx.db.insert("clubNumbers", { code, number: number! });
      else if (number === null) await ctx.db.delete("clubNumbers", held._id);
      else await ctx.db.patch("clubNumbers", held._id, { number });
      changed += 1;
    }
    return changed;
  },
});

/** Each player's label, as the run found it. Returns how many changed. */
export const recordLabels = internalMutation({
  args: { labels: v.array(v.object({ code: v.number(), plLabel: v.string() })) },
  returns: v.number(),
  handler: async (ctx, { labels }): Promise<number> => {
    let changed = 0;
    for (const { code, plLabel } of labels) {
      const row = await heldRow(ctx, code);
      if (row.plLabel === plLabel) continue;
      await patchRow(ctx, row, { plLabel });
      changed += 1;
    }
    return changed;
  },
});

export const record = internalMutation({
  args: positionsSyncFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("positionsSyncs", row);
    await emailIfFailed(ctx, "positions", row);
    // A good sync after a league's deadline moves where its starts are judged: warn of what changed.
    if (row.outcome.ok) await warnEveryLeague(ctx);
    return null;
  },
});

export const latest = latestRuns("positionsSyncs", positionsSyncFields);

/** His newest `START_WINDOW` starts with `start` among them, newest first. */
function withStart(starts: Start[], start: Start): Start[] {
  return [...starts.filter((held) => held.fixtureCode !== start.fixtureCode), start]
    .sort((a, b) => b.kickoff - a.kickoff)
    .slice(0, START_WINDOW);
}

/** Reads the sheets of up to `MATCHES_PER_RUN` played matches not yet read, oldest first, then this
 *  season's squads. A failed read throws, and the matches filed before it stay filed. */
async function syncPositions(ctx: ActionCtx): Promise<Synced> {
  const bootstrap = await readFplBootstrap();
  const codeByOpta = codesByOpta(bootstrap.elements);
  const seasons = await readPlSeasons(fplSeason(bootstrap));
  const [lastSeason, thisSeason] = await Promise.all([readPlFixtures(seasons.last), readPlFixtures(seasons.current)]);
  const played = [...lastSeason, ...thisSeason].filter((fixture) => fixture.status === PL_FULL_TIME);
  const unread = new Set<number>(
    await ctx.runQuery(internal.positions.positionsSync.unreadMatches, { fixtureCodes: played.map(requireFixtureCode) }),
  );
  const toRead = played.filter((fixture) => unread.has(requireFixtureCode(fixture))).sort((a, b) => kickoffOf(a) - kickoffOf(b));
  const found: Found = { labels: new Map(), unmatched: new Set(), unknownFormations: new Set(), matchesRefused: [] };
  let startsAdded = 0;
  for (const listed of toRead.slice(0, MATCHES_PER_RUN)) {
    const starts = matchStartsOf(await readPlFixture(listed.id), codeByOpta, found);
    if (starts !== null) {
      startsAdded += await ctx.runMutation(internal.positions.positionsSync.recordStarts, { fixtureCode: requireFixtureCode(listed), starts });
    }
  }
  // After the sheets, so a squad's label, this season's, wins over a sheet's.
  const clubs = new Set(thisSeason.flatMap((fixture) => (fixture.teams ?? []).map((side) => side.team.id)));
  const clubNumbers = new Map<number, number | null>();
  for (const club of clubs) {
    const { players } = await readPlSquad(club, seasons.current);
    noteLabels(players, codeByOpta, found);
    noteClubNumbers(players, codeByOpta, clubNumbers);
  }
  const rows = [...found.labels].map(([code, plLabel]) => ({ code, plLabel }));
  let labelsChanged = 0;
  for (const labels of inBatches(rows)) {
    labelsChanged += await ctx.runMutation(internal.positions.positionsSync.recordLabels, { labels });
  }
  let clubNumbersChanged = 0;
  for (const numbers of inBatches([...clubNumbers].map(([code, number]) => ({ code, number })))) {
    clubNumbersChanged += await ctx.runMutation(internal.positions.positionsSync.recordClubNumbers, { numbers });
  }
  return {
    matchesRead: Math.min(toRead.length, MATCHES_PER_RUN),
    matchesLeft: Math.max(toRead.length - MATCHES_PER_RUN, 0),
    matchesRefused: found.matchesRefused,
    startsAdded,
    unmatchedPlayers: found.unmatched.size,
    labelsReceived: rows.length,
    labelsChanged,
    clubNumbersChanged,
    unknownFormations: [...found.unknownFormations].sort(),
    unknownLabels: [...new Set(rows.map((row) => row.plLabel))].filter((label) => labelPositions(label) === null).sort(),
  };
}

/** What one run's reads found besides the starts: each man's newest label, by his FPL code; the
 *  men FPL does not list, by the Premier League's id; and what could not be placed or read. */
interface Found {
  labels: Map<number, string>;
  unmatched: Set<number>;
  unknownFormations: Set<string>;
  matchesRefused: string[];
}

/** A played match's starts, each under the starter's FPL code. A match whose sheets do not draw the
 *  men they start (Manchester City's at 128950 drew a substitute) is refused and noted, not filed,
 *  so every run reads it again and reports it until the feed corrects it. */
function matchStartsOf(sheet: RawPlFixture, codeByOpta: ReadonlyMap<string, number>, found: Found) {
  let slots: MatchSlot[];
  try {
    const matched = matchSlots(sheet, codeByOpta);
    slots = matched.slots;
    matched.unmatched.forEach((man) => found.unmatched.add(man.plPlayerId));
  } catch (error: unknown) {
    found.matchesRefused.push(errorMessage(error));
    return null;
  }
  noteLabels(namedMen(sheet), codeByOpta, found);
  const kickoff = kickoffOf(sheet);
  return slots.flatMap((slot) => {
    if (!slot.started) return [];
    if (isDrawn(slot) && formationPosition(slot) === null) found.unknownFormations.add(slot.formation);
    const { playerCode, fixtureCode, formation, line, place } = slot;
    return [{ playerCode, start: { fixtureCode, kickoff, formation, line, place } }];
  });
}

/** Each man's label, the latest noted winning; a man FPL does not list is noted as unmatched. */
function noteLabels(men: RawPlSquadPlayer[], codeByOpta: ReadonlyMap<string, number>, found: Found): void {
  for (const man of men) {
    const code = codeOf(man, codeByOpta);
    const label = man.info?.positionInfo;
    if (code === undefined) found.unmatched.add(man.id);
    else if (label !== undefined) found.labels.set(code, label);
  }
}

/** Each squad man FPL lists, by his FPL code, with his squad number or null; one FPL does not
 *  list is noted as unmatched by noteLabels. */
function noteClubNumbers(men: RawPlSquadPlayer[], codeByOpta: ReadonlyMap<string, number>, numbers: Map<number, number | null>): void {
  for (const man of men) {
    const code = codeOf(man, codeByOpta);
    if (code !== undefined) numbers.set(code, man.info?.shirtNum ?? null);
  }
}

/** His FPL code, or undefined for a man FPL does not list. */
function codeOf(man: RawPlSquadPlayer, codeByOpta: ReadonlyMap<string, number>): number | undefined {
  return man.altIds === undefined ? undefined : codeByOpta.get(man.altIds.opta);
}

function kickoffOf(fixture: RawPlFixture): number {
  const kickoff = fixture.kickoff?.millis;
  if (typeof kickoff !== "number") throw new Error(`played PL fixture ${fixture.id} has no kickoff`);
  return kickoff;
}
