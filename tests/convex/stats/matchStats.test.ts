import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FPL_BOOTSTRAP_URL, fplLiveUrl, plPlayerStatsUrl } from "../../../convex/football/football";
import { statValue } from "../../../convex/stats/matchRecords";
import {
  FULL_TIME_READ,
  GAMEWEEK,
  HULL_EVERTON,
  heldMatch,
  mergedHullEverton,
  syncAt,
  withBelloumiGoalRemoved,
  withFplBlocksEmpty,
  withHullEverton,
  withPlReadEmpty,
} from "../../support/convex/matchStats.harness";
import type { RawPlFixture } from "../../../convex/football/premierLeague/premierLeague";
import { fplElementsWithout, FULL_STATS, MATCH, recordedGw6 } from "../../support/recorded/gw6.payloads";
import { elapse, freshConvex, refusedError, silenceConsoleError } from "../../support/convex/test.harness";
import { HOUR_MS } from "../../../convex/shared/time";

beforeEach(() => vi.useFakeTimers());

/** A run's scores when the Premier League's list gave Hull v Everton's, a row new or changed. */
const HULL_EVERTON_SCORED = { received: 1, written: 1, problems: [] };
/** A run's scores when no list was read, or none listed the match. */
const NONE_SCORED = { received: 0, written: 0, problems: [] };

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
        changed: mergedHullEverton().map((record) => record.playerCode),
        lateCorrections: 0,
        unmatched: [],
      },
    ],
    waiting: [],
    scores: HULL_EVERTON_SCORED,
  });
  const { records, status } = await heldMatch(t);
  expect(status).toMatchObject({ state: "complete", fullTimeAt: FULL_TIME_READ, completeAt: FULL_TIME_READ });
  const held = [...records.values()].map(({ _id, _creationTime, ...record }) => record);
  expect(held).toHaveLength(40);
  expect(held).toEqual(expect.arrayContaining(mergedHullEverton().map((record) => ({ ...record, state: "complete" }))));
});

test("each run row says whether the cron or a hand started it, and when it ran", async () => {
  const t = await withHullEverton();

  const byHand = await syncAt(t, FULL_TIME_READ, recordedGw6());
  const byCron = await syncAt(t, FULL_TIME_READ + HOUR_MS / 2, recordedGw6(), undefined, "cron");

  expect(byHand).toMatchObject({ trigger: "manual", ranAt: FULL_TIME_READ });
  expect(byCron).toMatchObject({ trigger: "cron", ranAt: FULL_TIME_READ + HOUR_MS / 2 });
});

// S07.1
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

test("a match FPL has not filled in stays provisional, and a starter's minutes and goals show —", async () => {
  const t = await withHullEverton();

  await syncAt(t, FULL_TIME_READ, withFplBlocksEmpty(recordedGw6()));

  const { records, status } = await heldMatch(t);
  expect(status).toMatchObject({ state: "provisional" });
  const mcBurnie = records.get(FULL_STATS.mcBurnie.code)!;
  expect(mcBurnie.arrived).toEqual({ fpl: false, pl: true });
  expect(statValue(mcBurnie, "minutes")).toBeNull();
  expect(statValue(mcBurnie, "goals_scored")).toBeNull();
});

// S07.2
test("a correction after the lock changes nothing, and is recorded once for the feeds page", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());
  await elapse(t, HOUR_MS);
  const locked = await heldMatch(t);
  expect(locked.status).toMatchObject({ state: "locked" });

  const late = FULL_TIME_READ + 2 * HOUR_MS;
  const first = await syncAt(t, late, withBelloumiGoalRemoved(recordedGw6()));
  const again = await syncAt(t, late + 2 * HOUR_MS, withBelloumiGoalRemoved(recordedGw6()));

  expect(first.outcome).toMatchObject({ matches: [{ state: "locked", inserted: 0, updated: 0, lateCorrections: 1 }] });
  expect(again.outcome).toMatchObject({ matches: [{ state: "locked", lateCorrections: 0 }] });
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

  expect(run.outcome).toEqual({ ok: true, matches: [], waiting: [HULL_EVERTON], scores: HULL_EVERTON_SCORED });
  expect((await heldMatch(t)).records.size).toBe(0);
});

test.each([
  [
    "missing from the Premier League's gameweek list",
    (listed: RawPlFixture) => {
      delete listed.altIds;
    },
    `the Premier League lists no match ${HULL_EVERTON} in gameweek ${GAMEWEEK}`,
    NONE_SCORED,
  ],
  [
    "listed with no status",
    (listed: RawPlFixture) => {
      delete listed.status;
    },
    `PL fixture ${MATCH.hullEverton.pl} carries no status`,
    { received: 1, written: 0, problems: [{ fixtureCode: HULL_EVERTON, problem: "the Premier League sent status undefined" }] },
  ],
] as const)("a match %s fails on the run row", async (_what, change, error, scores) => {
  silenceConsoleError();
  const t = await withHullEverton();
  const payloads = recordedGw6();
  change(payloads.pl.round.content.find((fixture) => fixture.id === MATCH.hullEverton.pl)!);

  const run = await syncAt(t, FULL_TIME_READ, payloads);

  expect(run.outcome).toEqual({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: false, error }], waiting: [], scores });
});

test("a refused read is on the run row with its URL and status, logged, and nothing is written", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  const refused = plPlayerStatsUrl(FULL_STATS.coyle.pl, MATCH.hullEverton.pl);

  const run = await syncAt(t, FULL_TIME_READ, recordedGw6(), refused);

  expect(run.outcome).toEqual({
    ok: true,
    matches: [{ fixtureCode: HULL_EVERTON, ok: false, error: refusedError(refused) }],
    waiting: [],
    scores: HULL_EVERTON_SCORED,
  });
  expect(errors).toHaveBeenCalledWith(`match ${HULL_EVERTON} failed: ${refusedError(refused)}`);
  expect((await heldMatch(t)).records.size).toBe(0);
});

test("a gameweek's refused read fails each of its matches, and a refused FPL read the whole run", async () => {
  silenceConsoleError();
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
  const t = freshConvex();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);

  await t.action(internal.stats.matchStatsSync.run, { trigger: "manual" });

  expect(fetch).not.toHaveBeenCalled();
  const [run] = await t.query(internal.stats.matchStats.latest, {});
  expect(run.outcome).toEqual({ ok: true, matches: [], waiting: [] });
});
