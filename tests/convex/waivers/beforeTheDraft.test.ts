import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { pickUpRefusals } from "../../../convex/waivers/freeAgents";
import { claimRefusals } from "../../../convex/waivers/waiverClaims";
import { dropRefusals } from "../../../convex/waivers/waivers";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS } from "../../support/convex/leagues.harness";
import { holdPlayers } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, ANNS_FIRST_DROP, BOB, PALMER, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// Free agency and waivers wait for the draft (#1326, spec/08 Waivers and free agency, S08.1; Craig, 8 Nov
// 2026: "refused until drafted"): before the league's draft has run, and while it is live, no
// pickup, drop or claim is made and a waiver run is skipped, so nobody can fill a squad and stop
// the draft starting.

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

/** The league's draft row as `started` says: none, or one started with picks still to make. */
const draftIs = (state: "notStarted" | "live") =>
  w.t.run(async (ctx) => {
    const draft = await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", w.leagueId)).unique();
    if (draft !== null) await ctx.db.delete("drafts", draft._id);
    if (state === "live") await ctx.db.insert("drafts", { leagueId: w.leagueId, started: { at: Date.now(), teamIds: w.teams, rounds: 15 } });
  });

const pickUp = async (email: string, playerCode: number) =>
  (await actingAs(w.t, email)).mutation(api.waivers.freeAgents.pickUp, { leagueId: w.leagueId, playerCode, dropCode: null });
const drop = async (email: string, playerCode: number) => (await actingAs(w.t, email)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode });

describe.each(["notStarted", "live"] as const)("with the draft %s", (state) => {
  beforeEach(() => draftIs(state));

  test("a free agent pickup, a drop and a claim are refused", async () => {
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.notDrafted, "the pickup");
    await expectRefused(drop(ANN, ANNS_FIRST_DROP), dropRefusals.notDrafted, "the drop");
    await w.onWaivers([PALMER]);
    await expectRefused(w.claim(BOB, PALMER), claimRefusals.notDrafted, "the claim");

    expect(await w.squadCodes(w.bobsTeam)).toEqual([]);
    expect(await w.squadCodes(w.annsTeam)).toContain(ANNS_FIRST_DROP);
  });

  test("a waiver run is skipped: nobody on waivers moves, and the window stays shut", async () => {
    await w.onWaivers([PALMER]);
    await w.runWaivers();

    expect((await w.stateOf(PALMER)).kind).toBe("onWaivers");
    const held = await w.t.run((ctx) => ctx.db.query("waiverOrders").withIndex("by_leagueId", (q) => q.eq("leagueId", w.leagueId)).unique());
    expect(held?.madeAt).toBeUndefined();
  });
});

test("once the draft is over, a free agent can be picked up", async () => {
  await w.runWaivers();
  await pickUp(BOB, SAKA);
  expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
});

test("a free agent pickup before the draft is refused, so the draft still starts", async () => {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t, 5);
  await addManagers(t, leagueId, MANAGERS.slice(0, 3));
  await holdPlayers(t, [9100]);

  await expect((await actingAs(t, MANAGERS[0])).mutation(api.waivers.freeAgents.pickUp, { leagueId, playerCode: 9100, dropCode: null })).rejects.toThrow(
    pickUpRefusals.notDrafted,
  );
  await (await actingAs(t, COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
});
