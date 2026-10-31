import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FPL_BOOTSTRAP_URL, fplLiveUrl, plCommentaryUrl } from "../../../convex/football/football";
import { FEED_TYPE } from "../../../convex/football/commentary";
import { FULL_TIME_LINE_WAIT_MS } from "../../../convex/football/matchCommentary";
import type { RawPlCommentary } from "../../../convex/football/premierLeague/premierLeague";
import { MINUTE_MS } from "../../../convex/shared/time";
import { REPLAY_MINUTES, stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { fakeFeeds, GAMEWEEK, HULL_EVERTON, withHullEverton } from "../../support/convex/matchStats.harness";
import { refusedError, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import { recordedCommentary } from "../../support/recorded/commentary.payloads";
import { MATCH, recordedGw6, type Gw6Payloads } from "../../support/recorded/gw6.payloads";

// The live tick reads each live match's commentary at the cadence of its points (#43): Hull v
// Everton's recorded stream, served as the match is replayed live. A commentary that fails is
// delayed and logged, and never stops the match's points. The store's own rules, on Ipswich v
// Forest's live recording, are in tests/convex/football/matchCommentary.test.ts.

beforeEach(() => vi.useFakeTimers());

const COMMENTARY_URL = plCommentaryUrl(MATCH.hullEverton.pl);
const MINUTE = 30;
/** Hull v Everton's full-time line, from the recorded 2–2. */
const FULL_TIME_LINE = "FT HUL 2–2 EVE";

async function heldCommentary(t: TestConvex) {
  return t.run((ctx) => ctx.db.query("matchCommentary").unique());
}

/** One tick at `time` against `payloads`, its commentary read as `stream` sends it; its fake fetch. */
async function tickWithStream(t: TestConvex, time: number, payloads: Gw6Payloads, stream: RawPlCommentary) {
  const served = fakeFeeds(payloads);
  vi.setSystemTime(time);
  const fetch = vi.fn(async (url: string) => (url === COMMENTARY_URL ? Response.json(stream) : served(url)));
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.stats.liveStatsSync.tick, {});
  return fetch;
}

/** Whether a tick's fake fetch read the commentary stream. */
const readStream = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.some(([url]) => url === COMMENTARY_URL);

/** Hull v Everton's recorded stream as read before "Match ends" reached it. */
function streamBeforeMatchEnds(): RawPlCommentary {
  const stream = recordedCommentary(MATCH.hullEverton.pl);
  stream.events.content = stream.events.content.filter((line) => line.type !== FEED_TYPE.matchEnds);
  return stream;
}

test("a tick stores the live match's commentary, written from its stream, alongside its points", async () => {
  const t = await withHullEverton();

  const { latest } = await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  const held = (await heldCommentary(t))!;
  expect(held).toMatchObject({ fixtureCode: HULL_EVERTON, delayed: null });
  const stream = recordedCommentary(MATCH.hullEverton.pl).events.content;
  expect(held.lines.map((line) => line.sourceId)).toEqual(stream.filter((line) => line.type !== FEED_TYPE.end2).map((line) => line.id));
  expect(held.lines[0]?.text).toBe(FULL_TIME_LINE);
  expect(held.lines.at(-2)?.text).toBe("KO HUL v EVE");
});

test("a stream that will not read is delayed and logged while the points carry on, and the next good read clears it", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));
  const { lines } = (await heldCommentary(t))!;

  const { latest } = await tickAt(t, stageTime(MINUTE + 1), stagedGw6(MINUTE + 1), "textstream");

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  const reason = refusedError(COMMENTARY_URL);
  expect(errors).toHaveBeenCalledWith(`match ${HULL_EVERTON}'s commentary failed: ${reason}`);
  expect(await heldCommentary(t)).toMatchObject({ lines, delayed: { reason, since: stageTime(MINUTE + 1) } });

  await tickAt(t, stageTime(MINUTE + 2), stagedGw6(MINUTE + 2));
  expect(await heldCommentary(t)).toMatchObject({ lines, delayed: null });
});

test("a line the writer cannot word throws, so the held lines stand, delayed, and the points carry on", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));
  const { lines } = (await heldCommentary(t))!;
  // A substitution naming one man: the writer needs the man on and the man off.
  const broken = recordedCommentary(MATCH.hullEverton.pl);
  const substitution = broken.events.content.find((line) => line.type === FEED_TYPE.substitution)!;
  substitution.playerIds = substitution.playerIds!.slice(0, 1);

  await tickWithStream(t, stageTime(MINUTE + 1), stagedGw6(MINUTE + 1), broken);

  const [latest] = await t.query(internal.stats.liveStats.latest, {});
  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  expect(errors).toHaveBeenCalledWith(expect.stringContaining(`match ${HULL_EVERTON}'s commentary failed: commentary line ${substitution.id}`));
  expect(await heldCommentary(t)).toMatchObject({ lines, delayed: { since: stageTime(MINUTE + 1) } });
});

test("a tick whose first read fails delays every live match's commentary", async () => {
  silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));

  await tickAt(t, stageTime(MINUTE + 1), stagedGw6(MINUTE + 1), FPL_BOOTSTRAP_URL);

  expect(await heldCommentary(t)).toMatchObject({ delayed: { reason: refusedError(FPL_BOOTSTRAP_URL), since: stageTime(MINUTE + 1) } });
});

test("a gameweek whose reads fail delays its matches' commentary", async () => {
  silenceConsoleError();
  const t = await withHullEverton();
  await tickAt(t, stageTime(MINUTE), stagedGw6(MINUTE));

  await tickAt(t, stageTime(MINUTE + 1), stagedGw6(MINUTE + 1), fplLiveUrl(GAMEWEEK));

  expect(await heldCommentary(t)).toMatchObject({ delayed: { reason: refusedError(fplLiveUrl(GAMEWEEK)), since: stageTime(MINUTE + 1) } });
});

test("once the match is complete its commentary is no longer read, and its lines are kept as written", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(REPLAY_MINUTES + 1), recordedGw6());
  const atFullTime = await heldCommentary(t);

  const { fetch } = await tickAt(t, stageTime(REPLAY_MINUTES + 2), recordedGw6());

  expect(fetch).not.toHaveBeenCalled();
  expect(await heldCommentary(t)).toEqual(atFullTime);
  expect(atFullTime?.lines[0]?.text).toBe(FULL_TIME_LINE);
});

test("a full-time line that reaches the stream a tick after full time is read and stored, then reading stops", async () => {
  const t = await withHullEverton();
  const fullTime = stageTime(REPLAY_MINUTES + 1);
  await tickWithStream(t, fullTime, recordedGw6(), streamBeforeMatchEnds());
  expect((await heldCommentary(t))?.lines.map((line) => line.text)).not.toContain(FULL_TIME_LINE);

  const next = await tickWithStream(t, fullTime + MINUTE_MS, recordedGw6(), recordedCommentary(MATCH.hullEverton.pl));

  expect(readStream(next)).toBe(true);
  const stored = await heldCommentary(t);
  expect(stored).toMatchObject({ delayed: null });
  expect(stored?.lines[0]?.text).toBe(FULL_TIME_LINE);
  const { fetch } = await tickAt(t, fullTime + 2 * MINUTE_MS, recordedGw6());
  expect(fetch).not.toHaveBeenCalled();
  expect(await heldCommentary(t)).toEqual(stored);
});

test("a full-time line that never comes is read for until FULL_TIME_LINE_WAIT_MS after full time, then the match is no longer read", async () => {
  const t = await withHullEverton();
  const fullTime = stageTime(REPLAY_MINUTES + 1);
  await tickWithStream(t, fullTime, recordedGw6(), streamBeforeMatchEnds());

  const lastWait = await tickWithStream(t, fullTime + FULL_TIME_LINE_WAIT_MS - MINUTE_MS, recordedGw6(), streamBeforeMatchEnds());
  expect(readStream(lastWait)).toBe(true);

  const after = await tickWithStream(t, fullTime + FULL_TIME_LINE_WAIT_MS, recordedGw6(), streamBeforeMatchEnds());
  expect(after).not.toHaveBeenCalled();
  expect((await heldCommentary(t))?.lines.map((line) => line.text)).not.toContain(FULL_TIME_LINE);
});
