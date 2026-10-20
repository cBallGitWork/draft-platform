import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { refusals } from "./leagueAccess";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  CO_COMMISSIONER,
  MANAGERS,
  addManagers,
  adminCreatesLeague,
  leaguesDeployment,
  resetLeaguesDeployment,
  teamsIn,
  type TestConvex,
} from "./leagues.harness";
import { fakeResend } from "./signIn.harness";

// "Your leagues" (spec/12): what account:signedInAs tells the screens of a person's leagues, and
// #24's Done line end to end.

const [ANN, BOB, CAT, DAN] = MANAGERS;

let t: TestConvex;
beforeEach(async () => {
  t = await leaguesDeployment();
  fakeResend();
});
afterEach(resetLeaguesDeployment);

/** What account:signedInAs tells the screens for `email`. */
const accountOf = async (email: string) => (await (await actingAs(t, email)).query(api.account.signedInAs, {}))!;

describe("a person's leagues", () => {
  test("each league they have a part in, with their roles and their team; in a league, so", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await addManagers(t, leagueId, [ANN, COMMISSIONER]);

    expect(await accountOf(ANN)).toMatchObject({
      inLeague: true,
      leagues: [{ leagueId, name: "Tim Hortons Pro League", roles: ["manager"], teamName: "Team 1", teams: 2, maxTeams: 4 }],
    });
    expect((await accountOf(COMMISSIONER)).leagues).toMatchObject([{ roles: ["commissioner", "manager"], teamName: "Team 2" }]);
  });

  test("a commissioner with no team, and a co-commissioner, are in the league", async () => {
    const leagueId = await adminCreatesLeague(t, 4);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });

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

test("#24 Done: a league of four fills, renames, refuses a duplicate, keeps a left team, and a co-commissioner runs it", async () => {
  const admin = await actingAs(t, ADMIN);
  const leagueId = await admin.mutation(api.leagues.create, { name: "Mini beta", maxTeams: 4, commissionerEmail: COMMISSIONER });
  const commissioner = await actingAs(t, COMMISSIONER);
  await commissioner.mutation(api.leagues.nameCoCommissioner, { leagueId, email: ANN });
  const co = await actingAs(t, ANN);

  const [annsTeam, bobsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await co.mutation(api.teams.addManager, { leagueId, email: CAT });
  await co.mutation(api.teams.addManager, { leagueId, email: DAN });
  await co.mutation(api.teams.rename, { teamId: annsTeam, name: "Red Army" });
  const bob = await actingAs(t, BOB);
  await expect(bob.mutation(api.teams.rename, { teamId: bobsTeam, name: "RED ARMY" })).rejects.toThrow(
    refusals.teamNameTaken("RED ARMY"),
  );
  await bob.mutation(api.teams.leave, { leagueId });
  await expect(co.mutation(api.leagues.nameCommissioner, { leagueId, email: ANN })).rejects.toThrow(refusals.notNamer);

  expect((await teamsIn(t, leagueId)).map(({ name, managerEmail }) => [name, managerEmail])).toEqual([
    ["Red Army", ANN],
    ["Team 2", undefined],
    ["Team 3", CAT],
    ["Team 4", DAN],
  ]);
});
