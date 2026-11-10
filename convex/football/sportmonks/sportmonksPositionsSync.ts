import { v, type Infer } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction, internalMutation, internalQuery, type ActionCtx } from "../../_generated/server";
import { outcomeOf } from "../../shared/errors";
import { emailIfFailed } from "../../admin/feedFailureEmails";
import { CRON_TRIGGER } from "../../heartbeats/heartbeat";
import { londonHour } from "../../shared/moments";
import { BATCH_SIZE, LATEST_RUNS } from "../../shared/syncRuns";
import { DAILY_RUN_UK_HOUR } from "../../positions/positionsSync";
import { positionsFromStarts, START_WINDOW } from "../../positions/positions";
import { position, sportmonksPositionsSyncFields, sportmonksStart, syncTrigger } from "../../schema";
import { getData, kickoffOf, leagueSeasonsUrl, lineupsUrl, MULTI_FIXTURES_MAX, POSITIONS_SQUAD_INCLUDES, readSeasonTeams, scheduleUrl, seasonStart, sportmonksToken } from "./sportmonks";
import { isFullTime } from "./sportmonksMatch";
import { labelOf, labelPositions, matchStarts, sportmonksPositionsOf, type SportmonksStart } from "./sportmonksPositions";
import { SPORTMONKS, type RawFixture, type RawLeague, type RawSeason, type RawStage } from "./sportmonksRaw";

// The positions read (#1419, spec/06): each man's starts from the Scottish Premiership's played
// matches, last season's and this, from Sportmonks' lineups, and Sportmonks' label for him from
// this season's squads, each on his row in `sportmonksPlayerStarts`, keyed on his Sportmonks id.
// A match's lineups are filed once. Kept on the Sportmonks side: #1427 makes the site read them.
// Daily at the positions sync's 06:00 UK time, and a cron's run with matches left carries on at
// once. Where the deployment has no `SPORTMONKS_API_TOKEN` it reads nothing and writes no row.
// From the CLI: `npx convex run football/sportmonks/sportmonksPositionsSync:run '{"trigger":"manual"}'`,
// then `football/sportmonks/sportmonksPositionsSync:regulars '{"season":2025}'` for Craig's check (`S06.3`).

/** Played matches whose lineups one run reads: two Scottish seasons' 456 take two runs of ten
 *  `fixtures/multi` calls each. */
export const MATCHES_PER_RUN = 250;

/** Starts in a season that make a man one of its regulars for Craig's check (`S06.3`): half a
 *  Scottish Premiership side's 38 league matches. */
export const REGULAR_STARTS = 19;

/** What the log says, before the error, when a run fails. */
export const SPORTMONKS_POSITIONS_FAILED_LOG = "Sportmonks positions read failed";

/** What the log says, before the matches' ids, when played matches came back with no starters. */
export const NO_STARTERS_LOG = "Sportmonks positions: played matches with no starters yet, left to read again";

type Synced = Omit<Extract<Infer<typeof sportmonksPositionsSyncFields.outcome>, { ok: true }>, "ok">;
const filedMatch = v.object({ fixtureCode: v.number(), starts: v.array(v.object({ playerCode: v.number(), start: sportmonksStart })) });

/** The cron's: starts a run at `DAILY_RUN_UK_HOUR` in the UK, as positionsSync.ts's `daily` does. */
export const daily = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (londonHour(Date.now()) === DAILY_RUN_UK_HOUR) {
      await ctx.scheduler.runAfter(0, internal.football.sportmonks.sportmonksPositionsSync.run, { trigger: CRON_TRIGGER });
    }
    return null;
  },
});

export const run = internalAction({
  args: { trigger: syncTrigger },
  returns: v.null(),
  handler: async (ctx, { trigger }) => {
    const token = sportmonksToken();
    if (token === null) return null;
    const ranAt = Date.now();
    const outcome = await outcomeOf(SPORTMONKS_POSITIONS_FAILED_LOG, async () => ({ ok: true as const, ...(await readPositions(ctx, token)) }));
    if (outcome.ok && [outcome.unknownFormations, outcome.unknownLabels].some((found) => found.length > 0)) {
      console.error(`Sportmonks positions: ${JSON.stringify({ unknownFormations: outcome.unknownFormations, unknownLabels: outcome.unknownLabels })}`);
    }
    await ctx.runMutation(internal.football.sportmonks.sportmonksPositionsSync.record, { trigger, ranAt, outcome });
    if (trigger === CRON_TRIGGER && outcome.ok && outcome.matchesLeft > 0) {
      await ctx.scheduler.runAfter(0, internal.football.sportmonks.sportmonksPositionsSync.run, { trigger });
    }
    return null;
  },
});

/** Of these matches, those whose lineups are not yet filed. */
export const unreadMatches = internalQuery({
  args: { fixtureCodes: v.array(v.number()) },
  returns: v.array(v.number()),
  handler: async (ctx, { fixtureCodes }): Promise<number[]> => {
    const read = await Promise.all(
      fixtureCodes.map((fixtureCode) => ctx.db.query("sportmonksLineupsRead").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)).unique()),
    );
    return fixtureCodes.filter((_, index) => read[index] === null);
  },
});

/** Each match's starts filed on each starter's row, and the match marked read; a match already
 *  read adds nothing. Returns how many starts were added. */
export const recordStarts = internalMutation({
  args: { matches: v.array(filedMatch) },
  returns: v.number(),
  handler: async (ctx, { matches }): Promise<number> => {
    let added = 0;
    for (const { fixtureCode, starts } of matches) {
      const read = await ctx.db.query("sportmonksLineupsRead").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)).unique();
      if (read !== null) continue;
      for (const { playerCode, start } of starts) {
        const row = await ctx.db.query("sportmonksPlayerStarts").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)).unique();
        if (row === null) await ctx.db.insert("sportmonksPlayerStarts", { playerCode, starts: [start] });
        else await ctx.db.patch("sportmonksPlayerStarts", row._id, { starts: withStart(row.starts, start) });
      }
      await ctx.db.insert("sportmonksLineupsRead", { fixtureCode });
      added += starts.length;
    }
    return added;
  },
});

/** Each man's label as this season's squads give it. Returns how many changed. */
export const recordLabels = internalMutation({
  args: { labels: v.array(v.object({ playerCode: v.number(), label: v.string() })) },
  returns: v.number(),
  handler: async (ctx, { labels }): Promise<number> => {
    let changed = 0;
    for (const { playerCode, label } of labels) {
      const row = await ctx.db.query("sportmonksPlayerStarts").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)).unique();
      if (row?.label === label) continue;
      if (row === null) await ctx.db.insert("sportmonksPlayerStarts", { playerCode, label, starts: [] });
      else await ctx.db.patch("sportmonksPlayerStarts", row._id, { label });
      changed += 1;
    }
    return changed;
  },
});

export const record = internalMutation({
  args: sportmonksPositionsSyncFields,
  returns: v.null(),
  handler: async (ctx, row) => {
    await ctx.db.insert("sportmonksPositionsSyncs", row);
    await emailIfFailed(ctx, "sportmonksPositions", row);
    return null;
  },
});

export const latest = internalQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("sportmonksPositionsSyncs"), _creationTime: v.number(), ...sportmonksPositionsSyncFields })),
  handler: async (ctx) => ctx.db.query("sportmonksPositionsSyncs").order("desc").take(LATEST_RUNS),
});

/** A season's regulars, for Craig's check of the table (`S06.3`): each man with `REGULAR_STARTS`
 *  or more starts that season, his club now, his starts that season, and the positions his starts
 *  give him, club by club. The whole table is read: a few hundred rows. */
export const regulars = internalQuery({
  args: { season: v.number() },
  returns: v.array(
    v.object({ playerCode: v.number(), name: v.string(), club: v.string(), starts: v.number(), positions: v.array(position), label: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { season }) => {
    const rows = await ctx.db.query("sportmonksPlayerStarts").collect();
    const found = [];
    for (const row of rows) {
      const starts = row.starts.filter((start) => start.season === season).length;
      if (starts < REGULAR_STARTS) continue;
      const player = await ctx.db.query("sportmonksPlayers").withIndex("by_code", (q) => q.eq("code", row.playerCode)).unique();
      const club = player === null ? null : await ctx.db.query("sportmonksClubs").withIndex("by_code", (q) => q.eq("code", player.clubCode)).unique();
      const { positions } = sportmonksPositionsOf(row.starts, row.label ?? null);
      found.push({
        playerCode: row.playerCode,
        name: player?.name ?? `${SPORTMONKS} player ${row.playerCode}`,
        club: club?.name ?? "no club held",
        starts,
        positions: positions.map((each) => each.position),
        label: row.label ?? null,
      });
    }
    return found.sort((a, b) => a.club.localeCompare(b.club) || b.starts - a.starts || a.name.localeCompare(b.name));
  },
});

/** His newest `START_WINDOW` starts with `start` among them, newest first. */
function withStart(starts: SportmonksStart[], start: SportmonksStart): SportmonksStart[] {
  return [...starts.filter((held) => held.fixtureCode !== start.fixtureCode), start].sort((a, b) => b.kickoff - a.kickoff).slice(0, START_WINDOW);
}

/** Last season and this, oldest first, of the league's seasons; this season alone where
 *  Sportmonks lists none before it. */
function twoSeasons(league: RawLeague): RawSeason[] {
  const current = league.currentseason;
  if (!current) throw new Error(`${SPORTMONKS} sent no current season`);
  const before = (league.seasons ?? []).find((season) => seasonStart(season) === seasonStart(current) - 1);
  return before === undefined ? [current] : [before, current];
}

/** Reads the lineups of up to `MATCHES_PER_RUN` played matches not yet filed, oldest first, then
 *  this season's squads for each man's label. A failed read throws, and the matches filed before
 *  it stay filed. */
async function readPositions(ctx: ActionCtx, token: string): Promise<Synced> {
  const { data: league } = await getData<RawLeague>(leagueSeasonsUrl(), token);
  const seasons = twoSeasons(league);
  const seasonOf = new Map<number, number>();
  const played: { id: number; kickoff: number }[] = [];
  for (const season of seasons) {
    const { data: stages } = await getData<RawStage[]>(scheduleUrl(season.id), token);
    for (const match of stages.flatMap((stage) => stage.rounds ?? []).flatMap((round) => round.fixtures ?? [])) {
      if (!isFullTime(match.state_id)) continue;
      seasonOf.set(match.id, seasonStart(season));
      played.push({ id: match.id, kickoff: kickoffOf(match) ?? 0 });
    }
  }
  const unread = new Set(await ctx.runQuery(internal.football.sportmonks.sportmonksPositionsSync.unreadMatches, { fixtureCodes: played.map((match) => match.id) }));
  const toRead = played.filter((match) => unread.has(match.id)).sort((a, b) => a.kickoff - b.kickoff);
  const reading = toRead.slice(0, MATCHES_PER_RUN).map((match) => match.id);
  const unknownFormations = new Set<string>();
  let startsAdded = 0;
  for (let at = 0; at < reading.length; at += MULTI_FIXTURES_MAX) {
    const { data: matches } = await getData<RawFixture[]>(lineupsUrl(reading.slice(at, at + MULTI_FIXTURES_MAX)), token);
    const read = matches.map((match) => ({ fixtureCode: match.id, starts: matchStarts(match, seasonOf.get(match.id)!) }));
    // A played match with no starters is Sportmonks not yet filing its lineups: left unread, so a
    // later run reads it again, and logged.
    const empty = read.filter(({ starts }) => starts.length === 0).map(({ fixtureCode }) => fixtureCode);
    if (empty.length > 0) console.error(`${NO_STARTERS_LOG}: ${empty.join(", ")}`);
    const filed = read.filter(({ starts }) => starts.length > 0);
    for (const { starts } of filed) positionsFromStarts(starts.map((each) => each.start)).unknownFormations.forEach((formation) => unknownFormations.add(formation));
    startsAdded += await ctx.runMutation(internal.football.sportmonks.sportmonksPositionsSync.recordStarts, { matches: filed });
  }
  const labels = new Map<number, string>();
  for (const team of await readSeasonTeams(seasons[seasons.length - 1].id, token, POSITIONS_SQUAD_INCLUDES)) {
    for (const man of team.players ?? []) {
      const label = man.player ? labelOf(man.player) : null;
      if (label !== null) labels.set(man.player_id, label);
    }
  }
  const rows = [...labels].map(([playerCode, label]) => ({ playerCode, label }));
  let labelsChanged = 0;
  for (let at = 0; at < rows.length; at += BATCH_SIZE) {
    labelsChanged += await ctx.runMutation(internal.football.sportmonks.sportmonksPositionsSync.recordLabels, { labels: rows.slice(at, at + BATCH_SIZE) });
  }
  return {
    matchesRead: reading.length,
    matchesLeft: toRead.length - reading.length,
    startsAdded,
    labelsReceived: rows.length,
    labelsChanged,
    unknownFormations: [...unknownFormations].sort(),
    unknownLabels: [...new Set(labels.values())].filter((label) => labelPositions(label) === null).sort(),
  };
}
