import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { UndraftedGoTo } from "../../../convex/draft/draftRules";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The players nobody drafts (#1197; spec/04, The picks, and spec/08): on waivers for the next run
// once the draft is over when the league's draft setting says waivers, its default, or straight
// to the free agents when it says so.

const [ANN, BOB] = MANAGERS;
const player = (code: number): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code, positions: ["CM"] });
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
    await insertPlayers(ctx, [A1, A2, LEFT].map(player));
  });
});

/** A one-round draft with the undrafted going to `goTo`: Ann and Bob each pick one, leaving LEFT. */
async function draftLeaving(goTo: UndraftedGoTo) {
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: 1 }, minimumByArea: null, maxPerClub: null },
    draft: { ...rules.draft!, undrafted: goTo },
  }));
  await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
  await (await actingAs(t, ANN)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: A1 });
  await (await actingAs(t, BOB)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: A2 });
}

const stateOf = async (playerCode: number) => (await actingAs(t, ANN)).query(api.waivers.waivers.stateOf, { leagueId, playerCode });

test("go on waivers for the next run when the league's setting says waivers", async () => {
  await draftLeaving("waivers");
  expect(await stateOf(LEFT)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() });
  expect((await stateOf(A1)).kind).toBe("owned");
});

test("are free agents when it says free agents", async () => {
  await draftLeaving("freeAgents");
  expect(await stateOf(LEFT)).toEqual({ kind: "freeAgent" });
});
