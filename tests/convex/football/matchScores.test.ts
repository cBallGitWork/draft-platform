import type { Infer } from "convex/values";
import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { ScoreRead } from "../../../convex/football/scoreReads";
import type { scoreFeed } from "../../../convex/schema";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS } from "../../../convex/shared/time";
import { actingAs } from "../../support/convex/leagues.harness";
import { syncRun, syncWith } from "../../support/convex/footballSync.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";
import { CLUB_CODE, FIXTURE_CODE, recordedFpl } from "../../support/recorded/fpl.payloads";
import { FPL_RECORDED_LIVE, IPSWICH_FOREST } from "../../support/recorded/scores.payloads";

// Each match's score and clock, stored (#49): written by the football sync from FPL's fixtures,
// kept fresh by the live tick (tests/convex/stats/liveStats.scores.test.ts), and read a gameweek
// at a time. Where two reads disagree, the newest wins, unless it moves the other feed's state back.

const FINISHED = FIXTURE_CODE.arsenalVCoventry;
const LIVE = FPL_RECORDED_LIVE;
const UPCOMING = IPSWICH_FOREST;
const SPURS = { code: 6, name: "Spurs", shortName: "TOT" };
const COVENTRY = { code: CLUB_CODE.coventry, name: "Coventry City", shortName: "COV" };

const MANAGER = "manager@example.com";

async function heldScores(t: TestConvex) {
  const rows = await t.run((ctx) => ctx.db.query("matchScores").collect());
  return new Map(rows.map(({ _id, _creationTime, ...row }) => [row.fixtureCode, row]));
}

test("the football sync stores each match's score and minutes from FPL's fixtures", async () => {
  const t = freshConvex();

  const run = await syncRun(t, recordedFpl());

  const fromFpl = { feed: "fpl", readAt: run.ranAt, clockLabel: null };
  expect(await heldScores(t)).toEqual(
    new Map([
      [FINISHED, { fixtureCode: FINISHED, state: "fullTime", homeGoals: 3, awayGoals: 0, minutes: 90, ...fromFpl }],
      [LIVE, { fixtureCode: LIVE, state: "live", homeGoals: 2, awayGoals: 1, minutes: 72, ...fromFpl }],
      [UPCOMING, { fixtureCode: UPCOMING, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, ...fromFpl }],
    ]),
  );
});

test("a sync that reads the same scores again writes none", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const before = await heldScores(t);

  const outcome = await syncWith(t, recordedFpl());

  expect(outcome).toMatchObject({ ok: true, scores: { received: 3, written: 0, problems: [] } });
  expect(await heldScores(t)).toEqual(before);
});

test("a finished match FPL sends no score for is on the run row, and the score held for it stands", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const before = await heldScores(t);
  const payloads = recordedFpl();
  payloads.fixtures.find((fixture) => fixture.code === FINISHED)!.team_a_score = null;
  payloads.fixtures.find((fixture) => fixture.code === LIVE)!.minutes = 73;

  const outcome = await syncWith(t, payloads);

  expect(outcome).toMatchObject({
    ok: true,
    scores: { received: 3, written: 1, problems: [{ fixtureCode: FINISHED, problem: "FPL sent score null for a match at fullTime" }] },
  });
  const after = await heldScores(t);
  expect(after.get(FINISHED)).toEqual(before.get(FINISHED));
  expect(after.get(LIVE)).toMatchObject({ minutes: 73 });
});

// The rule where two reads meet, at the mutation both feeds write through.

const AT = Date.parse("2026-10-19T20:15:00Z");
const live = (homeGoals: number, awayGoals: number, minutes: number): ScoreRead => ({
  fixtureCode: LIVE,
  state: "live",
  homeGoals,
  awayGoals,
  minutes,
  clockLabel: null,
});
const fullTime: ScoreRead = { ...live(2, 1, 96), state: "fullTime", clockLabel: "90+6'00" };
const upcoming: ScoreRead = { fixtureCode: LIVE, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null };

function write(t: TestConvex, feed: Infer<typeof scoreFeed>, readAt: number, read: ScoreRead) {
  return t.mutation(internal.football.matchScores.upsertScores, { feed, readAt, reads: [read] });
}

async function heldLive(t: TestConvex) {
  return (await heldScores(t)).get(LIVE);
}

test("a read older than the held one is not written", async () => {
  const t = freshConvex();
  await write(t, "pl", AT, live(2, 1, 72));

  expect(await write(t, "fpl", AT - MINUTE_MS, live(1, 1, 71))).toBe(0);
  expect(await heldLive(t)).toEqual({ ...live(2, 1, 72), feed: "pl", readAt: AT });
});

test("a newer read from the other feed wins at the same state", async () => {
  const t = freshConvex();
  await write(t, "pl", AT, live(1, 1, 72));

  expect(await write(t, "fpl", AT + MINUTE_MS, live(2, 1, 73))).toBe(1);
  expect(await heldLive(t)).toEqual({ ...live(2, 1, 73), feed: "fpl", readAt: AT + MINUTE_MS });
});

test("a feed lagging behind never moves the other feed's full time back to live", async () => {
  const t = freshConvex();
  await write(t, "pl", AT, fullTime);

  expect(await write(t, "fpl", AT + MINUTE_MS, live(2, 1, 90))).toBe(0);
  expect(await heldLive(t)).toEqual({ ...fullTime, feed: "pl", readAt: AT });
});

test("a feed may move its own read back: a match abandoned and reset", async () => {
  const t = freshConvex();
  await write(t, "pl", AT, live(0, 0, 20));

  expect(await write(t, "pl", AT + MINUTE_MS, upcoming)).toBe(1);
  expect(await heldLive(t)).toEqual({ ...upcoming, feed: "pl", readAt: AT + MINUTE_MS });
});

// The read a screen makes.

test("a gameweek's matches come in kickoff order with their clubs and scores, a match with none read holding null", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  const later = Date.parse("2026-10-20T19:00:00Z");
  await t.run((ctx) =>
    ctx.db.insert("fixtures", { code: 1, gameweek: 7, homeClubCode: COVENTRY.code, awayClubCode: SPURS.code, kickoff: later }),
  );

  const matches = await (await actingAs(t, MANAGER)).query(api.football.matchScores.ofGameweek, { gameweek: 7 });

  expect(matches).toEqual([
    {
      fixtureCode: LIVE,
      kickoff: Date.parse("2026-10-19T19:00:00Z"),
      home: SPURS,
      away: COVENTRY,
      score: { state: "live", homeGoals: 2, awayGoals: 1, minutes: 72, clockLabel: null },
    },
    { fixtureCode: 1, kickoff: later, home: COVENTRY, away: SPURS, score: null },
  ]);
});

test("a match the feed has dropped is left out of its gameweek", async () => {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  await t.run(async (ctx) => {
    const fixture = (await ctx.db.query("fixtures").withIndex("by_code", (q) => q.eq("code", LIVE)).unique())!;
    await ctx.db.patch("fixtures", fixture._id, { droppedAt: AT });
  });

  expect(await (await actingAs(t, MANAGER)).query(api.football.matchScores.ofGameweek, { gameweek: 7 })).toEqual([]);
});

test("someone signed out is refused a gameweek's matches", async () => {
  const t = freshConvex();

  await expect(t.query(api.football.matchScores.ofGameweek, { gameweek: 7 })).rejects.toThrow(refusals.signedOut);
});
