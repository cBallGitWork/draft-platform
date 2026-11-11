import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { UndraftedGoTo } from "../../../convex/draft/draftRules";
import { midfielder } from "../../support/convex/draft.harness";
import { ARSENAL, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { changeEveryRules, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { pickGapPasses } from "../../support/convex/pickWindow.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { waiverStateOf } from "../../support/convex/waivers.harness";

// The players nobody drafts (#1197; spec/04, The picks, and spec/08): on waivers for the next run
// once the draft is over when the league's draft setting says waivers, its default, or straight
// to the free agents when it says so.

const [ANN, BOB] = MANAGERS;
const [A1, A2, LEFT] = [101, 102, 103];

let t: TestConvex;
let leagueId: Id<"leagues">;

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [A1, A2, LEFT].map((code) => midfielder(code)));
  });
});

/** A one-round draft with the undrafted going to `goTo`: Ann and Bob each pick one, leaving LEFT.
 *  `beforeStart` runs once the rules are set, before the draft starts. */
async function draftLeaving(goTo: UndraftedGoTo, beforeStart?: () => Promise<void>) {
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: 1 }, minimumByArea: null, maxPerClub: null },
    draft: { ...rules.draft!, undrafted: goTo },
  }));
  await beforeStart?.();
  await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
  await (await actingAs(t, ANN)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: A1 });
  await pickGapPasses(t);
  await (await actingAs(t, BOB)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: A2 });
  // The draft ends 10 seconds after the last pick, and puts them on waivers in a job of its own (#1532, #1458).
  await pickGapPasses(t);
}

const stateOf = (playerCode: number) => waiverStateOf(t, leagueId, playerCode, ANN);

test("go on waivers for the next run when the league's setting says waivers", async () => {
  await draftLeaving("waivers");
  expect(await stateOf(LEFT)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() });
  expect((await stateOf(A1)).kind).toBe("owned");
});

test("are free agents when it says free agents", async () => {
  await draftLeaving("freeAgents");
  expect(await stateOf(LEFT)).toEqual({ kind: "freeAgent" });
});

test("mid-season, go where the last setting typed says, a change waiting for the next gameweek (#1439)", async () => {
  await holdGameweeks(t, { next: 5 });
  await draftLeaving("waivers", async () => {
    const [newest] = await t.run((ctx) => ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).order("desc").take(1));
    const rules = { ...newest.rules!, draft: { ...newest.rules!.draft!, undrafted: "freeAgents" as const } };
    await t.run((ctx) => ctx.db.insert("leagueRules", { leagueId, fromGameweek: 5, rules }));
  });
  expect(await stateOf(LEFT)).toEqual({ kind: "freeAgent" });
});
