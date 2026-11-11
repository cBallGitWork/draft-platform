import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { scoringStartRefusals, startAfterDraft } from "../../../convex/gameweeks/scoringStart";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { holdGameweeks, setUsed } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, leagueRow, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The league's scoring start (spec/04, After the draft; #1097): "scoring starts in gameweek N", set
// by the commissioner until its deadline, defaulting to the next gameweek after the draft ends. The
// gameweeks before it score nothing and have no head-to-head, and the round robin starts at it
// (Craig, 5 Nov 2026).

const [ANN, BOB, CAT] = MANAGERS;
/** How long after the league is made gameweek 1 kicks off: its deadline falls after the league is
 *  made. Each next gameweek kicks off a week on. */
const KICKS_OFF_IN = 2 * HOUR_MS;

let t: TestConvex;
let leagueId: Id<"leagues">;
let seasonStart: number;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, [ANN, BOB, CAT]);
  seasonStart = Date.now();
  await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
});

/** Moves the clock on to just after `gameweek` kicks off: it and every one before have begun. */
const playUpTo = (gameweek: number) => vi.setSystemTime(seasonStart + (gameweek - 1) * WEEK_MS + KICKS_OFF_IN);
const setStart = async (gameweek: number, by = COMMISSIONER) =>
  (await actingAs(t, by)).mutation(api.gameweeks.scoringStart.setScoringStart, { leagueId, gameweek });
const scoringStart = async () => (await leagueRow(t, leagueId))!.scoringStart;
const table = async () => (await actingAs(t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId });
const fixturesOf = async () => (await table())!.gameweeks.map(({ gameweek, fixtures }) => ({ gameweek, fixtures: fixtures.map(({ points: _points, ...fixture }) => fixture) }));
const draftEnds = () => t.run(async (ctx) => startAfterDraft(ctx, (await ctx.db.get("leagues", leagueId))!, Date.now()));

describe("the gameweeks before it", () => {
  test("have no head-to-head, and the round robin starts at it", async () => {
    const [first] = await fixturesOf();
    await setStart(5);

    const after = await fixturesOf();
    expect(after[0]).toEqual({ gameweek: 5, fixtures: first!.fixtures });
    expect(after.map(({ gameweek }) => gameweek)).toEqual(Array.from({ length: 34 }, (_, index) => index + 5));
  });

  // The commissioner can no longer set a start once gameweeks are scored (#1588), so the draft's end
  // sets it here.
  test("score nothing, even once begun and stored before the start was set", async () => {
    playUpTo(2);
    await t.run((ctx) => recordPassedDeadlines(ctx));
    expect((await table())!.results.map(({ gameweek }) => gameweek)).toEqual([1, 2]);

    await draftEnds();
    playUpTo(3);
    await t.run((ctx) => recordPassedDeadlines(ctx));
    const read = (await table())!;
    expect(read.results.map(({ gameweek }) => gameweek)).toEqual([3]);
    expect(read.gameweeks[0]!.gameweek).toBe(3);
  });

  test("a league with none set scores every ticked gameweek, as before", async () => {
    playUpTo(2);
    await t.run((ctx) => recordPassedDeadlines(ctx));
    expect(await scoringStart()).toBeUndefined();
    expect((await table())!.results.map(({ gameweek }) => gameweek)).toEqual([1, 2]);
  });
});

describe("the commissioner sets it", () => {
  test("to any ticked gameweek not begun, and can move it until its deadline", async () => {
    playUpTo(2);
    await setStart(5);
    await setStart(3);
    expect(await scoringStart()).toBe(3);
  });

  test("never to a gameweek begun, unticked or not in the season", async () => {
    playUpTo(2);
    await expectRefused(setStart(2), scoringStartRefusals.begun(2));
    await setUsed(t, leagueId, 6, false);
    await expectRefused(setStart(6), scoringStartRefusals.unticked(6));
    await expectRefused(setStart(39), scoringStartRefusals.notAGameweek(39));
    expect(await scoringStart()).toBeUndefined();
  });

  test("and once its deadline passes it's fixed", async () => {
    await setStart(3);
    playUpTo(3);
    await expectRefused(setStart(5), scoringStartRefusals.fixed(3));
  });

  test("never once the league, with none set, has scored a gameweek: its earlier results stay (#1588, S04.12)", async () => {
    playUpTo(2);
    await t.run((ctx) => recordPassedDeadlines(ctx));

    await expectRefused(setStart(5), scoringStartRefusals.seasonBegun);
    expect(await scoringStart()).toBeUndefined();
    expect((await table())!.results.map(({ gameweek }) => gameweek)).toEqual([1, 2]);
    expect((await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.scoringStart.ofLeague, { leagueId })).seasonBegun).toBe(true);
  });

  test("a gameweek whose deadline passed before the league was made doesn't fix it", async () => {
    playUpTo(2);
    await t.run((ctx) => recordPassedDeadlines(ctx));
    const later = await adminCreatesLeague(t);
    await t.run((ctx) => recordPassedDeadlines(ctx));

    await (await actingAs(t, COMMISSIONER)).mutation(api.gameweeks.scoringStart.setScoringStart, { leagueId: later, gameweek: 5 });
    expect((await leagueRow(t, later))!.scoringStart).toBe(5);
  });

  test("a manager can't set it", async () => {
    await expectRefused(setStart(5, ANN), refusals.notRunner);
  });

  test("League settings reads it, null while none is set, with the ticked gameweeks and their deadlines", async () => {
    const read = async (by = COMMISSIONER) => (await actingAs(t, by)).query(api.gameweeks.scoringStart.ofLeague, { leagueId });
    await setUsed(t, leagueId, 6, false);
    const before = await read();
    expect(before.start).toBeNull();
    expect(before.ticked.map(({ gameweek }) => gameweek)).not.toContain(6);
    expect(before.ticked).toHaveLength(37);
    expect(before.ticked[1]!.deadline! - before.ticked[0]!.deadline!).toBe(WEEK_MS);

    await setStart(5);
    expect((await read()).start).toBe(5);
    await expectRefused(read(ANN), refusals.notRunner);
  });

  test("unticking it moves it to the next ticked gameweek", async () => {
    await setUsed(t, leagueId, 6, false);
    await setStart(5);
    await setUsed(t, leagueId, 5, false);
    expect(await scoringStart()).toBe(7);
  });

  test("unticking another gameweek leaves it", async () => {
    await setStart(5);
    await setUsed(t, leagueId, 6, false);
    expect(await scoringStart()).toBe(5);
  });
});

describe("the draft ends", () => {
  test("with none set: it starts at the next gameweek", async () => {
    playUpTo(2);
    expect(await draftEnds()).toBeNull();
    expect(await scoringStart()).toBe(3);
  });

  test("the next ticked gameweek: an unticked one is passed over", async () => {
    await setUsed(t, leagueId, 3, false);
    playUpTo(2);
    await draftEnds();
    expect(await scoringStart()).toBe(4);
  });

  test("with one set still to come: it stays", async () => {
    await setStart(5);
    playUpTo(2);
    expect(await draftEnds()).toBeNull();
    expect(await scoringStart()).toBe(5);
  });

  test("after the deadline of the one set: it moves to the next gameweek, and says so", async () => {
    await setStart(3);
    playUpTo(3);
    expect(await draftEnds()).toEqual({ from: 3, to: 4 });
    expect(await scoringStart()).toBe(4);
  });
});
