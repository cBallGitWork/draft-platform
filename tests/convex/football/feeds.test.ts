import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import {
  FPL_BOOTSTRAP_URL,
  PL_SEASON_IDS_STALE,
  PL_SEASON_IDS_STALE_FROM,
  plCommentaryUrl,
  plFixtureUrl,
  plTeamStatsUrl,
} from "../../../convex/football/football";
import type { RawPlFixture } from "../../../convex/football/premierLeague";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedSheets,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "../../support/recorded/commentary.payloads";
import { freshConvex, silenceConsoleError } from "../../support/convex/test.harness";
import { MINUTE_MS } from "../../../convex/shared/time";

/** Answers each feed as it answered on 17 Oct 2026, cut down; `refuse` makes URLs containing it answer 403. */
function fakeFeeds(refuse?: string) {
  return vi.fn(async (url: string) => {
    if (refuse !== undefined && url.includes(refuse)) return new Response("Forbidden", { status: 403 });
    if (url === FPL_BOOTSTRAP_URL) return Response.json({ elements: [{}, {}, {}] });
    if (url.includes("/staff")) {
      return Response.json({ players: [{ id: 1, info: { shirtNum: 1 } }, { id: 2, info: { shirtNum: 7 } }] });
    }
    if (url.includes("/fixtures")) return Response.json({ content: [{}, {}] });
    throw new Error(`no fake for ${url}`);
  });
}

beforeEach(() => vi.useFakeTimers());

test("a check scheduled for later runs only when its time comes, and records each read of both feeds", async () => {
  vi.stubGlobal("fetch", fakeFeeds());
  const t = freshConvex();

  const start = Date.now();
  await t.mutation(internal.football.feeds.checkLater, { minutes: 10 });
  vi.advanceTimersByTime(9 * MINUTE_MS);
  await t.finishInProgressScheduledFunctions();
  expect(await t.query(internal.football.feeds.latest, {})).toEqual([]);

  vi.advanceTimersByTime(MINUTE_MS);
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [row] = await t.query(internal.football.feeds.latest, {});
  expect(row).toMatchObject({
    trigger: "timer",
    scheduledFor: start + 10 * MINUTE_MS,
    ranAt: start + 10 * MINUTE_MS,
    fplPlayers: { ok: true, count: 3 },
    plFixtures: { ok: true, count: 2 },
    arsenalSquadNumbers: { ok: true, count: 2 },
  });
});

test("a feed that refuses is recorded with its status, and the other feed still counts", async () => {
  vi.stubGlobal("fetch", fakeFeeds("pulselive"));
  silenceConsoleError();
  const t = freshConvex();

  await t.action(internal.football.feeds.check, { trigger: "manual" });

  const [row] = await t.query(internal.football.feeds.latest, {});
  expect(row.fplPlayers).toEqual({ ok: true, count: 3 });
  expect(row.plFixtures).toMatchObject({ ok: false, error: expect.stringContaining("answered 403") });
  expect(row.arsenalSquadNumbers).toMatchObject({ ok: false });
});

test("once the season ids are out of date, both Premier League reads are recorded as failing, saying so (#201)", async () => {
  vi.stubGlobal("fetch", fakeFeeds());
  const logged = silenceConsoleError();
  vi.setSystemTime(PL_SEASON_IDS_STALE_FROM);
  const t = freshConvex();

  await t.action(internal.football.feeds.check, { trigger: "manual" });

  const [row] = await t.query(internal.football.feeds.latest, {});
  expect(row.fplPlayers).toEqual({ ok: true, count: 3 });
  expect(row.plFixtures).toEqual({ ok: false, error: PL_SEASON_IDS_STALE });
  expect(row.arsenalSquadNumbers).toEqual({ ok: false, error: PL_SEASON_IDS_STALE });
  expect(logged).toHaveBeenCalledWith(`feed check failed: ${PL_SEASON_IDS_STALE}`);
});

/** Serves a match's commentary, fixture and team stats as recorded; any other URL answers 404. */
function serveMatch(match: number, sheets: RawPlFixture) {
  const bodies: Record<string, unknown> = {
    [plCommentaryUrl(match)]: recordedCommentary(match),
    [plFixtureUrl(match)]: sheets,
    [plTeamStatsUrl(match)]: recordedTeamStats(match),
  };
  const fetch = vi.fn(async (url: string) => (url in bodies ? Response.json(bodies[url]) : new Response("", { status: 404 })));
  vi.stubGlobal("fetch", fetch);
  return { fetch, urls: Object.keys(bodies) };
}

test("the commentary check reads a match's stream, sheets and team stats in turn, and says what came", async () => {
  const match = COMMENTARY_MATCH.brentfordLiverpool;
  const { fetch, urls } = serveMatch(match, recordedSheets(match));
  const t = freshConvex();

  const report = await t.action(internal.football.feeds.commentaryCheck, { plFixtureId: match });

  expect(report).toEqual({
    readAt: new Date().toISOString(),
    lines: 122,
    newest: { id: 2867014, minuteLabel: "01", text: "Match ends, Brentford 1, Liverpool 2." },
    namedMen: 40,
    teamStats: true,
  });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(urls);
});

test("the commentary check before kickoff says no lines, no named men and no team stats yet", async () => {
  // Ipswich v Forest as recorded three days before: an empty stream, team stats with no `data`.
  serveMatch(UPCOMING_MATCH, { id: UPCOMING_MATCH, teamLists: [null, null] });
  const t = freshConvex();

  const report = await t.action(internal.football.feeds.commentaryCheck, { plFixtureId: UPCOMING_MATCH });

  expect(report).toEqual({ readAt: new Date().toISOString(), lines: 0, newest: null, namedMen: 0, teamStats: false });
});

test("a commentary check whose read is refused throws, naming the URL", async () => {
  vi.stubGlobal("fetch", fakeFeeds("textstream"));
  const t = freshConvex();

  await expect(t.action(internal.football.feeds.commentaryCheck, { plFixtureId: UPCOMING_MATCH })).rejects.toThrow(
    `${plCommentaryUrl(UPCOMING_MATCH)} answered 403`,
  );
});
