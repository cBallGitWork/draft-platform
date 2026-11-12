import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  asCommissioner,
  askToJoin,
  emailsTo,
  finishWhatIsDueNow,
  invitesPage,
  joinPageAs,
  lastEmailTo,
  makeLink,
} from "../../support/convex/joining.harness";
import { joiningRefusals } from "../../../convex/joining/joining";
import { ROWS_SHOWN } from "../../../convex/joining/joiningShared";
import { refusals } from "../../../convex/shared/leagueAccess";
import { deletes } from "../../support/convex/leagueDeletion.harness";
import { COMMISSIONER, LEAGUE_NAME, MANAGERS, actingAs, addManagers, adminCreatesLeague, eventsIn, teamsIn, TEST_LEAGUE_TEAMS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment, spendTodaysEmails, type SentEmail } from "../../support/convex/signIn.harness";
import { expectRefused, silenceConsoleError, everyJobRuns } from "../../support/convex/test.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// Join requests and the commissioner's page of them (#73 stories 3 and 4; spec/13 Joining,
// spec/15 Joining a league).

const [ANN, BOB, CAT] = MANAGERS;

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
let token: string;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, TEST_LEAGUE_TEAMS, LEAGUE_NAME);
  token = await makeLink(t, leagueId);
});

const joinPageFor = (email: string) => joinPageAs(t, email, token);
const waitingRequests = async () => (await invitesPage(t, leagueId))?.requests.map((request) => request.email);

describe("a join request", () => {
  test("waits for the commissioner, and the person sees it waiting", async () => {
    await askToJoin(t, leagueId, token, ANN);
    expect(await waitingRequests()).toEqual([ANN]);
    expect(await joinPageFor(ANN)).toEqual({ leagueName: LEAGUE_NAME, commissionerEmail: COMMISSIONER, teams: 0, maxTeams: 4, standing: "waiting" });
  });

  test("is one at a time: asking again while one waits makes no second", async () => {
    await askToJoin(t, leagueId, token, ANN);
    await askToJoin(t, leagueId, token, ANN);
    expect(await waitingRequests()).toEqual([ANN]);
  });

  test("can't come from someone who already runs a team there", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect((await joinPageFor(ANN))?.standing).toBe("inLeague");
    await expectRefused((await actingAs(t, ANN)).mutation(api.joining.joinRequests.ask, { token }), joiningRefusals.alreadyIn);
  });

  test("approved to a new team makes them its manager, files it for Mail, and emails them", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 1, 14, 32));
    const requestId = await askToJoin(t, leagueId, token, ANN);
    await (await asCommissioner(t)).mutation(api.joining.joinRequests.approve, { requestId });
    await everyJobRuns(t);

    const [team] = await teamsIn(t, leagueId);
    expect(team).toMatchObject({ name: teamNumbered(1), managerEmail: ANN });
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "joinRequestApproved", email: ANN, teamId: team._id, teamName: teamNumbered(1) });
    expect(lastEmailTo(sent, ANN)).toMatchObject({ subject: `You're in ${LEAGUE_NAME} on Fantasy Draft Manager, Sunday 1 November at 14:32 GMT` });
    expect(lastEmailTo(sent, ANN).text).toContain("you run Team 1");
    expect(await joinPageFor(ANN)).toEqual({ leagueName: LEAGUE_NAME, commissionerEmail: COMMISSIONER, teams: 1, maxTeams: 4, standing: "inLeague", teamName: teamNumbered(1) });
    expect(await waitingRequests()).toEqual([]);
  });

  test("approved to a vacated team hands them that team", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    await (await asCommissioner(t)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam });
    const requestId = await askToJoin(t, leagueId, token, CAT);
    await (await asCommissioner(t)).mutation(api.joining.joinRequests.approve, { requestId, teamId: annsTeam });

    expect((await teamsIn(t, leagueId)).map((team) => team.managerEmail)).toEqual([CAT, BOB]);
  });

  test("refused, lets no one in, files nothing for Mail, sends nothing, and they may ask again", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    const eventsBefore = await eventsIn(t, leagueId);
    const emailsBefore = sent.length;
    await (await asCommissioner(t)).mutation(api.joining.joinRequests.refuseRequest, { requestId });
    await everyJobRuns(t);

    expect(await teamsIn(t, leagueId)).toEqual([]);
    expect(await eventsIn(t, leagueId)).toEqual(eventsBefore);
    expect(sent).toHaveLength(emailsBefore);
    expect(await waitingRequests()).toEqual([]);
    expect((await joinPageFor(ANN))?.standing).toBe("mayAsk");
  });

  test("is answered once, and only by the league's runners", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    await addManagers(t, leagueId, [BOB]);
    await expectRefused((await actingAs(t, BOB)).mutation(api.joining.joinRequests.approve, { requestId }), refusals.notRunner);

    await (await asCommissioner(t)).mutation(api.joining.joinRequests.refuseRequest, { requestId });
    await expectRefused((await asCommissioner(t)).mutation(api.joining.joinRequests.approve, { requestId }), joiningRefusals.requestDecided);
  });

  test("approved, an email the email service refuses is kept as not sent with what it said", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    fakeResend(500);
    const logged = silenceConsoleError();
    await (await asCommissioner(t)).mutation(api.joining.joinRequests.approve, { requestId });
    await everyJobRuns(t);

    const request = await t.run((ctx) => ctx.db.get("joinRequests", requestId));
    expect(request).toMatchObject({ approvedEmail: "notSent", approvedEmailError: "Resend refused the email (500): refused" });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(`The email telling ${ANN} they're in ${LEAGUE_NAME} wasn't sent`));
  });

  test("approved, an email that went is never kept or logged as not sent when saving that it went fails", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    const resend = vi.mocked(fetch);
    const send = resend.getMockImplementation()!;
    // the email service takes it, then the request is gone, so saving "sent" fails
    resend.mockImplementationOnce(async (...call) => {
      const response = await send(...call);
      await t.run((ctx) => ctx.db.delete("joinRequests", requestId));
      return response;
    });
    const logged = silenceConsoleError();
    await (await asCommissioner(t)).mutation(api.joining.joinRequests.approve, { requestId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(emailsTo(sent, ANN)).toHaveLength(1);
    expect(logged).not.toHaveBeenCalledWith(expect.stringContaining("wasn't sent"));
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.find((job) => job.name.includes("sendApprovedEmail"))?.state.kind).toBe("failed");
  });

  test("approved past the day's emails, its email waits for tomorrow and goes then", async () => {
    const requestId = await askToJoin(t, leagueId, token, ANN);
    await spendTodaysEmails(t);
    await (await asCommissioner(t)).mutation(api.joining.joinRequests.approve, { requestId });
    await finishWhatIsDueNow(t);
    expect(emailsTo(sent, ANN)).toEqual([]);

    await everyJobRuns(t);
    expect(emailsTo(sent, ANN)).toHaveLength(1);
  });
});

describe("the commissioner's page", () => {
  test("shows the teams, whether there's room, the link and the waiting requests", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    await (await asCommissioner(t)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam });
    await askToJoin(t, leagueId, token, CAT);

    expect(await invitesPage(t, leagueId)).toMatchObject({
      leagueName: LEAGUE_NAME,
      teams: [
        { name: teamNumbered(1), managerEmail: null },
        { name: teamNumbered(2), managerEmail: BOB },
      ],
      hasRoom: true,
      linkToken: token,
      invites: [],
      invitesCut: false,
      requests: [{ email: CAT }],
      requestsCut: false,
    });
  });

  test("says when more requests wait than it lists, and not at exactly the most it lists (#410)", async () => {
    const addWaiting = (count: number, from: number) =>
      t.run(async (ctx) => {
        for (let n = from; n < from + count; n++) await ctx.db.insert("joinRequests", { leagueId, email: `asker${n}@example.com` });
      });

    await addWaiting(ROWS_SHOWN, 0);
    expect((await invitesPage(t, leagueId))?.requestsCut).toBe(false);

    await addWaiting(1, ROWS_SHOWN);
    const page = await invitesPage(t, leagueId);
    expect(page?.requestsCut).toBe(true);
    expect(page?.requests).toHaveLength(ROWS_SHOWN);
    expect(page?.requests[0]?.email).toBe(`asker${ROWS_SHOWN}@example.com`);
  });

  test("is shown to no one but the league's runners", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect(await invitesPage(t, leagueId, ANN)).toBeNull();
    expect(await t.query(api.joining.invitesPage.page, { leagueId })).toBeNull();
    expect(await t.query(api.joining.invitesPage.page, { leagueId: "not-a-league" })).toBeNull();
  });
});

describe("the join page of a league being deleted (spec/13 Deleting)", () => {
  beforeEach(async () => {
    await addManagers(t, leagueId, [BOB]);
    await deletes(t, COMMISSIONER, leagueId);
  });

  test("is the switched-off link to everyone, signed out, new or already in", async () => {
    expect(await t.query(api.joining.joinRequests.joinPage, { token })).toBeNull();
    expect(await joinPageFor(ANN)).toBeNull();
    expect(await joinPageFor(BOB)).toBeNull();
  });

  test("offers asking to join again once the deletion is undone", async () => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId });
    expect(await t.query(api.joining.joinRequests.joinPage, { token })).toEqual({ leagueName: LEAGUE_NAME, commissionerEmail: null, teams: 1, maxTeams: 4, standing: "mayAsk" });
    expect((await joinPageFor(ANN))?.standing).toBe("mayAsk");
    expect((await joinPageFor(BOB))?.standing).toBe("inLeague");
  });
});
