import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import { teamNumbered } from "../../../convex/leagues/teams";
import { draftSteps, FIRST_PICK_MS, midfielder } from "../../support/convex/draft.harness";
import { insertClubs, insertPlayers, ARSENAL } from "../../support/convex/footballRows.harness";
import { addManagers, adminCreatesLeague, ANN, BOB, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
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

const [FIRST, SECOND, THIRD] = [101, 102, 103];
const { start, pick, setSquadSize } = draftSteps(() => ({ t, leagueId }));
/** The auto-pick Ann's clock running out schedules, for pick 1. */
const autoPickFirst = () => t.mutation(internal.draft.draftPicks.autoPick, { leagueId, pick: 1 });
const firstPicks = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).filter((row) => row.pick === 1));
const timeouts = () => t.run(async (ctx) => (await ctx.db.query("drafts").unique())?.timeouts ?? []);

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 2);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [FIRST, SECOND, THIRD].map((code) => midfielder(code)));
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
    await expectRefused(pick(ANN, THIRD), pickRefusals.notYourTurn(teamNumbered(2)));

    const [only, ...more] = await firstPicks();
    expect(more).toEqual([]);
    expect(only).toMatchObject({ teamId: teams[0], playerCode: FIRST, auto: true });
    expect(await timeouts()).toEqual([expect.objectContaining({ teamId: teams[0] })]);
  });
});
