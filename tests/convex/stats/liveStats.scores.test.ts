import { beforeEach, expect, test, vi } from "vitest";
import { REPLAY_MINUTES, stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { HULL_EVERTON, withHullEverton } from "../../support/convex/matchStats.harness";
import { plScoreRead } from "../../../convex/football/scoreReads";
import { MATCH, type Gw6Payloads } from "../../support/recorded/gw6.payloads";
import { LIVE_SCORE, recordedLiveScore } from "../../support/recorded/scores.payloads";
import { silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";

// The live tick keeps each match's score and clock fresh (#49), from the Premier League's list it
// already reads every minute. The replay serves Hull v Everton's stats as liveStats.harness.ts
// stages them, with the score, state and clock of Ipswich v Nott'm Forest's live reads (the only
// match recorded live) in Hull v Everton's place on the list.

beforeEach(() => vi.useFakeTimers());

/** The minute of the replay each live read is served at. */
const SERVED_AT: Record<keyof typeof LIVE_SCORE, number> = {
  beforeKickoff: 0,
  firstGoal: 13,
  halfTime: 48,
  secondHalf: 49,
  fullTime: REPLAY_MINUTES + 1,
};

/** Gameweek 6 staged at the read's minute, Hull v Everton listed with the read's score and clock. */
function withLiveScore(stage: keyof typeof LIVE_SCORE): Gw6Payloads {
  const payloads = stagedGw6(Math.min(SERVED_AT[stage], REPLAY_MINUTES));
  const { status, phase, clock, teams } = recordedLiveScore(stage).fixture;
  const listed = payloads.pl.round.content.find((fixture) => fixture.id === MATCH.hullEverton.pl)!;
  Object.assign(listed, { status, phase, clock });
  listed.teams!.forEach((side, index) => (side.score = teams![index].score));
  return payloads;
}

async function heldScore(t: TestConvex) {
  const row = await t.run((ctx) => ctx.db.query("matchScores").unique());
  if (row === null) return null;
  const { _id, _creationTime, ...score } = row;
  return score;
}

test("each tick writes the match's state, score and clock as the Premier League lists it, to full time", async () => {
  const t = await withHullEverton();
  for (const stage of Object.values(LIVE_SCORE)) {
    const readAt = stageTime(SERVED_AT[stage]);
    const { latest } = await tickAt(t, readAt, withLiveScore(stage));

    expect(latest.outcome).toMatchObject({ ok: true, scores: { received: 1, written: 1, problems: [] } });
    // The read's values are pinned in tests/convex/football/scoreReads.test.ts.
    const read = plScoreRead(recordedLiveScore(stage).fixture, HULL_EVERTON);
    expect(await heldScore(t)).toEqual({ ...read, feed: "pl", readAt });
  }
});

test("a live match listed with no score is on the tick's row, its stats still read, and the score held stands", async () => {
  const t = await withHullEverton();
  await tickAt(t, stageTime(SERVED_AT.firstGoal), withLiveScore("firstGoal"));
  const before = await heldScore(t);
  const payloads = withLiveScore("firstGoal");
  delete payloads.pl.round.content.find((fixture) => fixture.id === MATCH.hullEverton.pl)!.teams![0].score;

  const { latest } = await tickAt(t, stageTime(SERVED_AT.firstGoal + 1), payloads);

  expect(latest.outcome).toMatchObject({
    ok: true,
    matches: [{ fixtureCode: HULL_EVERTON, ok: true }],
    scores: {
      received: 1,
      written: 0,
      problems: [{ fixtureCode: HULL_EVERTON, problem: "the Premier League sent score undefined for a match at live" }],
    },
  });
  expect(await heldScore(t)).toEqual(before);
});

test("a score write that fails is on the tick's row against the match, and its stats are still saved", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  const twice = { ...plScoreRead(recordedLiveScore("beforeKickoff").fixture, HULL_EVERTON), feed: "pl" as const, readAt: 0 };
  // Two rows for one match: `unique()` throws on the next write, as a broken table would.
  await t.run(async (ctx) => {
    await ctx.db.insert("matchScores", twice);
    await ctx.db.insert("matchScores", twice);
  });

  const { latest } = await tickAt(t, stageTime(SERVED_AT.firstGoal), withLiveScore("firstGoal"));

  expect(latest.outcome).toMatchObject({
    ok: true,
    matches: [{ fixtureCode: HULL_EVERTON, ok: true }],
    scores: { received: 1, written: 0, problems: [{ fixtureCode: HULL_EVERTON, problem: expect.stringContaining("unique() query returned more than one result") }] },
  });
  expect(errors).toHaveBeenCalledWith(expect.stringContaining("writing the due matches' scores failed"));
});
