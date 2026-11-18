import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { commissionerAskRefusals } from "../../../convex/leagues/commissionerAsks";
import { refusals } from "../../../convex/shared/leagueAccess";
import { draftSteps } from "../../support/convex/draft.harness";
import { ADMIN, actingAs, addManagers, LEAGUE_NAME, leagueRow, MANAGERS, TEST_LEAGUE_TEAMS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Asking to be commissioner of a league with none (spec/01 S01.3, S01.2's button; #2661): any
// manager asks, the admin approves or refuses, and an approved manager has the powers at once.

const [SET_UP_BY, ASKER, OTHER] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await (await actingAs(t, ADMIN)).mutation(api.leagues.leagues.create, {
    name: LEAGUE_NAME,
    maxTeams: TEST_LEAGUE_TEAMS,
    commissionerEmail: SET_UP_BY,
    noCommissioner: true,
  });
  await addManagers(t, leagueId, MANAGERS.slice(0, 3));
});

const ask = async (email: string) => (await actingAs(t, email)).mutation(api.leagues.commissionerAsks.ask, { leagueId });
const waiting = async () => (await actingAs(t, ADMIN)).query(api.leagues.commissionerAsks.waiting, {});
const askIdOf = async (email: string) => (await waiting()).asks.find((each) => each.email === email)!.askId;
const approve = async (email: string) => (await actingAs(t, ADMIN)).mutation(api.leagues.commissionerAsks.approve, { askId: await askIdOf(email) });

describe("asking to be commissioner", () => {
  test("S01.3 a manager asks, and the ask waits for the admin, once however often he asks", async () => {
    await ask(ASKER);
    await ask(ASKER);
    expect((await waiting()).asks).toEqual([expect.objectContaining({ leagueName: LEAGUE_NAME, email: ASKER })]);
  });

  test("S01.3 approved mid-draft, the manager is commissioner at once and can pause the draft; the other asks are refused", async () => {
    const steps = draftSteps(() => ({ t, leagueId }));
    await steps.setSquadSize(2);
    await (await steps.as(SET_UP_BY)).mutation(api.draft.draftStart.start, { leagueId });
    await expectRefused((await actingAs(t, ASKER)).mutation(api.draft.draftPause.pause, { leagueId }), refusals.notRunner);

    await ask(ASKER);
    await ask(OTHER);
    await approve(ASKER);

    expect((await leagueRow(t, leagueId))?.commissionerEmail).toBe(ASKER);
    await (await actingAs(t, ASKER)).mutation(api.draft.draftPause.pause, { leagueId });
    expect((await waiting()).asks).toEqual([]);
    await expectRefused(ask(OTHER), commissionerAskRefusals.hasCommissioner);
  });

  test("S01.3 refused, the league still has none and the manager may ask again", async () => {
    await ask(ASKER);
    await (await actingAs(t, ADMIN)).mutation(api.leagues.commissionerAsks.refuseAsk, { askId: await askIdOf(ASKER) });

    expect((await leagueRow(t, leagueId))?.commissionerEmail).toBeUndefined();
    expect((await waiting()).asks).toEqual([]);
    await ask(ASKER);
    expect((await waiting()).asks).toHaveLength(1);
  });

  test("S01.3 only the admin approves or refuses", async () => {
    await ask(ASKER);
    const askId = await askIdOf(ASKER);
    await expectRefused((await actingAs(t, SET_UP_BY)).mutation(api.leagues.commissionerAsks.approve, { askId }), refusals.notAdmin);
    await expectRefused((await actingAs(t, ASKER)).mutation(api.leagues.commissionerAsks.refuseAsk, { askId }), refusals.notAdmin);
  });

  test("S01.2 a commissioner's letter to everyone offers the ask until the league has a commissioner", async () => {
    await t.run(async (ctx) => {
      const league = (await ctx.db.get("leagues", leagueId))!;
      await ctx.db.insert("letters", { to: ASKER, leagueId, leagueName: league.name, at: Date.now(), kind: "draft", subject: "The draft didn't start", body: "", askToRun: true });
    });
    const offer = async () => (await (await actingAs(t, ASKER)).query(api.mail.mail.letters, { leagueId })).find((each) => each.askToRun !== null)?.askToRun ?? null;

    expect(await offer()).toEqual({ leagueId, asked: false });
    await ask(ASKER);
    expect(await offer()).toEqual({ leagueId, asked: true });
    await approve(ASKER);
    expect(await offer()).toBeNull();
  });
});
