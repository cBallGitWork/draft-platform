import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { PL_COMP_SEASON, PL_LAST_COMP_SEASON } from "./football";
import { codesByOpta, namedMen } from "./feedIds";
import { readFplBootstrap } from "./fpl";
import { heldRow } from "./playerPositions";
import { matchSlots, requireFixtureCode, type MatchSlot } from "./plMatch";
import { START_WINDOW, type Start } from "./positions";
import { labelPositions, placePosition } from "./positionTables";
import { readPlFixture, readPlFixtures, readPlSquad, type RawPlFixture, type RawPlSquadPlayer } from "./premierLeague";
import { positionsSyncFields, positionsSyncTrigger, startRecord } from "./schema";

// Issue #22: each player's starts, from the Premier League's team sheets for last season and this,
// and his label, from this season's squads (docs/positions.md). A match's sheets are read once;
// the squads every run, so a changed label arrives. From the CLI:
// `npx convex run positionsSync:run '{"trigger":"manual"}'`, then `positionsSync:latest`.
// Nothing schedules it yet: spec/06 names no cadence.

/** Both seasons a start counts in (spec/06: his last 38 starts, last season's and this). */
const SEASONS = [PL_LAST_COMP_SEASON, PL_COMP_SEASON];
/** The fixture list's `status` for a match played, whose sheets are final. */
const PLAYED = "C";
/** Matches whose sheets one run reads, one read at a time: two seasons' first 450 take three runs,
 *  each well inside an action's ten minutes, and the feed is never asked for two at once. */
export const MATCHES_PER_RUN = 150;
/** Labels per mutation: a season's ~700 players in four. */
const LABELS_PER_BATCH = 200;
const LATEST_RUNS = 5;

type Synced = Omit<Extract<Infer<typeof positionsSyncFields.outcome>, { ok: true }>, "ok">;
const matchStarts = v.array(v.object({ playerCode: v.number(), start: startRecord }));

export const run = internalAction({
  args: { trigger: positionsSyncTrigger },
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    let outcome: Infer<typeof positionsSyncFields.outcome>;
    try {
      const synced = await syncPositions(ctx);
      outcome = { ok: true, ...synced };
      const { unknownFormations, unknownLabels, matchesRefused } = synced;
      if ([unknownFormations, unknownLabels, matchesRefused].some((found) => found.length > 0)) {
        console.error(`positions sync: ${JSON.stringify({ unknownFormations, unknownLabels, matchesRefused })}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`positions sync failed: ${message}`);
      outcome = { ok: false, error: message };
    }
    await ctx.runMutation(internal.positionsSync.record, { trigger, ranAt, outcome });
  },
});

/** Of these matches, by FPL fixture code, those whose sheets are not yet read. */
export const unreadMatches = internalQuery({
  args: { fixtureCodes: v.array(v.number()) },
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
  handler: async (ctx, { fixtureCode, starts }): Promise<number> => {
    const read = await ctx.db.query("positionSheets").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)).unique();
    if (read !== null) return 0;
    for (const { playerCode, start } of starts) {
      const row = await heldRow(ctx, playerCode);
      await ctx.db.patch("playerPositions", row._id, { starts: withStart(row.starts, start) });
    }
    await ctx.db.insert("positionSheets", { fixtureCode });
    return starts.length;
  },
});

/** Each player's label, as the run found it. Returns how many changed. */
export const recordLabels = internalMutation({
  args: { labels: v.array(v.object({ code: v.number(), plLabel: v.string() })) },
  handler: async (ctx, { labels }): Promise<number> => {
    let changed = 0;
    for (const { code, plLabel } of labels) {
      const row = await heldRow(ctx, code);
      if (row.plLabel === plLabel) continue;
      await ctx.db.patch("playerPositions", row._id, { plLabel });
      changed += 1;
    }
    return changed;
  },
});

export const record = internalMutation({
  args: positionsSyncFields,
  handler: async (ctx, row) => {
    await ctx.db.insert("positionsSyncs", row);
  },
});

export const latest = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("positionsSyncs").order("desc").take(LATEST_RUNS),
});

/** His newest `START_WINDOW` starts with `start` among them, newest first. */
function withStart(starts: Start[], start: Start): Start[] {
  return [...starts.filter((held) => held.fixtureCode !== start.fixtureCode), start]
    .sort((a, b) => b.kickoff - a.kickoff)
    .slice(0, START_WINDOW);
}

/** Reads the sheets of up to `MATCHES_PER_RUN` played matches not yet read, oldest first, then this
 *  season's squads. A failed read throws, and the matches filed before it stay filed. */
async function syncPositions(ctx: ActionCtx): Promise<Synced> {
  const codeByOpta = codesByOpta((await readFplBootstrap()).elements);
  const [lastSeason, thisSeason] = await Promise.all(SEASONS.map((season) => readPlFixtures(undefined, season)));
  const played = [...lastSeason, ...thisSeason].filter((fixture) => fixture.status === PLAYED);
  const unread = new Set<number>(
    await ctx.runQuery(internal.positionsSync.unreadMatches, { fixtureCodes: played.map(requireFixtureCode) }),
  );
  const toRead = played.filter((fixture) => unread.has(requireFixtureCode(fixture))).sort((a, b) => kickoffOf(a) - kickoffOf(b));
  const found: Found = { labels: new Map(), unmatched: new Set(), unknownFormations: new Set(), matchesRefused: [] };
  let startsAdded = 0;
  for (const listed of toRead.slice(0, MATCHES_PER_RUN)) {
    const starts = startsOf(await readPlFixture(listed.id), codeByOpta, found);
    if (starts !== null) {
      startsAdded += await ctx.runMutation(internal.positionsSync.recordStarts, { fixtureCode: requireFixtureCode(listed), starts });
    }
  }
  // After the sheets, so a squad's label, this season's, wins over a sheet's.
  const clubs = new Set(thisSeason.flatMap((fixture) => (fixture.teams ?? []).map((side) => side.team.id)));
  for (const club of clubs) noteLabels((await readPlSquad(club)).players, codeByOpta, found);
  const rows = [...found.labels].map(([code, plLabel]) => ({ code, plLabel }));
  let labelsChanged = 0;
  for (let start = 0; start < rows.length; start += LABELS_PER_BATCH) {
    labelsChanged += await ctx.runMutation(internal.positionsSync.recordLabels, { labels: rows.slice(start, start + LABELS_PER_BATCH) });
  }
  return {
    matchesRead: Math.min(toRead.length, MATCHES_PER_RUN),
    matchesLeft: Math.max(toRead.length - MATCHES_PER_RUN, 0),
    matchesRefused: found.matchesRefused,
    startsAdded,
    unmatchedPlayers: found.unmatched.size,
    labelsReceived: rows.length,
    labelsChanged,
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
function startsOf(sheet: RawPlFixture, codeByOpta: ReadonlyMap<string, number>, found: Found) {
  let slots: MatchSlot[];
  try {
    const matched = matchSlots(sheet, codeByOpta);
    slots = matched.slots;
    matched.unmatched.forEach((man) => found.unmatched.add(man.plPlayerId));
  } catch (error: unknown) {
    found.matchesRefused.push(error instanceof Error ? error.message : String(error));
    return null;
  }
  noteLabels(namedMen(sheet), codeByOpta, found);
  const kickoff = kickoffOf(sheet);
  return slots.flatMap(({ started, playerCode, fixtureCode, formation, line, place }) => {
    if (!started) return [];
    if (formation !== null && placePosition(formation, line!, place!) === null) found.unknownFormations.add(formation);
    return [{ playerCode, start: { fixtureCode, kickoff, formation, line, place } }];
  });
}

/** Each man's label, the latest noted winning; a man FPL does not list is noted as unmatched. */
function noteLabels(men: RawPlSquadPlayer[], codeByOpta: ReadonlyMap<string, number>, found: Found): void {
  for (const man of men) {
    const code = man.altIds === undefined ? undefined : codeByOpta.get(man.altIds.opta);
    const label = man.info?.positionInfo;
    if (code === undefined) found.unmatched.add(man.id);
    else if (label !== undefined) found.labels.set(code, label);
  }
}

function kickoffOf(fixture: RawPlFixture): number {
  const kickoff = fixture.kickoff?.millis;
  if (typeof kickoff !== "number") throw new Error(`played PL fixture ${fixture.id} has no kickoff`);
  return kickoff;
}
