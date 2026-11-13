// The positions read (#1419, spec/06): Sportmonks' played Scottish matches' lineups, last season's
// and this, filed once on each starter's row with Sportmonks' label from this season's squads, each
// run a row, and last season's regulars listed for Craig's check (`S06.3`).

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { leagueSeasonsUrl, lineupsUrl, POSITIONS_SQUAD_INCLUDES, scheduleUrl, seasonTeamsUrl, SPORTMONKS_TOKEN_ENV } from "../../../../convex/football/sportmonks/sportmonks";
import { LINEUPS_WAIT_DAYS, NO_STARTERS_GIVEN_UP_LOG, NO_STARTERS_LOG, REGULAR_STARTS } from "../../../../convex/football/sportmonks/sportmonksPositionsSync";
import type { RawFixture } from "../../../../convex/football/sportmonks/sportmonksRaw";
import { DAY_MS } from "../../../../convex/shared/time";
import { CRON_TRIGGER, PING_URL_ENV } from "../../../../convex/heartbeats/heartbeat";
import { freshConvex, pendingJobs, silenceConsoleError, type TestConvex } from "../../../support/convex/test.harness";
import { LINEUPS, sportmonksLineupsMatch } from "../../../support/recorded/sportmonksLineups.payloads";

const TOKEN = "test-token";
const LAST_SEASON = { id: 25000, name: "2025/2026" };
const THIS_SEASON = { id: 25598, name: "2026/2027" };
const NOW = Date.parse("2026-11-10T06:00:00Z");
/** A man in this season's squads who has started nothing: a new signing Sportmonks calls a defender. */
const NEW_SIGNING = 3001;
const KICKOFF = Date.parse("2025-09-01T11:30:00Z");

/** The recorded match, and two more of last season like it a week apart. */
function playedMatches(): RawFixture[] {
  return [0, 1, 2].map((week) => ({ ...sportmonksLineupsMatch(), id: LINEUPS.match + week, starting_at_timestamp: (KICKOFF + week * 7 * DAY_MS) / 1000 }));
}

/** Sportmonks: the league with its seasons, last season's three played matches and one this season
 *  not yet played, each match's lineups, and this season's squads with their positions. */
function fakeSportmonks({ refuse, unfiled }: { refuse?: string; unfiled?: number } = {}) {
  const matches = playedMatches();
  const sent = matches.map((match) => (match.id === unfiled ? { ...match, lineups: [] } : match));
  const listed = (fixture: RawFixture) => ({ id: fixture.id, state_id: fixture.state_id, starting_at: null, starting_at_timestamp: fixture.starting_at_timestamp });
  const upcoming = { id: 19200001, state_id: 1, starting_at: null, starting_at_timestamp: NOW / 1000 + DAY_MS / 1000 };
  const squadMan = (id: number, position: string, detailed: string | null) => ({
    player_id: id,
    player: { id, name: `Player ${id}`, position: { id: 25, name: position }, detailedposition: detailed === null ? null : { id: 148, name: detailed } },
  });
  const bodies: Record<string, unknown> = {
    [leagueSeasonsUrl(501)]: { data: { id: 501, currentseason: THIS_SEASON, seasons: [LAST_SEASON, THIS_SEASON] } },
    [scheduleUrl(LAST_SEASON.id)]: { data: [{ id: 1, rounds: [{ id: 1, name: "1", fixtures: matches.map(listed) }] }] },
    [scheduleUrl(THIS_SEASON.id)]: { data: [{ id: 2, rounds: [{ id: 2, name: "1", fixtures: [upcoming] }] }] },
    [lineupsUrl(matches.map((match) => match.id))]: { data: sent },
    [seasonTeamsUrl(THIS_SEASON.id, 1, POSITIONS_SQUAD_INCLUDES)]: {
      data: [{ id: LINEUPS.celtic, name: "Celtic", short_code: "CEL", players: [squadMan(LINEUPS.celtic433[2], "Defender", "Centre Back"), squadMan(NEW_SIGNING, "Defender", null)] }],
      pagination: { has_more: false },
    },
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>).Authorization).toBe(TOKEN);
    if (url === refuse) return Response.json({ message: "You do not have access to this endpoint." }, { status: 403 });
    if (!(url in bodies)) throw new Error(`no fake for ${url}`);
    return Response.json(bodies[url]);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  vi.stubEnv(SPORTMONKS_TOKEN_ENV, TOKEN);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const runs = (t: TestConvex) => t.run((ctx) => ctx.db.query("sportmonksPositionsSyncs").collect());
const rowOf = (t: TestConvex, playerCode: number) =>
  t.run((ctx) => ctx.db.query("sportmonksPlayerStarts").withIndex("by_playerCode", (q) => q.eq("playerCode", playerCode)).unique());

async function read(t: TestConvex, fake = fakeSportmonks()) {
  vi.stubGlobal("fetch", fake);
  await t.action(internal.football.sportmonks.sportmonksPositionsSync.run, { trigger: "manual" });
  return fake;
}

test("a run files every starter's starts from last season's played matches, each label from this season's squads, and records what it did", async () => {
  const t = freshConvex();
  await read(t);

  const [run] = await runs(t);
  expect(run).toMatchObject({
    trigger: "manual",
    ranAt: NOW,
    outcome: { ok: true, matchesRead: 3, matchesLeft: 0, startsAdded: 66, labelsReceived: 2, labelsChanged: 2, unknownFormations: [], unknownLabels: [] },
  });
  const cb = await rowOf(t, LINEUPS.celtic433[2]);
  expect(cb?.label).toBe("Centre Back");
  expect(cb?.starts.map((each) => [each.fixtureCode, each.season, each.formation, each.line, each.place])).toEqual([
    [LINEUPS.match + 2, 2025, "4-3-3", 1, 1],
    [LINEUPS.match + 1, 2025, "4-3-3", 1, 1],
    [LINEUPS.match, 2025, "4-3-3", 1, 1],
  ]);
  expect(await rowOf(t, LINEUPS.celticBench)).toBeNull();
  expect(await rowOf(t, NEW_SIGNING)).toMatchObject({ label: "Defender", starts: [] });
});

test("a run again reads no match it has filed, and adds nothing", async () => {
  const t = freshConvex();
  await read(t);
  const fake = await read(t);

  expect(fake.mock.calls.map(([url]) => url)).not.toContain(lineupsUrl(playedMatches().map((match) => match.id)));
  const [, again] = await runs(t);
  expect(again.outcome).toMatchObject({ ok: true, matchesRead: 0, startsAdded: 0, labelsChanged: 0 });
  expect((await rowOf(t, LINEUPS.celtic433[2]))?.starts).toHaveLength(3);
});

const lineupsRead = (t: TestConvex) => t.run(async (ctx) => (await ctx.db.query("sportmonksLineupsRead").collect()).map((each) => each.fixtureCode).sort());

test("a played match whose lineups come back with no starters is logged and left to read again", async () => {
  vi.setSystemTime(KICKOFF + (LINEUPS_WAIT_DAYS - 1) * DAY_MS);
  const t = freshConvex();
  const logged = silenceConsoleError();
  await read(t, fakeSportmonks({ unfiled: LINEUPS.match }));

  expect(logged).toHaveBeenCalledWith(`${NO_STARTERS_LOG}: ${LINEUPS.match}`);
  expect(await lineupsRead(t)).toEqual([LINEUPS.match + 1, LINEUPS.match + 2]);
  expect((await rowOf(t, LINEUPS.celtic433[2]))?.starts).toHaveLength(2);
});

test("a played match still with no starters a week after kickoff, such as an awarded one, is marked read with none and logged once", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  await read(t, fakeSportmonks({ unfiled: LINEUPS.match }));

  expect(logged).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledWith(`${NO_STARTERS_GIVEN_UP_LOG}: ${LINEUPS.match}`);
  expect(await lineupsRead(t)).toEqual([LINEUPS.match, LINEUPS.match + 1, LINEUPS.match + 2]);
  expect((await rowOf(t, LINEUPS.celtic433[2]))?.starts).toHaveLength(2);

  const fake = await read(t, fakeSportmonks({ unfiled: LINEUPS.match }));
  expect(fake.mock.calls.map(([url]) => url)).not.toContain(lineupsUrl(playedMatches().map((match) => match.id)));
  expect(logged).toHaveBeenCalledTimes(1);
  const [, again] = await runs(t);
  expect(again.outcome).toMatchObject({ ok: true, matchesRead: 0, matchesLeft: 0 });
});

test("a refused read is a failed run on record, and nothing is filed", async () => {
  const t = freshConvex();
  silenceConsoleError();
  await read(t, fakeSportmonks({ refuse: lineupsUrl(playedMatches().map((match) => match.id)) }));

  const [run] = await runs(t);
  expect(run.outcome).toMatchObject({ ok: false, error: expect.stringContaining("answered 403") });
  expect(await t.run((ctx) => ctx.db.query("sportmonksLineupsRead").collect())).toEqual([]);
});

// The daily read's heartbeat (#1554): pinged once the cron's last run is done, never by hand.
test("the cron's run that leaves no match to read schedules the heartbeat; a run by hand none", async () => {
  vi.stubEnv(PING_URL_ENV, "https://hc-ping.com/ping-key");
  const beat = internal.heartbeats.heartbeat.beat;
  const byHand = freshConvex();
  await read(byHand);
  expect(await pendingJobs(byHand, beat)).toEqual([]);

  const t = freshConvex();
  vi.stubGlobal("fetch", fakeSportmonks());
  await t.action(internal.football.sportmonks.sportmonksPositionsSync.run, { trigger: CRON_TRIGGER });
  expect((await pendingJobs(t, beat)).map((job) => job.args)).toEqual([[{ check: "sportmonksPositions" }]]);
});

test("where the deployment has no token, a run reads nothing and writes no row", async () => {
  vi.stubEnv(SPORTMONKS_TOKEN_ENV, "");
  const t = freshConvex();
  const fake = await read(t);

  expect(fake).not.toHaveBeenCalled();
  expect(await runs(t)).toEqual([]);
});

test("last season's regulars list each man with enough starts, his club and his positions, for Craig's check", async () => {
  const t = freshConvex();
  await read(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("sportmonksClubs", { code: LINEUPS.rangers, name: "Rangers", shortName: "RAN" });
    await ctx.db.insert("sportmonksPlayers", { code: LINEUPS.rangers4231[5], name: "Raskin", fullName: "Nicolas Raskin", clubCode: LINEUPS.rangers });
    const row = await ctx.db.query("sportmonksPlayerStarts").withIndex("by_playerCode", (q) => q.eq("playerCode", LINEUPS.rangers4231[5])).unique();
    const [first] = row!.starts;
    const starts = Array.from({ length: REGULAR_STARTS }, (_, n) => ({ ...first, fixtureCode: n, kickoff: KICKOFF + n * DAY_MS }));
    await ctx.db.patch("sportmonksPlayerStarts", row!._id, { starts });
  });

  const regulars = await t.query(internal.football.sportmonks.sportmonksPositionsSync.regulars, { season: 2025 });
  expect(regulars).toEqual([{ playerCode: LINEUPS.rangers4231[5], name: "Raskin", club: "Rangers", starts: REGULAR_STARTS, positions: ["CDM"], label: null }]);
});
