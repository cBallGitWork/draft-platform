import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { FEWEST_TEAMS, MOST_TEAMS } from "../../../convex/leagues/leagueLimits";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  CO_COMMISSIONER,
  MANAGERS,
  addManagers,
  adminCreatesLeague,
  eventsIn,
  leagueRow,
  onTheList,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import { LISTED, fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// Creating a league and who runs it (#24 stories 1-3 and 6; spec/13).

/** Maximums a league can't have: too few teams, too many, and not a whole number. */
const OUT_OF_RANGE = [FEWEST_TEAMS - 1, MOST_TEAMS + 1, 2.5];

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});

describe("creating a league", () => {
  test("the admin creates one with its name, maximum and commissioner, and it's filed for Mail", async () => {
    fakeResend();
    const leagueId = await adminCreatesLeague(t, 4);

    expect(await leagueRow(t, leagueId)).toMatchObject({ name: "Tim Hortons Pro League", maxTeams: 4, commissionerEmail: COMMISSIONER });
    expect(await eventsIn(t, leagueId)).toEqual([
      { by: ADMIN, kind: "created", name: "Tim Hortons Pro League", maxTeams: 4 },
      { by: ADMIN, kind: "commissionerNamed", email: COMMISSIONER, replaced: null },
    ]);
  });

  test("a commissioner with no account is put on the allowed list and sent a sign-in link", async () => {
    const sent = fakeResend();
    const leagueId = await adminCreatesLeague(t);

    expect(await onTheList(t, COMMISSIONER)).toBe(true);
    expect(sent.map((email) => email.to)).toEqual([COMMISSIONER]);
    expect((await leagueRow(t, leagueId))?.commissionerLink).toEqual({ email: COMMISSIONER, reply: "checkYourEmail" });
  });

  test("a commissioner who has signed in before is sent no link", async () => {
    const sent = fakeResend();
    await actingAs(t, COMMISSIONER);
    await adminCreatesLeague(t);

    expect(sent).toEqual([]);
  });

  test("a commissioner whose only account is from a link that didn't go is sent one", async () => {
    fakeResend(500);
    const logged = silenceConsoleError();
    await adminCreatesLeague(t, 4, "First");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(`The sign-in link to ${COMMISSIONER} wasn't sent`));
    const account = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", COMMISSIONER))
        .unique(),
    );
    expect(account).not.toBeNull();
    expect(account?.emailVerificationTime).toBeUndefined();

    const sent = fakeResend();
    await adminCreatesLeague(t, 4, "Second");
    expect(sent.map((email) => email.to)).toEqual([COMMISSIONER]);
  });

  test("the commissioner's email is stored trimmed and lower-cased, as every email is", async () => {
    fakeResend();
    const admin = await actingAs(t, ADMIN);
    const leagueId = await admin.mutation(api.leagues.leagues.create, { name: "L", maxTeams: 2, commissionerEmail: " Commish@Example.com " });
    expect((await leagueRow(t, leagueId))?.commissionerEmail).toBe(COMMISSIONER);
  });

  test("nobody but the admin can create one", async () => {
    const manager = await actingAs(t, LISTED);
    await expect(manager.mutation(api.leagues.leagues.create, { name: "L", maxTeams: 4, commissionerEmail: COMMISSIONER })).rejects.toThrow(
      refusals.notAdmin,
    );
    await expect(t.mutation(api.leagues.leagues.create, { name: "L", maxTeams: 4, commissionerEmail: COMMISSIONER })).rejects.toThrow(
      refusals.signedOut,
    );
  });

  test.each(OUT_OF_RANGE)("a maximum of %s teams is refused", async (maxTeams) => {
    const admin = await actingAs(t, ADMIN);
    await expect(admin.mutation(api.leagues.leagues.create, { name: "L", maxTeams, commissionerEmail: COMMISSIONER })).rejects.toThrow(
      refusals.maxOutOfRange,
    );
  });

  test("a blank name or a commissioner who isn't an email is refused", async () => {
    const admin = await actingAs(t, ADMIN);
    await expect(admin.mutation(api.leagues.leagues.create, { name: "  ", maxTeams: 4, commissionerEmail: COMMISSIONER })).rejects.toThrow(
      refusals.blankName,
    );
    await expect(admin.mutation(api.leagues.leagues.create, { name: "L", maxTeams: 4, commissionerEmail: "commish" })).rejects.toThrow(
      refusals.notEmail("commish"),
    );
  });
});

describe("the maximum", () => {
  let leagueId: Id<"leagues">;
  beforeEach(async () => {
    fakeResend();
    leagueId = await adminCreatesLeague(t, 4);
  });

  test("the commissioner raises and lowers it, and each change is filed", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: MOST_TEAMS });
    await commissioner.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 2 });

    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(2);
    expect((await eventsIn(t, leagueId)).slice(2)).toEqual([
      { by: COMMISSIONER, kind: "maxTeamsChanged", from: 4, to: MOST_TEAMS },
      { by: COMMISSIONER, kind: "maxTeamsChanged", from: MOST_TEAMS, to: 2 },
    ]);
  });

  test("it never goes below the teams already there, vacated ones included", async () => {
    const [, , teamId] = await addManagers(t, leagueId, MANAGERS.slice(0, 3));
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.teams.removeManager, { leagueId, teamId });

    await expect(commissioner.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 2 })).rejects.toThrow(refusals.belowTeams(3));
    await commissioner.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 3 });
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(3);
  });

  test("a manager can't change it", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    const manager = await actingAs(t, MANAGERS[0]);
    await expect(manager.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 6 })).rejects.toThrow(refusals.notRunner);
  });

  test.each(OUT_OF_RANGE)("the commissioner can't set it out of range, to %s", async (maxTeams) => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await expect(commissioner.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams })).rejects.toThrow(refusals.maxOutOfRange);
    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(4);
  });
});

describe("the co-commissioner", () => {
  let leagueId: Id<"leagues">;
  beforeEach(async () => {
    fakeResend();
    leagueId = await adminCreatesLeague(t, 4);
  });

  test.each([COMMISSIONER, ADMIN])("%s names one, who is let sign in, and it's filed", async (namer) => {
    const asNamer = await actingAs(t, namer);
    await asNamer.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });

    expect((await leagueRow(t, leagueId))?.coCommissionerEmail).toBe(CO_COMMISSIONER);
    expect(await onTheList(t, CO_COMMISSIONER)).toBe(true);
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({
      by: namer,
      kind: "coCommissionerNamed",
      email: CO_COMMISSIONER,
      replaced: null,
    });
  });

  test("naming another replaces them, and the filing says whom it replaced", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: MANAGERS[0] });

    expect((await leagueRow(t, leagueId))?.coCommissionerEmail).toBe(MANAGERS[0]);
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({
      by: COMMISSIONER,
      kind: "coCommissionerNamed",
      email: MANAGERS[0],
      replaced: CO_COMMISSIONER,
    });
  });

  test("the commissioner removes them, and the filing says who was removed", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: null });

    expect((await leagueRow(t, leagueId))?.coCommissionerEmail).toBeUndefined();
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: COMMISSIONER, kind: "coCommissionerRemoved", email: CO_COMMISSIONER });
  });

  test("removing a co-commissioner the league doesn't have files nothing", async () => {
    const before = await eventsIn(t, leagueId);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: null });
    expect(await eventsIn(t, leagueId)).toEqual(before);
  });

  test("they can do what the commissioner can: change the maximum, add and remove managers", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    const co = await actingAs(t, CO_COMMISSIONER);

    await co.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 6 });
    const teamId = await co.mutation(api.leagues.teams.addManager, { leagueId, email: MANAGERS[0] });
    await co.mutation(api.leagues.teams.removeManager, { leagueId, teamId });

    expect((await leagueRow(t, leagueId))?.maxTeams).toBe(6);
    expect((await eventsIn(t, leagueId)).slice(-2).map((event) => [event.by, event.kind])).toEqual([
      [CO_COMMISSIONER, "managerAdded"],
      [CO_COMMISSIONER, "managerRemoved"],
    ]);
  });

  test("they can't name or remove a commissioner or a co-commissioner", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    const co = await actingAs(t, CO_COMMISSIONER);

    await expect(co.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: MANAGERS[0] })).rejects.toThrow(refusals.notNamer);
    await expect(co.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: MANAGERS[0] })).rejects.toThrow(refusals.notNamer);
    await expect(co.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: null })).rejects.toThrow(refusals.notNamer);
    expect(await leagueRow(t, leagueId)).toMatchObject({ commissionerEmail: COMMISSIONER, coCommissionerEmail: CO_COMMISSIONER });
  });

  test("the commissioner can't also be the co-commissioner", async () => {
    const admin = await actingAs(t, ADMIN);
    await expect(admin.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: COMMISSIONER })).rejects.toThrow(
      refusals.alreadyCommissioner(COMMISSIONER),
    );
  });
});

describe("naming a new commissioner", () => {
  let leagueId: Id<"leagues">;
  beforeEach(async () => {
    fakeResend();
    leagueId = await adminCreatesLeague(t, 4);
  });

  test("the commissioner hands the league on; it's filed with whom it replaced, the new one is sent a link, and the old one runs it no more", async () => {
    const sent = fakeResend();
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: MANAGERS[0] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent.map((email) => email.to)).toEqual([MANAGERS[0]]);
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({
      by: COMMISSIONER,
      kind: "commissionerNamed",
      email: MANAGERS[0],
      replaced: COMMISSIONER,
    });
    await expect(commissioner.mutation(api.leagues.leagues.setMaxTeams, { leagueId, maxTeams: 6 })).rejects.toThrow(refusals.notRunner);
  });

  test("naming the commissioner again, or the co-commissioner, is refused", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });

    await expect(commissioner.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: COMMISSIONER })).rejects.toThrow(
      refusals.alreadyCommissioner(COMMISSIONER),
    );
    await expect(commissioner.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: CO_COMMISSIONER })).rejects.toThrow(
      refusals.alreadyCoCommissioner(CO_COMMISSIONER),
    );
    expect((await leagueRow(t, leagueId))?.commissionerEmail).toBe(COMMISSIONER);
  });

  test("a link that didn't go to the last commissioner no longer shows once another is named", async () => {
    fakeResend(500);
    const logged = silenceConsoleError();
    const admin = await actingAs(t, ADMIN);
    const unreached = "unreached@example.com";
    const failedLeague = await admin.mutation(api.leagues.leagues.create, { name: "Failed link", maxTeams: 4, commissionerEmail: unreached });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(`The sign-in link to ${unreached} wasn't sent`));
    expect((await leagueRow(t, failedLeague))?.commissionerLink).toEqual({ email: unreached, reply: "notSent" });

    await admin.mutation(api.leagues.leagues.nameCommissioner, { leagueId: failedLeague, email: COMMISSIONER });
    expect((await leagueRow(t, failedLeague))?.commissionerLink).toBeUndefined();
  });

  test("a manager can't name one", async () => {
    await addManagers(t, leagueId, [MANAGERS[0]]);
    const manager = await actingAs(t, MANAGERS[0]);
    await expect(manager.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: MANAGERS[0] })).rejects.toThrow(refusals.notNamer);
  });
});
