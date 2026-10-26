import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  asCommissioner,
  emailsTo,
  finishWhatIsDueNow,
  invite,
  invitesPage,
  lastEmailTo,
  openLastLinkTo,
} from "../../support/convex/joining.harness";
import { joiningRefusals } from "../../../convex/joining/joining";
import { INVITE_LIFETIME_MS, invitedPath } from "../../../convex/joining/joiningShared";
import { ROWS_SHOWN } from "../../../convex/joining/invitesPage";
import { refusals } from "../../../convex/shared/leagueAccess";
import {
  COMMISSIONER,
  LEAGUE_NAME,
  MANAGERS,
  actingAs,
  addManager,
  addManagers,
  adminCreatesLeague,
  eventsIn,
  onTheList,
  teamsIn,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import {
  SITE_URL,
  ask,
  fakeResend,
  signInDeployment,
  spendTodaysEmails,
  type SentEmail,
} from "../../support/convex/signIn.harness";
import { DAY_MS } from "../../../convex/shared/time";

// Emailed invites (#73 stories 1 and 5; spec/13, Joining).

const [ANN, BOB, CAT, DAN, EVE] = MANAGERS;

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
});

const managers = async () => (await teamsIn(t, leagueId)).map(({ name, managerEmail }) => ({ name, managerEmail }));
const inviteRow = async (inviteId: Id<"invites">) => (await invitesPage(t, leagueId))?.invites.find((row) => row.inviteId === inviteId);

describe("an invite", () => {
  test("to a new team is emailed with a sign-in link, and opening it makes them its manager with no approval", async () => {
    const inviteId = await invite(t, leagueId, ANN);

    const email = lastEmailTo(sent, ANN);
    expect(email.subject).toBe("You're invited to Tim Hortons Pro League on Draft Manager");
    expect(email.text).toContain(`${COMMISSIONER} has invited you to run a new team in ${LEAGUE_NAME}`);
    expect(email.text).toContain(`${SITE_URL}${invitedPath(inviteId)}?code=`);
    expect(await openLastLinkTo(t, sent, ANN)).not.toBeNull();

    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: ANN }]);
    expect((await inviteRow(inviteId))?.joinedTeamName).toBe("Team 1");
  });

  test("to a vacated team names it, and hands them that team", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    await (await asCommissioner(t)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam });

    await invite(t, leagueId, CAT, annsTeam);
    expect(lastEmailTo(sent, CAT).text).toContain(`has invited you to run Team 1 in ${LEAGUE_NAME}`);
    await openLastLinkTo(t, sent, CAT);

    expect(await managers()).toEqual([
      { name: "Team 1", managerEmail: CAT },
      { name: "Team 2", managerEmail: BOB },
    ]);
  });

  test("puts the email on the allowed list, so they can ask for a new link after the first expires", async () => {
    await invite(t, leagueId, ANN);
    expect(await onTheList(t, ANN)).toBe(true);

    vi.advanceTimersByTime(2 * DAY_MS);
    expect(await ask(t, ANN)).toBe("checkYourEmail");
    await openLastLinkTo(t, sent, ANN);
    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: ANN }]);
  });

  test("is taken up once: removed later, signing in again doesn't bring them back", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await openLastLinkTo(t, sent, ANN);
    const [annsTeam] = await teamsIn(t, leagueId);
    await (await asCommissioner(t)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam._id });
    await ask(t, ANN);
    await openLastLinkTo(t, sent, ANN);

    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: undefined }]);
    expect(await inviteRow(inviteId)).toMatchObject({ joinedTeamName: "Team 1", couldNotJoin: null });
  });

  test("files for Mail who invited whom to which team, and who joined it", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await (await asCommissioner(t)).mutation(api.joining.invites.resend, { inviteId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await openLastLinkTo(t, sent, ANN);
    const teamId = (await teamsIn(t, leagueId))[0]._id;

    expect((await eventsIn(t, leagueId)).slice(2)).toEqual([
      { by: COMMISSIONER, kind: "invited", email: ANN, teamId: null, teamName: null },
      { by: COMMISSIONER, kind: "inviteResent", email: ANN, teamId: null, teamName: null },
      { by: ANN, kind: "joinedByInvite", email: ANN, teamId, teamName: "Team 1", invitedBy: COMMISSIONER },
    ]);
  });
});

describe("how long an invite lasts", () => {
  test("seven days: signing in after that joins nothing", async () => {
    await invite(t, leagueId, ANN);
    vi.advanceTimersByTime(INVITE_LIFETIME_MS + 1);
    await ask(t, ANN);
    expect(await openLastLinkTo(t, sent, ANN)).not.toBeNull();
    expect(await managers()).toEqual([]);
  });

  test("resending sends it again, for seven more days from then", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    vi.advanceTimersByTime(INVITE_LIFETIME_MS + 1);
    await (await asCommissioner(t)).mutation(api.joining.invites.resend, { inviteId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(emailsTo(sent, ANN)).toHaveLength(2);
    expect((await inviteRow(inviteId))?.expiresAt).toBe(Date.now() + INVITE_LIFETIME_MS);
    await openLastLinkTo(t, sent, ANN);
    expect(await managers()).toEqual([{ name: "Team 1", managerEmail: ANN }]);
  });

  test("cancelled, it lets no one in, is filed for Mail, and leaves the page", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await (await asCommissioner(t)).mutation(api.joining.invites.cancel, { inviteId });
    await openLastLinkTo(t, sent, ANN);

    expect(await managers()).toEqual([]);
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "inviteCancelled", email: ANN, teamId: null, teamName: null });
    expect(await inviteRow(inviteId)).toBeUndefined();
    await expect((await asCommissioner(t)).mutation(api.joining.invites.resend, { inviteId })).rejects.toThrow(joiningRefusals.inviteEnded);
  });
});

describe("the invites page", () => {
  test("lists an older live invite behind a page's worth of cancelled ones made after it (#143)", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await t.run(async (ctx) => {
      for (let n = 0; n < ROWS_SHOWN; n++) {
        await ctx.db.insert("invites", {
          leagueId,
          email: `cancelled${n}@example.com`,
          invitedBy: COMMISSIONER,
          expiresAt: Date.now() + INVITE_LIFETIME_MS,
          delivery: "sent",
          cancelledAt: Date.now(),
        });
      }
    });

    expect((await invitesPage(t, leagueId))?.invites.map((row) => row.inviteId)).toEqual([inviteId]);
  });
});

describe("who can be invited", () => {
  test("only by the league's runners", async () => {
    await addManagers(t, leagueId, [ANN]);
    const ann = await actingAs(t, ANN);
    await expect(ann.mutation(api.joining.invites.send, { leagueId, email: BOB })).rejects.toThrow(refusals.notRunner);
  });

  test("not someone who already runs a team there, nor someone with a live invite there", async () => {
    await addManagers(t, leagueId, [ANN]);
    await invite(t, leagueId, BOB);
    const commissioner = await asCommissioner(t);
    await expect(commissioner.mutation(api.joining.invites.send, { leagueId, email: ANN })).rejects.toThrow(refusals.alreadyManager(ANN));
    await expect(commissioner.mutation(api.joining.invites.send, { leagueId, email: BOB })).rejects.toThrow(joiningRefusals.alreadyInvited(BOB));
  });

  test("not to a team that has a manager, nor to a new team in a full league", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
    const commissioner = await asCommissioner(t);
    await expect(commissioner.mutation(api.joining.invites.send, { leagueId, email: EVE, teamId: annsTeam })).rejects.toThrow(refusals.notVacated);
    await expect(commissioner.mutation(api.joining.invites.send, { leagueId, email: EVE })).rejects.toThrow(refusals.full(4));
  });

  test("an invite refuses whoever adding them as a manager would, in the same words", async () => {
    const otherLeague = await adminCreatesLeague(t, 2, "Other league");
    const [catsTeam] = await addManagers(t, otherLeague, [CAT]);
    await (await actingAs(t, CAT)).mutation(api.leagues.teams.leave, { leagueId: otherLeague });
    const [annsTeam] = await addManagers(t, leagueId, [ANN]);
    const commissioner = await asCommissioner(t);
    const refusalOf = (sending: Promise<unknown>) => sending.then(() => null, (error: { data?: unknown }) => error.data);
    const bothRefuse = async (args: { email: string; teamId?: Id<"teams"> }) => [
      await refusalOf(commissioner.mutation(api.joining.invites.send, { leagueId, ...args })),
      await refusalOf(addManager(t, leagueId, args.email, args.teamId)),
    ];

    expect(await bothRefuse({ email: ANN })).toEqual([refusals.alreadyManager(ANN), refusals.alreadyManager(ANN)]);
    expect(await bothRefuse({ email: EVE, teamId: catsTeam })).toEqual([refusals.noTeam, refusals.noTeam]);
    expect(await bothRefuse({ email: EVE, teamId: annsTeam })).toEqual([refusals.notVacated, refusals.notVacated]);
    await addManagers(t, leagueId, [BOB, CAT, DAN]);
    expect(await bothRefuse({ email: EVE })).toEqual([refusals.full(4), refusals.full(4)]);
  });

  test("when the league filled before they signed in, they still sign in, and the invite says why they didn't join", async () => {
    const inviteId = await invite(t, leagueId, EVE);
    await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);

    expect(await openLastLinkTo(t, sent, EVE)).not.toBeNull();
    expect((await inviteRow(inviteId))?.couldNotJoin).toBe(refusals.full(4));
  });
});

describe("past the day's emails (spec/13)", () => {
  test("an invite waits for tomorrow, the commissioner's page says so, and it goes then by itself", async () => {
    await spendTodaysEmails(t);
    const inviteId = await (await asCommissioner(t)).mutation(api.joining.invites.send, { leagueId, email: ANN });
    await finishWhatIsDueNow(t);

    expect((await inviteRow(inviteId))?.delivery).toBe("waiting");
    expect(emailsTo(sent, ANN)).toEqual([]);
    await expect((await asCommissioner(t)).mutation(api.joining.invites.resend, { inviteId })).rejects.toThrow(joiningRefusals.inviteWaiting);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(new Date(Date.now()).toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect((await inviteRow(inviteId))?.delivery).toBe("sent");
    expect(emailsTo(sent, ANN)).toHaveLength(1);
  });
});
