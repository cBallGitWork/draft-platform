import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { INVITES_TO_ONE_EMAIL_READ } from "../../../convex/joining/invites";
import { INVITE_LIFETIME_MS } from "../../../convex/joining/joiningShared";
import { refusals } from "../../../convex/shared/leagueAccess";
import { asCommissioner, invite, openLastLinkTo } from "../../support/convex/joining.harness";
import { deletes } from "../../support/convex/leagueDeletion.harness";
import { COMMISSIONER, LEAGUE_NAME, MANAGERS, actingAs, addManagers, adminCreatesLeague, teamsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { ask, fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";

// What became of an invite that let someone sign in but not join (spec/13, Joining): "Your invite
// to <league> expired / was cancelled / couldn't be used: <reason>" (Craig, 22 Oct 2026).

const [ANN, BOB, CAT, DAN, EVE] = MANAGERS;

let t: TestConvex;
let sent: SentEmail[];
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
});

/** What `email`'s leagues page is told of their newest invite, at the minute it is now. */
const endedInviteOf = async (email: string) => (await actingAs(t, email)).query(api.joining.endedInvite.mine, { now: Date.now() });

describe("an invite that ended without them joining", () => {
  test("expired before they signed in", async () => {
    await invite(t, leagueId, ANN);
    vi.advanceTimersByTime(INVITE_LIFETIME_MS + 1);
    await ask(t, ANN);
    await openLastLinkTo(t, sent, ANN);

    expect(await endedInviteOf(ANN)).toEqual({ leagueName: LEAGUE_NAME, ended: "expired", reason: null });
  });

  test("was cancelled", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await (await asCommissioner(t)).mutation(api.joining.invites.cancel, { inviteId });
    await openLastLinkTo(t, sent, ANN);

    expect(await endedInviteOf(ANN)).toEqual({ leagueName: LEAGUE_NAME, ended: "cancelled", reason: null });
  });

  test("couldn't be used, saying why in the refusal's words", async () => {
    await invite(t, leagueId, EVE);
    await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
    await openLastLinkTo(t, sent, EVE);

    expect(await endedInviteOf(EVE)).toEqual({ leagueName: LEAGUE_NAME, ended: "couldNotJoin", reason: refusals.full(4) });
  });

  test("only the newest invite is told of", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await (await asCommissioner(t)).mutation(api.joining.invites.cancel, { inviteId });
    const other = await adminCreatesLeague(t, 4, "Other league");
    await invite(t, other, ANN);
    vi.advanceTimersByTime(INVITE_LIFETIME_MS + 1);

    expect(await endedInviteOf(ANN)).toEqual({ leagueName: "Other league", ended: "expired", reason: null });
  });
});

describe("nothing to tell", () => {
  test("with no invite", async () => {
    expect(await endedInviteOf(ANN)).toBeNull();
  });

  test("while the invite is live", async () => {
    await invite(t, leagueId, ANN);
    expect(await endedInviteOf(ANN)).toBeNull();
  });

  test("once they joined by it, even if they were removed after", async () => {
    await invite(t, leagueId, ANN);
    await openLastLinkTo(t, sent, ANN);
    const [annsTeam] = await teamsIn(t, leagueId);
    await (await asCommissioner(t)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam._id });

    expect(await endedInviteOf(ANN)).toBeNull();
  });

  test("when its league is being deleted, so hidden from them", async () => {
    const inviteId = await invite(t, leagueId, ANN);
    await (await asCommissioner(t)).mutation(api.joining.invites.cancel, { inviteId });
    await deletes(t, COMMISSIONER, leagueId);

    expect(await endedInviteOf(ANN)).toBeNull();
  });

  test("reading as many invites as it reads at once says so, so the older ones aren't ignored silently", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await t.run(async (ctx) => {
      for (let i = 0; i < INVITES_TO_ONE_EMAIL_READ; i += 1) {
        await ctx.db.insert("invites", { leagueId, email: ANN, invitedBy: COMMISSIONER, expiresAt: Date.now() + i, delivery: "sent" });
      }
    });

    await endedInviteOf(ANN);
    expect(warn).toHaveBeenCalledWith(`${ANN} has ${INVITES_TO_ONE_EMAIL_READ} or more invites: only ${INVITES_TO_ONE_EMAIL_READ} were read`);
  });

  test("signed out", async () => {
    expect(await t.query(api.joining.endedInvite.mine, { now: Date.now() })).toBeNull();
  });
});
