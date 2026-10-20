import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { askToJoin, invitesPage, lastEmailTo, makeLink, openLastLinkTo, spendTodaysEmails } from "./joining.harness";
import { joiningRefusals } from "./joining";
import { joinPath } from "./joinLinks";
import { refusals } from "./leagueAccess";
import {
  COMMISSIONER,
  MANAGERS,
  actingAs,
  addManagers,
  adminCreatesLeague,
  eventsIn,
  onTheList,
  teamsIn,
  type TestConvex,
} from "./leagues.harness";
import { SITE_URL, UNLISTED, fakeResend, resetSignInDeployment, signInDeployment, type SentEmail } from "./signIn.harness";

// The invite link and join requests (#73 stories 2-4; spec/13 Joining, spec/15 Joining a league).

const [ANN, BOB, CAT] = MANAGERS;

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
let token: string;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  token = await makeLink(t, leagueId);
});
afterEach(resetSignInDeployment);

const joinPageFor = async (email: string, linkToken = token) => (await actingAs(t, email)).query(api.joinRequests.joinPage, { token: linkToken });
const asCommissioner = () => actingAs(t, COMMISSIONER);
const waitingRequests = async () => (await invitesPage(t, leagueId))?.requests.map((request) => request.email);

describe("the invite link", () => {
  test("opened signed in, names the league and lets them ask to join", async () => {
    expect(await joinPageFor(ANN)).toEqual({ leagueName: "Tim Hortons Pro League", standing: "mayAsk" });
  });

  test("lets anyone who opens it sign in, on the list or not, with a link back to it", async () => {
    expect(await t.action(api.inviteLink.signInToJoin, { token, email: UNLISTED })).toBe("checkYourEmail");

    expect(await onTheList(t, UNLISTED)).toBe(true);
    expect(lastEmailTo(sent, UNLISTED).text).toContain(`${SITE_URL}${joinPath(token)}?code=`);
    expect(await openLastLinkTo(t, sent, UNLISTED)).not.toBeNull();
  });

  test("switched off, stops working: its page is gone, and it neither signs anyone in nor takes a request", async () => {
    await (await asCommissioner()).mutation(api.inviteLink.switchOff, { leagueId });

    expect(await joinPageFor(ANN)).toBeNull();
    expect(await t.action(api.inviteLink.signInToJoin, { token, email: UNLISTED })).toBe("linkOff");
    expect(await onTheList(t, UNLISTED)).toBe(false);
    await expect((await actingAs(t, ANN)).mutation(api.joinRequests.ask, { token })).rejects.toThrow(joiningRefusals.linkOff);
    expect((await invitesPage(t, leagueId))?.linkToken).toBeNull();
  });

  test("replaced, the old one stops working and the new one works", async () => {
    const newToken = await makeLink(t, leagueId);

    expect(newToken).not.toBe(token);
    expect(await joinPageFor(ANN)).toBeNull();
    expect((await joinPageFor(ANN, newToken))?.standing).toBe("mayAsk");
  });

  test("making, replacing and switching it off are each filed for Mail", async () => {
    await makeLink(t, leagueId);
    await (await asCommissioner()).mutation(api.inviteLink.switchOff, { leagueId });
    expect((await eventsIn(t, leagueId)).slice(2)).toEqual([
      { by: COMMISSIONER, kind: "inviteLinkMade", replacedOne: false },
      { by: COMMISSIONER, kind: "inviteLinkMade", replacedOne: true },
      { by: COMMISSIONER, kind: "inviteLinkSwitchedOff" },
    ]);
  });

  test("is made and switched off only by the league's runners", async () => {
    await addManagers(t, leagueId, [ANN]);
    const ann = await actingAs(t, ANN);
    await expect(ann.mutation(api.inviteLink.make, { leagueId })).rejects.toThrow(refusals.notRunner);
    await expect(ann.mutation(api.inviteLink.switchOff, { leagueId })).rejects.toThrow(refusals.notRunner);
  });
});

describe("a join request", () => {
  test("waits for the commissioner, and the person sees it waiting", async () => {
    await askToJoin(t, leagueId, token, ANN);
    expect(await waitingRequests()).toEqual([ANN]);
    expect((await joinPageFor(ANN))?.standing).toBe("waiting");
  });

  test("is one at a time: asking again while one waits makes no second", async () => {
    await askToJoin(t, leagueId, token, ANN);
    await askToJoin(t, leagueId, token, ANN);
    expect(await waitingRequests()).toEqual([ANN]);
  });

  test("can't come from someone who already runs a team there", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect((await joinPageFor(ANN))?.standing).toBe("inLeague");
    await expect((await actingAs(t, ANN)).mutation(api.joinRequests.ask, { token })).rejects.toThrow(joiningRefusals.alreadyIn);
  });

  test("approved to a new team makes them its manager, files it for Mail, and emails them", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    await (await asCommissioner()).mutation(api.joinRequests.approve, { requestId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const [team] = await teamsIn(t, leagueId);
    expect(team).toMatchObject({ name: "Team 1", managerEmail: ANN });
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "joinRequestApproved", email: ANN, teamId: team._id, teamName: "Team 1" });
    expect(lastEmailTo(sent, ANN)).toMatchObject({ subject: "You're in Tim Hortons Pro League on Draft Manager" });
    expect(lastEmailTo(sent, ANN).text).toContain("you run Team 1");
    expect(await joinPageFor(ANN)).toEqual({ leagueName: "Tim Hortons Pro League", standing: "inLeague", teamName: "Team 1" });
    expect(await waitingRequests()).toEqual([]);
  });

  test("approved to a vacated team hands them that team", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    await (await asCommissioner()).mutation(api.teams.removeManager, { leagueId, teamId: annsTeam });
    const requestId = await askToJoin(t, leagueId, token, CAT);
    await (await asCommissioner()).mutation(api.joinRequests.approve, { requestId, teamId: annsTeam });

    expect((await teamsIn(t, leagueId)).map((team) => team.managerEmail)).toEqual([CAT, BOB]);
  });

  test("refused, lets no one in, files nothing for Mail, sends nothing, and they may ask again", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    const eventsBefore = await eventsIn(t, leagueId);
    const emailsBefore = sent.length;
    await (await asCommissioner()).mutation(api.joinRequests.refuseRequest, { requestId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await teamsIn(t, leagueId)).toEqual([]);
    expect(await eventsIn(t, leagueId)).toEqual(eventsBefore);
    expect(sent).toHaveLength(emailsBefore);
    expect(await waitingRequests()).toEqual([]);
    expect((await joinPageFor(ANN))?.standing).toBe("mayAsk");
  });

  test("is answered once, and only by the league's runners", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    await addManagers(t, leagueId, [BOB]);
    await expect((await actingAs(t, BOB)).mutation(api.joinRequests.approve, { requestId })).rejects.toThrow(refusals.notRunner);

    await (await asCommissioner()).mutation(api.joinRequests.refuseRequest, { requestId });
    await expect((await asCommissioner()).mutation(api.joinRequests.approve, { requestId })).rejects.toThrow(joiningRefusals.requestDecided);
  });

  test("approved past the day's emails, its email waits for tomorrow and goes then", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    await spendTodaysEmails(t);
    await (await asCommissioner()).mutation(api.joinRequests.approve, { requestId });
    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();
    expect(sent.filter((email) => email.to === ANN)).toEqual([]);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent.filter((email) => email.to === ANN)).toHaveLength(1);
  });
});

describe("the commissioner's page", () => {
  test("shows the teams, whether there's room, the link and the waiting requests", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    await (await asCommissioner()).mutation(api.teams.removeManager, { leagueId, teamId: annsTeam });
    await askToJoin(t, leagueId, token, CAT);

    expect(await invitesPage(t, leagueId)).toMatchObject({
      leagueName: "Tim Hortons Pro League",
      teams: [
        { name: "Team 1", vacated: true },
        { name: "Team 2", vacated: false },
      ],
      hasRoom: true,
      linkToken: token,
      invites: [],
      requests: [{ email: CAT }],
    });
  });

  test("is shown to no one but the league's runners", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect(await invitesPage(t, leagueId, ANN)).toBeNull();
    expect(await t.query(api.invitesPage.page, { leagueId })).toBeNull();
    expect(await t.query(api.invitesPage.page, { leagueId: "not-a-league" })).toBeNull();
  });
});
