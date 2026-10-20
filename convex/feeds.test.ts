/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { MINUTE_MS } from "./feeds";
import { plCommentaryUrl, plFixtureUrl, plTeamStatsUrl, squadNumbers } from "./football";
import {
  COMMENTARY_MATCH,
  recordedCommentary,
  recordedSheets,
  recordedTeamStats,
  UPCOMING_MATCH,
} from "./recorded/commentary.payloads";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/** Answers each feed as it answered on 17 Oct 2026, cut down; `refuse` makes URLs containing it answer 403. */
function fakeFeeds(refuse?: string) {
  return vi.fn(async (url: string) => {
    if (refuse !== undefined && url.includes(refuse)) return new Response("Forbidden", { status: 403 });
    if (url.includes("bootstrap-static")) return Response.json({ elements: [{}, {}, {}] });
    if (url.includes("/staff")) {
      return Response.json({ players: [{ id: 1, info: { shirtNum: 1 } }, { id: 2, info: { shirtNum: 7 } }] });
    }
    if (url.includes("/fixtures")) return Response.json({ content: [{}, {}] });
    throw new Error(`no fake for ${url}`);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("a check scheduled for later runs only when its time comes, and records both feeds", async () => {
  vi.stubGlobal("fetch", fakeFeeds());
  const t = convexTest(schema, modules);

  const start = Date.now();
  await t.mutation(internal.feeds.checkLater, { minutes: 10 });
  vi.advanceTimersByTime(9 * MINUTE_MS);
  await t.finishInProgressScheduledFunctions();
  expect(await t.query(internal.feeds.latest, {})).toEqual([]);

  vi.advanceTimersByTime(MINUTE_MS);
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const [row] = await t.query(internal.feeds.latest, {});
  expect(row).toMatchObject({
    trigger: "timer",
    scheduledFor: start + 10 * MINUTE_MS,
    fplPlayers: { ok: true, count: 3 },
    plFixtures: { ok: true, count: 2 },
    arsenalSquadNumbers: { ok: true, count: 2 },
  });
});

test("a feed that refuses is recorded with its status, and the other feed still counts", async () => {
  vi.stubGlobal("fetch", fakeFeeds("pulselive"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const t = convexTest(schema, modules);

  await t.action(internal.feeds.check, { trigger: "manual" });

  const [row] = await t.query(internal.feeds.latest, {});
  expect(row.fplPlayers).toEqual({ ok: true, count: 3 });
  expect(row.plFixtures).toMatchObject({ ok: false, error: expect.stringContaining("answered 403") });
  expect(row.arsenalSquadNumbers).toMatchObject({ ok: false });
});

test("a registered player with no squad number is left out", () => {
  const numbers = squadNumbers({ players: [{ id: 10, info: { shirtNum: 4 } }, { id: 11, info: {} }, { id: 12 }] });
  expect([...numbers]).toEqual([[10, 4]]);
});

test("the commentary check reads a match's stream, sheets and team stats in turn, and says what came", async () => {
  const match = COMMENTARY_MATCH.brentfordLiverpool;
  const bodies: Record<string, unknown> = {
    [plCommentaryUrl(match)]: recordedCommentary(match),
    [plFixtureUrl(match)]: recordedSheets(match),
    [plTeamStatsUrl(match)]: recordedTeamStats(match),
  };
  const fetch = vi.fn(async (url: string) => (url in bodies ? Response.json(bodies[url]) : new Response("", { status: 404 })));
  vi.stubGlobal("fetch", fetch);
  const t = convexTest(schema, modules);

  const report = await t.action(internal.feeds.commentaryCheck, { plFixtureId: match });

  expect(report).toEqual({
    readAt: new Date().toISOString(),
    lines: 122,
    newest: { id: 2867014, minuteLabel: "01", text: "Match ends, Brentford 1, Liverpool 2." },
    namedMen: 40,
    teamStats: true,
  });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(Object.keys(bodies));
});

test("a commentary check whose read is refused throws, naming the URL", async () => {
  vi.stubGlobal("fetch", fakeFeeds("textstream"));
  const t = convexTest(schema, modules);

  await expect(t.action(internal.feeds.commentaryCheck, { plFixtureId: UPCOMING_MATCH })).rejects.toThrow(
    `${plCommentaryUrl(UPCOMING_MATCH)} answered 403`,
  );
});
