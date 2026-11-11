import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { WEEK_MS } from "../../../convex/shared/time";
import type { Area, Lane } from "../../../convex/lineup/pitch";
import type { Lineup } from "../../../convex/lineup/lineup";
import { problemWords } from "../../../convex/lineup/lineupWords";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { BENCH_POSITION, FOUR_FOUR_TWO, holdSquad, nameOf, NEXT, passNextDeadline, REVERSED_BENCH, sent, STARTERS } from "../../support/convex/lineupSquad.harness";

// A starter who loses a position stays where he stands (spec/06, When positions change), and the
// rest of his manager's lineup still saves for that gameweek; after its deadline he must be moved
// (Craig, 11 Nov 2026, on #1589).

const [ANN] = MANAGERS;
/** The 4-4-2's first striker, who loses ST and plays only the bench's position. */
const STRIKER = STARTERS[9];
const OTHER_STRIKER = STARTERS[10];
/** A midfielder the first bench player, a CM, can stand in for. */
const OUT_MIDFIELDER = FOUR_FOUR_TWO.starters.find(({ area }) => area === "midfield")!.playerCode;
const strikerAt = FOUR_FOUR_TWO.starters.find(({ playerCode }) => playerCode === STRIKER)!;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam);
  await save(FOUR_FOUR_TWO);
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("playerPositions").collect()).find(({ code }) => code === STRIKER)!;
    await ctx.db.patch("playerPositions", row._id, { set: [BENCH_POSITION], removed: ["ST"] });
  });
});

const save = async (lineup: Lineup) => (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: sent(lineup) });
/** The two strikers swapped: the one who lost ST moved to the other's cell. */
const SWAPPED: Lineup = {
  ...FOUR_FOUR_TWO,
  starters: FOUR_FOUR_TWO.starters.map((starter) => {
    const other = FOUR_FOUR_TWO.starters.find(({ playerCode }) => playerCode === (starter.playerCode === STRIKER ? OTHER_STRIKER : starter.playerCode === OTHER_STRIKER ? STRIKER : 0));
    return other === undefined ? starter : { ...starter, area: other.area, lane: other.lane };
  }),
};
const outOfPosition = (lineup: Lineup) => {
  const { area, lane } = lineup.starters.find(({ playerCode }) => playerCode === STRIKER)!;
  return problemWords({ kind: "outsideHisAreas", playerCode: STRIKER, area: area as Area, lane: lane as Lane, positions: [BENCH_POSITION] }, nameOf);
};
/** Runs the jobs due now, the auto team's among them. */
const runDue = async () => {
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
};
const rowFor = (gameweek: number) => t.run(async (ctx) => (await ctx.db.query("lineups").collect()).find((row) => row.teamId === annsTeam && row.fromGameweek === gameweek));

// Other changes still save for that gameweek only (`S06.7`).
describe("a starter who lost a position, left where he stands", () => {
  test("doesn't stop another change saving, again and again before the deadline", async () => {
    expect(await save(REVERSED_BENCH)).toBe(NEXT);
    expect(await save(FOUR_FOUR_TWO)).toBe(NEXT);

    const row = await rowFor(NEXT);
    expect(row?.starters.find(({ playerCode }) => playerCode === STRIKER)).toMatchObject({ area: strikerAt.area, lane: strikerAt.lane });
    expect(row?.keptOutOfPosition).toEqual([STRIKER]);
  });

  test("is refused once moved to another cell he doesn't play", async () => {
    await expectRefused(save(SWAPPED), outOfPosition(SWAPPED));
  });

  test("must be moved once the deadline has passed, and the lineup saves once he is", async () => {
    await save(REVERSED_BENCH);
    await passNextDeadline(t);

    await expectRefused(save(FOUR_FOUR_TWO), outOfPosition(FOUR_FOUR_TWO));
    // A 4-5-1, the striker dropped into centre midfield, which his CM plays.
    const dropped: Lineup = {
      ...FOUR_FOUR_TWO,
      starters: FOUR_FOUR_TWO.starters.map((starter) => (starter.playerCode === STRIKER ? { playerCode: STRIKER, area: "midfield", lane: "centre" } : starter)),
    };
    expect(await save(dropped)).toBe(NEXT + 1);
    expect((await rowFor(NEXT + 1))?.keptOutOfPosition).toBeUndefined();
  });

  // Craig, 11 Nov 2026, on #1789: the auto team picking the gameweek between gives no grace back.
  test("must still be moved after the auto team set the gameweek between and left him there", async () => {
    await save(REVERSED_BENCH);
    await passNextDeadline(t);
    await runDue();
    await (await actingAs(t, ANN)).mutation(api.lineup.autoTeam.set, { leagueId, teamId: annsTeam, on: true });
    // An out midfielder, so the auto team sets gameweek NEXT + 1's lineup, the striker where he stands.
    await t.run(async (ctx) => {
      const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", OUT_MIDFIELDER)).unique())!;
      await ctx.db.patch("players", player._id, { availability: "out" });
    });
    vi.advanceTimersByTime(WEEK_MS);
    await t.run((ctx) => recordPassedDeadlines(ctx));
    await runDue();
    const autoRow = await rowFor(NEXT + 1);
    expect(autoRow?.starters.map(({ playerCode }) => playerCode)).not.toContain(OUT_MIDFIELDER);
    expect(autoRow?.keptOutOfPosition).toEqual([STRIKER]);

    await expectRefused(save(FOUR_FOUR_TWO), outOfPosition(FOUR_FOUR_TWO));
  });

  test("still saves after the deadline when no save kept him before it", async () => {
    await passNextDeadline(t);
    expect(await save(REVERSED_BENCH)).toBe(NEXT + 1);
  });
});
