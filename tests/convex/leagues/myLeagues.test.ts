import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { refusals } from "../../../convex/shared/leagueAccess";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  CO_COMMISSIONER,
  LEAGUE_NAME,
  MANAGERS,
  addManagers,
  adminCreatesLeague,
  leagueRow,
  teamsIn,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import { ask, fakeResend, linkCode, linkNotSentLine, openLink, signInDeployment } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// "Your leagues" (spec/12): what signIn/account:signedInAs tells the screens of a person's leagues, and
// #24's Done line end to end.

const [ANN, BOB, CAT, DAN] = MANAGERS;

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

/** What signIn/account:signedInAs tells the screens for `email`. */
const accountOf = async (email: string) => (await (await actingAs(t, email)).query(api.signIn.account.signedInAs, {}))!;

describe("a person's leagues", () => {
  test("lists each league they have a part in, with their roles and team, and says they're in a league", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await addManagers(t, leagueId, [ANN, COMMISSIONER]);

    expect(await accountOf(ANN)).toMatchObject({
      inLeague: true,
      leagues: [{ leagueId, name: LEAGUE_NAME, roles: ["manager"], teamName: "Team 1", teams: 2, maxTeams: 4 }],
    });
    expect((await accountOf(COMMISSIONER)).leagues).toMatchObject([{ roles: ["commissioner", "manager"], teamName: "Team 2" }]);
  });

  test("a commissioner with no team, and a co-commissioner, are in the league", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });

    expect(await accountOf(COMMISSIONER)).toMatchObject({ inLeague: true, leagues: [{ roles: ["commissioner"], teamName: null }] });
    expect(await accountOf(CO_COMMISSIONER)).toMatchObject({ inLeague: true, leagues: [{ roles: ["co-commissioner"] }] });
  });

  test("someone with no part in any league is in none", async () => {
    await adminCreatesLeague(t, 4);
    expect(await accountOf(ANN)).toMatchObject({ inLeague: false, leagues: [] });
  });

  test("the admin sees every league, by name, with no part in them, and so is in none", async () => {
    await adminCreatesLeague(t, 4, "Second");
    await adminCreatesLeague(t, 2, "First");

    const admin = await accountOf(ADMIN);
    expect(admin.inLeague).toBe(false);
    expect(admin.leagues.map(({ name, roles, unsentCommissionerLink }) => ({ name, roles, unsentCommissionerLink }))).toEqual([
      { name: "First", roles: [], unsentCommissionerLink: null },
      { name: "Second", roles: [], unsentCommissionerLink: null },
    ]);
  });
});

describe("a commissioner's sign-in link that didn't go", () => {
  beforeEach(() => fakeResend(500));

  test("is kept on the league for the admin, and only him, to see", async () => {
    const logged = silenceConsoleError();
    const leagueId = await adminCreatesLeague(t);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(linkNotSentLine(COMMISSIONER)));

    const [summary] = (await accountOf(ADMIN)).leagues;
    expect(summary).toMatchObject({ leagueId, unsentCommissionerLink: { email: COMMISSIONER, reply: "notSent" } });
    const [commissionersSummary] = (await accountOf(COMMISSIONER)).leagues;
    expect(commissionersSummary.unsentCommissionerLink).toBeNull();
  });

  test("no longer shows once the commissioner signs in some other way", async () => {
    const logged = silenceConsoleError();
    await adminCreatesLeague(t);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(linkNotSentLine(COMMISSIONER)));
    const sent = fakeResend();
    await ask(t, COMMISSIONER);
    await openLink(t, linkCode(sent[0]));

    const [summary] = (await accountOf(ADMIN)).leagues;
    expect(summary.unsentCommissionerLink).toBeNull();
  });

  test("isn't kept when it comes back after another commissioner was named", async () => {
    const logged = silenceConsoleError();
    const admin = await actingAs(t, ADMIN);
    const leagueId = await admin.mutation(api.leagues.leagues.create, { name: "L", maxTeams: 4, commissionerEmail: ANN });
    await admin.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: COMMISSIONER });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(linkNotSentLine(ANN)));
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(linkNotSentLine(COMMISSIONER)));
    // Ann's link, sent first, is the last to answer.
    await t.mutation(internal.leagues.leagues.recordCommissionerLink, { leagueId, email: ANN, reply: "notSent" });

    expect((await leagueRow(t, leagueId))?.commissionerLink).toEqual({ email: COMMISSIONER, reply: "notSent" });
  });
});

test("#24 Done: a league of four fills, renames, refuses a duplicate, keeps a left team, and a co-commissioner runs it", async () => {
  const admin = await actingAs(t, ADMIN);
  const leagueId = await admin.mutation(api.leagues.leagues.create, { name: "Mini beta", maxTeams: 4, commissionerEmail: COMMISSIONER });
  const commissioner = await actingAs(t, COMMISSIONER);
  await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: ANN });
  const co = await actingAs(t, ANN);

  const [annsTeam, bobsTeam] = await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
  await co.mutation(api.leagues.teams.rename, { teamId: annsTeam, name: "Red Army" });
  const bob = await actingAs(t, BOB);
  await expect(bob.mutation(api.leagues.teams.rename, { teamId: bobsTeam, name: "RED ARMY" })).rejects.toThrow(
    refusals.teamNameTaken("RED ARMY"),
  );
  await bob.mutation(api.leagues.teams.leave, { leagueId });
  await expect(co.mutation(api.leagues.leagues.nameCommissioner, { leagueId, email: ANN })).rejects.toThrow(refusals.notNamer);

  expect((await teamsIn(t, leagueId)).map(({ name, managerEmail }) => [name, managerEmail])).toEqual([
    ["Red Army", ANN],
    ["Team 2", undefined],
    ["Team 3", CAT],
    ["Team 4", DAN],
  ]);
});
