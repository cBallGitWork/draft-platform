import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { FPL_BOOTSTRAP_URL, fplLiveUrl, plPlayerStatsUrl } from "./football";
import { MS_PER_MINUTE } from "./deadline";
import { HOUR_MS } from "./matchStats";
import {
  elapse,
  FULL_TIME_READ,
  GAMEWEEK,
  HULL_EVERTON,
  heldMatch,
  mergedHullEverton,
  modules,
  refusedError,
  syncAt,
  withBelloumiGoalRemoved,
  withHullEverton,
  withPlReadEmpty,
} from "./matchStats.harness";
import { statValue } from "./matchRecords";
import type { RawPlFixture } from "./premierLeague";
import { fplElementsWithout, FULL_STATS, MATCH, recordedGw6 } from "./recorded/gw6.payloads";
import schema from "./schema";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a finished match lands complete: a record for every named man, both feeds merged", async () => {
  const t = await withHullEverton();

  const run = await syncAt(t, FULL_TIME_READ, recordedGw6());

  expect(run.outcome).toEqual({
    ok: true,
    matches: [
      {
        fixtureCode: HULL_EVERTON,
        ok: true,
        state: "complete",
        players: 40,
        inserted: 40,
        updated: 0,
        lateCorrections: 0,
        unmatched: [],
      },
    ],
    waiting: [],
  });
  const { records, status } = await heldMatch(t);
  expect(status).toMatchObject({ state: "complete", fullTimeAt: FULL_TIME_READ, completeAt: FULL_TIME_READ });
  const held = [...records.values()].map(({ _id, _creationTime, ...record }) => record);
  expect(held).toHaveLength(40);
  expect(held).toEqual(expect.arrayContaining(mergedHullEverton().map((record) => ({ ...record, state: "complete" }))));
});

test("a re-read of the same match writes nothing new, and keeps when it completed", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  const run = await syncAt(t, FULL_TIME_READ + 10 * MS_PER_MINUTE, recordedGw6());

  expect(run.outcome).toMatchObject({ matches: [{ state: "complete", inserted: 0, updated: 0 }] });
  expect((await heldMatch(t)).status).toMatchObject({ completeAt: FULL_TIME_READ });
});

test("a starter's record not yet arrived shows — and keeps the match provisional until it does", async () => {
  const t = await withHullEverton();

  await syncAt(t, FULL_TIME_READ, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));

  const before = await heldMatch(t);
  expect(before.status).toMatchObject({ state: "provisional" });
  expect(before.status).not.toHaveProperty("completeAt");
  expect(statValue(before.records.get(FULL_STATS.coyle.code)!, "won_tackle")).toBeNull();
  expect(statValue(before.records.get(FULL_STATS.mcBurnie.code)!, "minutes")).toBe(90);
  expect([...before.records.values()].every((row) => row.state === "provisional")).toBe(true);

  await syncAt(t, FULL_TIME_READ + HOUR_MS / 2, recordedGw6());

  const after = await heldMatch(t);
  expect(after.status).toMatchObject({ state: "complete", completeAt: FULL_TIME_READ + HOUR_MS / 2 });
  expect(statValue(after.records.get(FULL_STATS.coyle.code)!, "won_tackle")).toBe(1);
});

test("a correction inside the window updates the record, and a stat taken away goes back to 0", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  const run = await syncAt(t, FULL_TIME_READ + HOUR_MS / 2, withBelloumiGoalRemoved(recordedGw6()));

  expect(run.outcome).toMatchObject({ matches: [{ state: "complete", inserted: 0, updated: 1 }] });
  const belloumi = (await heldMatch(t)).records.get(FULL_STATS.belloumi.code)!;
  expect(statValue(belloumi, "goals_scored")).toBe(0);
  expect(belloumi.stats).not.toHaveProperty("goals_openplay");
  expect(statValue(belloumi, "goals_openplay")).toBe(0);
});

test("a correction after the lock changes nothing, and is recorded once for the feeds page", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await elapse(t, HOUR_MS);
  const locked = await heldMatch(t);
  expect(locked.status).toMatchObject({ state: "locked" });

  const late = FULL_TIME_READ + 2 * HOUR_MS;
  const run = await syncAt(t, late, withBelloumiGoalRemoved(recordedGw6()));
  await syncAt(t, late + 2 * HOUR_MS, withBelloumiGoalRemoved(recordedGw6()));

  expect(run.outcome).toMatchObject({ matches: [{ state: "locked", inserted: 0, updated: 0, lateCorrections: 1 }] });
  const after = await heldMatch(t);
  expect(after.records).toEqual(locked.records);
  expect(after.lateCorrections).toEqual([
    expect.objectContaining({
      fixtureCode: HULL_EVERTON,
      playerCode: FULL_STATS.belloumi.code,
      seenAt: late,
      changes: [
        { stat: "goals_openplay", locked: 1, sent: 0 },
        { stat: "goals_scored", locked: 1, sent: 0 },
      ],
    }),
  ]);
});

test("a record a feed stops sending after the lock is a gap, not a correction", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await elapse(t, HOUR_MS);

  await syncAt(t, FULL_TIME_READ + 2 * HOUR_MS, withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl));

  expect((await heldMatch(t)).lateCorrections).toEqual([]);
});

test("a match the Premier League does not yet call full time waits, and nothing is written", async () => {
  const t = await withHullEverton();
  const payloads = recordedGw6();
  payloads.pl.round.content.find((fixture) => fixture.id === MATCH.hullEverton.pl)!.status = "L";

  const run = await syncAt(t, FULL_TIME_READ, payloads);

  expect(run.outcome).toEqual({ ok: true, matches: [], waiting: [HULL_EVERTON] });
  expect((await heldMatch(t)).records.size).toBe(0);
});

test.each([
  [
    "missing from the Premier League's gameweek list",
    (listed: RawPlFixture) => {
      delete listed.altIds;
    },
    `the Premier League lists no match ${HULL_EVERTON} in gameweek ${GAMEWEEK}`,
  ],
  [
    "listed with no status",
    (listed: RawPlFixture) => {
      delete listed.status;
    },
    `PL fixture ${MATCH.hullEverton.pl} carries no status`,
  ],
] as const)("a match %s fails on the run row", async (_what, change, error) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const t = await withHullEverton();
  const payloads = recordedGw6();
  change(payloads.pl.round.content.find((fixture) => fixture.id === MATCH.hullEverton.pl)!);

  const run = await syncAt(t, FULL_TIME_READ, payloads);

  expect(run.outcome).toEqual({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: false, error }], waiting: [] });
});

test("a refused read is on the run row with its URL and status, logged, and nothing is written", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const t = await withHullEverton();
  const refused = plPlayerStatsUrl(FULL_STATS.coyle.pl, MATCH.hullEverton.pl);

  const run = await syncAt(t, FULL_TIME_READ, recordedGw6(), refused);

  expect(run.outcome).toEqual({
    ok: true,
    matches: [{ fixtureCode: HULL_EVERTON, ok: false, error: refusedError(refused) }],
    waiting: [],
  });
  expect(errors).toHaveBeenCalledWith(`match ${HULL_EVERTON} failed: ${refusedError(refused)}`);
  expect((await heldMatch(t)).records.size).toBe(0);
});

test("a gameweek's refused read fails each of its matches, and a refused FPL read the whole run", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const t = await withHullEverton();

  const gameweek = await syncAt(t, FULL_TIME_READ, recordedGw6(), fplLiveUrl(GAMEWEEK));
  const whole = await syncAt(t, FULL_TIME_READ, recordedGw6(), FPL_BOOTSTRAP_URL);

  expect(gameweek.outcome).toMatchObject({ ok: true, matches: [{ ok: false, error: refusedError(fplLiveUrl(GAMEWEEK)) }] });
  expect(whole.outcome).toEqual({ ok: false, error: refusedError(FPL_BOOTSTRAP_URL) });
});

test("a named man FPL does not list is reported on the run row, and has no record", async () => {
  const t = await withHullEverton();
  const payloads = recordedGw6();
  payloads.fpl.bootstrap.elements = fplElementsWithout(FULL_STATS.coyle.code);
  payloads.fpl.live.elements = payloads.fpl.live.elements.filter((element) =>
    payloads.fpl.bootstrap.elements.some((listed) => listed.id === element.id),
  );

  const run = await syncAt(t, FULL_TIME_READ, payloads);

  expect(run.outcome).toMatchObject({
    matches: [
      { players: 39, unmatched: [{ plPlayerId: FULL_STATS.coyle.pl, name: expect.any(String), opta: `p${FULL_STATS.coyle.code}` }] },
    ],
  });
  expect((await heldMatch(t)).records.has(FULL_STATS.coyle.code)).toBe(false);
});

test("with no match due, no feed is read and the run is still recorded", async () => {
  const t = convexTest(schema, modules);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);

  await t.action(internal.matchStatsSync.run, { trigger: "manual" });

  expect(fetch).not.toHaveBeenCalled();
  const [run] = await t.query(internal.matchStats.latest, {});
  expect(run.outcome).toEqual({ ok: true, matches: [], waiting: [] });
});
