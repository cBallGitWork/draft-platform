import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import { draftSteps, FIRST_PICK_MS, midfielder } from "../../support/convex/draft.harness";
import { listsAs, namesOn } from "../../support/convex/draftLists.harness";
import { pickGapPasses } from "../../support/convex/pickWindow.harness";
import { insertClubs, insertPlayers, ARSENAL } from "../../support/convex/footballRows.harness";
import { ANN, BOB, type TestConvex, freshLeague } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Races as orders (#2126): Convex runs mutations one at a time, so a manager's pick and the
// auto-pick his clock running out schedules, landing at the same moment, are one before the other.
// Both ways round, the pick is made once: the manager's own pick lands and the auto-pick does
// nothing, or the auto-pick lands, counts as his timeout, and his pick is refused, as the turn has
// moved on (spec/04, Auto-pick: "When his clock runs out, the pick is made for him even if he is
// online, and it counts as one of his timeouts").

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const [FIRST, SECOND, THIRD, FOURTH] = [101, 102, 103, 104];
const { start, pick, pickAndWait, read, setSquadSize } = draftSteps(() => ({ t, leagueId }));
/** The auto-pick Ann's clock running out schedules, for pick 1. */
const autoPickFirst = () => t.mutation(internal.draft.draftPicks.autoPick, { leagueId, pick: 1 });
const firstPicks = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).filter((row) => row.pick === 1));
const timeouts = () => t.run(async (ctx) => (await ctx.db.query("drafts").unique())?.timeouts ?? []);

beforeEach(async () => {
  ({ t, leagueId, teams } = await freshLeague({ managers: [ANN, BOB], maxTeams: 2 }));
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [FIRST, SECOND, THIRD, FOURTH].map((code) => midfielder(code)));
  });
  await setSquadSize(2);
  await start();
  // Ann's clock has just run out: her auto-pick is due, and nothing has run it yet.
  vi.setSystemTime(Date.now() + FIRST_PICK_MS);
});

describe("a manager's pick and his clock's auto-pick at the same moment", () => {
  test("his pick first: it lands, and the auto-pick after it does nothing", async () => {
    await pick(ANN, THIRD);
    await autoPickFirst();

    const [only, ...more] = await firstPicks();
    expect(more).toEqual([]);
    expect(only).toMatchObject({ teamId: teams[0], playerCode: THIRD });
    expect(only.auto).toBeUndefined();
    expect(await timeouts()).toEqual([]);
  });

  test("the auto-pick first: it lands as his timeout, and his pick after it is refused", async () => {
    await autoPickFirst();
    await expectRefused(pick(ANN, THIRD, 1), pickRefusals.tooLateAuto(midfielder(FIRST).name));

    const [only, ...more] = await firstPicks();
    expect(more).toEqual([]);
    expect(only).toMatchObject({ teamId: teams[0], playerCode: FIRST, auto: true });
    expect(await timeouts()).toEqual([expect.objectContaining({ teamId: teams[0] })]);
  });
});

// A pick counts only for the turn it was made on (Craig, 14 Nov 2026, grill batch 1, on #2191).
describe("a pick that arrives after its turn (S04.20)", () => {
  test("a late pick is refused with what auto-pick took, and stays in the queue", async () => {
    const ann = await listsAs(t, leagueId, ANN);
    await ann.queue(FIRST);
    await ann.queue(THIRD);
    await autoPickFirst();

    await expectRefused(pick(ANN, THIRD, 1), pickRefusals.tooLateAuto(midfielder(FIRST).name));
    expect((await namesOn(t, leagueId, ANN))?.queue).toEqual([midfielder(FIRST).name, midfielder(THIRD).name]);
  });

  test("a pick re-sent after its turn is refused even when his next turn is on the clock and the player is free", async () => {
    await autoPickFirst();
    await pickGapPasses(t);
    await pickAndWait(BOB, SECOND);
    await pickAndWait(BOB, FOURTH);
    // Ann's second pick, the draft's fourth, is on the clock, and THIRD is free.
    expect(await read()).toMatchObject({ status: "live", onTheClock: { pick: 4, teamId: teams[0] } });

    await expectRefused(pick(ANN, THIRD, 1), pickRefusals.tooLateAuto(midfielder(FIRST).name));
    await pick(ANN, THIRD, 4);
  });

  test("one she made herself, re-sent, is refused saying she made it", async () => {
    await pick(ANN, THIRD, 1);
    await pickGapPasses(t);

    await expectRefused(pick(ANN, THIRD, 1), pickRefusals.tooLateOwn(midfielder(THIRD).name));
  });

  test("a pick for a turn not yet on the clock is refused", async () => {
    await autoPickFirst();
    await pickGapPasses(t);
    await pickAndWait(BOB, SECOND);

    await expectRefused(pick(BOB, THIRD, 4), pickRefusals.notThisPick);
  });
});
