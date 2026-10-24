import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { asCommissioner, invite, openLastLinkTo } from "../../support/convex/joining.harness";
import { MANAGERS, actingAs, addManager, addManagers, adminCreatesLeague, teamsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { ask, fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";

// A manager who is removed or leaves loses the league at once (spec/13, Leaving), so an older
// invite they never used mustn't bring them back at their next sign-in (#133).

const [ANN] = MANAGERS;

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
});

const managers = async () => (await teamsIn(t, leagueId)).map(({ name, managerEmail }) => ({ name, managerEmail }));

describe("a manager who is removed or leaves (#133)", () => {
  const inviteOf = (inviteId: Id<"invites">) => t.run((ctx) => ctx.db.get("invites", inviteId));
  const commissionerRemoves = async (teamId: Id<"teams">) =>
    (await asCommissioner(t)).mutation(api.leagues.teams.removeManager, { leagueId, teamId });

  test("removed while an older invite is live: it is cancelled, so signing in doesn't bring them back", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    const [annsTeam] = await addManagers(t, leagueId, [ANN]);
    await commissionerRemoves(annsTeam);
    await ask(t, ANN);
    await openLastLinkTo(t, sent, ANN);

    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: undefined }]);
    expect((await inviteOf(inviteId))?.cancelledAt).toBe(Date.now());
  });

  test("leaving while an older invite is live: it is cancelled the same way", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await addManager(t, leagueId, ANN);
    await (await actingAs(t, ANN)).mutation(api.leagues.teams.leave, { leagueId });
    await ask(t, ANN);
    await openLastLinkTo(t, sent, ANN);

    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: undefined }]);
    expect((await inviteOf(inviteId))?.cancelledAt).toBe(Date.now());
  });

  test("a new invite after the removal does bring them back", async () => {
    await invite(t, leagueId, ANN);
    const [annsTeam] = await addManagers(t, leagueId, [ANN]);
    await commissionerRemoves(annsTeam);

    await invite(t, leagueId, ANN, annsTeam);
    await openLastLinkTo(t, sent, ANN);

    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: ANN }]);
  });

  test("their live invite to another league is left alone", async () => {
    const otherLeague = await adminCreatesLeague(t, 4, "Another League");
    const otherInvite = await invite(t, otherLeague, ANN);
    const [annsTeam] = await addManagers(t, leagueId, [ANN]);
    await commissionerRemoves(annsTeam);
    await openLastLinkTo(t, sent, ANN);

    expect((await inviteOf(otherInvite))?.joined?.teamName).toBe("Team 1");
    expect((await teamsIn(t, otherLeague)).map((team) => team.managerEmail)).toEqual([ANN]);
  });
});
