import { beforeEach, expect, test, vi } from "vitest";
import { isWhole } from "../../../convex/stats/matchRecords";
import { heldRecords, recordsIn, REPLAY_MINUTES, stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { HULL_EVERTON, heldMatch, mergedHullEverton, withHullEverton } from "../../support/convex/matchStats.harness";
import { FULL_STATS, recordedGw6 } from "../../support/recorded/gw6.payloads";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { centreOf, EXAMPLE_SET } from "../../support/convex/scoring.example";
import { silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import { FPL_BOOTSTRAP_URL } from "../../../convex/football/football";
import { outcomesOf } from "../../support/convex/feeds.harness";
import { holdTypoRule, TYPO_STAT } from "../../support/convex/gameweekScores.harness";

beforeEach(() => vi.useFakeTimers());

/** The replay runs a tick a minute for over a hundred minutes: about 3 s of work, and 5 to 16 s
 *  when other runs share the machine, past vitest's default 5 s. */
const REPLAY_TIMEOUT_MS = 60_000;

type Records = ReturnType<typeof mergedHullEverton>;

/** The men whose records differ between two stages. */
function movedBetween(before: Records, after: Records): number[] {
  const held = new Map(before.map((record) => [record.playerCode, JSON.stringify(record)]));
  return after.filter((record) => held.get(record.playerCode) !== JSON.stringify(record)).map((record) => record.playerCode);
}

/** Belloumi's points under the tests' scoring set, from his held record: "—" (null) while it is not whole. */
async function belloumiPoints(t: TestConvex) {
  const record = (await heldRecords(t)).get(FULL_STATS.belloumi.code)!;
  return scoreMatch(isWhole(record) ? record.stats : null, EXAMPLE_SET, centreOf("attack")).total;
}

test("a replayed match moves every minute, provisional, names who moved, and ends complete at full time", async () => {
  const t = await withHullEverton();
  let before: Records = [];
  const points: (number | null)[] = [];
  for (let minute = 0; minute <= REPLAY_MINUTES; minute += 1) {
    const stage = stagedGw6(minute);
    const { latest } = await tickAt(t, stageTime(minute), stage);
    const expected = mergedHullEverton(stage);
    const moved = movedBetween(before, expected);

    expect(moved.length).toBeGreaterThan(0);
    expect(latest).toMatchObject({
      ranAt: stageTime(minute),
      outcome: { ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true, state: "provisional", changed: moved }] },
    });
    expect(await heldRecords(t)).toEqual(recordsIn(stage, "provisional"));
    points.push(await belloumiPoints(t));
    before = expected;
  }
  // On at 64' and scoring at 74', both five minutes later in play for the first half's stoppage:
  // a point for playing once his first whole minute counts, four more with the goal.
  const moves = points.flatMap((total, minute) => (minute > 0 && total !== points[minute - 1] ? [[minute, total]] : []));
  expect(moves).toEqual([
    [71, 1],
    [79, 5],
  ]);

  const fullTime = stageTime(REPLAY_MINUTES + 1);
  const { latest } = await tickAt(t, fullTime, recordedGw6());

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ state: "complete" }] });
  const { status } = await heldMatch(t);
  expect(status).toMatchObject({ state: "complete", fullTimeAt: fullTime, completeAt: fullTime });
  expect(await heldRecords(t)).toEqual(recordsIn(recordedGw6(), "complete"));
  expect(await belloumiPoints(t)).toBe(5);
}, REPLAY_TIMEOUT_MS);

test("each tick with a match live writes its threshold lines' row; one at full time lists no match, as its steps are the sync's", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(30), stagedGw6(30));
  await tickAt(t, stageTime(REPLAY_MINUTES + 1), recordedGw6());

  expect(await outcomesOf(t, "thresholdSteps")).toEqual([
    { ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] },
    { ok: true, matches: [] },
  ]);
});

test("threshold steps a tick can't work out fail the threshold lines' feed, never the tick's", async () => {
  silenceConsoleError();
  const t = await withHullEverton();
  await holdTypoRule({ t });

  const { latest } = await tickAt(t, stageTime(30), stagedGw6(30));

  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  expect(await outcomesOf(t, "thresholdSteps")).toEqual([
    { ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: false, error: expect.stringContaining(TYPO_STAT) }] },
  ]);
});

test("a tick that reads nothing writes no side read's row, so they show late beside its failure", async () => {
  silenceConsoleError();
  const t = await withHullEverton();

  const { latest } = await tickAt(t, stageTime(30), stagedGw6(30), FPL_BOOTSTRAP_URL);

  expect(latest.outcome).toMatchObject({ ok: false });
  expect(await outcomesOf(t, "teamStats")).toEqual([]);
  expect(await outcomesOf(t, "thresholdSteps")).toEqual([]);
});

test("once the match is complete the next tick reads no feed and records nothing", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(REPLAY_MINUTES + 1), recordedGw6());

  const { fetch, latest } = await tickAt(t, stageTime(REPLAY_MINUTES + 2), recordedGw6());

  expect(fetch).not.toHaveBeenCalled();
  expect(latest.ranAt).toBe(stageTime(REPLAY_MINUTES + 1));
});
