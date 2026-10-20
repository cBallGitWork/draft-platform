import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { refusals } from "./leagueAccess";
import { TEAM_NAME_MAX } from "./leagueLimits";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  MANAGERS,
  addManagers,
  adminCreatesLeague,
  eventsIn,
  leaguesDeployment,
  onTheList,
  resetLeaguesDeployment,
  teamsIn,
  type TestConvex,
} from "./leagues.harness";
import { fakeResend } from "./signIn.harness";

// A league's teams, their names and their managers (#24 stories 4, 5 and 7; spec/13).

const [ANN, BOB, CAT, DAN, EVE] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await leaguesDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
});
afterEach(resetLeaguesDeployment);

const teamNames = async () => (await teamsIn(t, leagueId)).map(({ name, managerEmail }) => ({ name, managerEmail }));

describe("adding managers", () => {
  test("each one added makes a team, Team 1 onwards, and is filed for Mail", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);

    expect(await teamNames()).toEqual([
      { name: "Team 1", managerEmail: ANN },
      { name: "Team 2", managerEmail: BOB },
    ]);
    expect((await eventsIn(t, leagueId))[2]).toEqual({ by: COMMISSIONER, kind: "managerAdded", email: ANN, teamId: annsTeam, teamName: "Team 1" });
  });

  test("an added manager is let sign in", async () => {
    await addManagers(t, leagueId, [ANN]);
    expect(await onTheList(t, ANN)).toBe(true);
  });

  test("the commissioner can run a team, joining like anyone", async () => {
    await addManagers(t, leagueId, [COMMISSIONER]);
    expect(await teamNames()).toEqual([{ name: "Team 1", managerEmail: COMMISSIONER }]);
  });

  test("past the maximum, no team is made", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT, DAN]);
    await expect(addManagers(t, leagueId, [EVE])).rejects.toThrow(refusals.full(4));
    expect(await teamNames()).toHaveLength(4);
  });

  test("one manager runs one team in a league", async () => {
    await addManagers(t, leagueId, [ANN]);
    await expect(addManagers(t, leagueId, [ANN])).rejects.toThrow(refusals.alreadyManager(ANN));
  });

  test("a new team skips a Team N that another team took as its name", async () => {
    const [annsTeam] = await addManagers(t, leagueId, [ANN]);
    await (await actingAs(t, ANN)).mutation(api.teams.rename, { teamId: annsTeam, name: "Team 2" });
    await addManagers(t, leagueId, [BOB]);
    expect((await teamNames()).map((team) => team.name)).toEqual(["Team 2", "Team 3"]);
  });

  test("a manager can't add one", async () => {
    await addManagers(t, leagueId, [ANN]);
    const ann = await actingAs(t, ANN);
    await expect(ann.mutation(api.teams.addManager, { leagueId, email: BOB })).rejects.toThrow(refusals.notRunner);
  });
});

describe("renaming a team", () => {
  let annsTeam: Id<"teams">;
  beforeEach(async () => {
    [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  });

  test("its manager renames it, trimmed, and it's filed", async () => {
    await (await actingAs(t, ANN)).mutation(api.teams.rename, { teamId: annsTeam, name: "  Red Army  " });

    expect((await teamNames())[0].name).toBe("Red Army");
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: ANN, kind: "teamRenamed", teamId: annsTeam, from: "Team 1", to: "Red Army" });
  });

  test(`a name of ${TEAM_NAME_MAX} characters is kept, and one longer is refused`, async () => {
    const ann = await actingAs(t, ANN);
    await ann.mutation(api.teams.rename, { teamId: annsTeam, name: "x".repeat(TEAM_NAME_MAX) });
    await expect(ann.mutation(api.teams.rename, { teamId: annsTeam, name: "x".repeat(TEAM_NAME_MAX + 1) })).rejects.toThrow(
      refusals.teamNameTooLong,
    );
    expect((await teamNames())[0].name).toBe("x".repeat(TEAM_NAME_MAX));
  });

  test("a name another team in the league has is refused, whatever its capitals", async () => {
    const ann = await actingAs(t, ANN);
    await expect(ann.mutation(api.teams.rename, { teamId: annsTeam, name: "team 2" })).rejects.toThrow(refusals.teamNameTaken("team 2"));
  });

  test("a name a team in another league has is fine", async () => {
    const otherLeague = await adminCreatesLeague(t, 2, "Other league");
    const [catsTeam] = await addManagers(t, otherLeague, [CAT]);
    await (await actingAs(t, CAT)).mutation(api.teams.rename, { teamId: catsTeam, name: "Red Army" });

    await (await actingAs(t, ANN)).mutation(api.teams.rename, { teamId: annsTeam, name: "Red Army" });
    expect((await teamNames())[0].name).toBe("Red Army");
  });

  test("a blank name is refused", async () => {
    await expect((await actingAs(t, ANN)).mutation(api.teams.rename, { teamId: annsTeam, name: "   " })).rejects.toThrow(
      refusals.blankName,
    );
  });

  test("another manager, or the commissioner, can't rename it; the admin can", async () => {
    for (const email of [BOB, COMMISSIONER]) {
      await expect((await actingAs(t, email)).mutation(api.teams.rename, { teamId: annsTeam, name: "Mine" })).rejects.toThrow(
        refusals.notManager,
      );
    }
    await (await actingAs(t, ADMIN)).mutation(api.teams.rename, { teamId: annsTeam, name: "Admin's pick" });
    expect((await teamNames())[0].name).toBe("Admin's pick");
  });
});

describe("removing and leaving", () => {
  let annsTeam: Id<"teams">;
  beforeEach(async () => {
    [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    await (await actingAs(t, ANN)).mutation(api.teams.rename, { teamId: annsTeam, name: "Red Army" });
  });

  const annsLeagues = async () => (await (await actingAs(t, ANN)).query(api.account.signedInAs, {}))?.leagues;

  test.each([COMMISSIONER, ADMIN])("%s removes a manager: they lose the league at once, and the team stays with its name", async (remover) => {
    await (await actingAs(t, remover)).mutation(api.teams.removeManager, { leagueId, teamId: annsTeam });

    expect(await annsLeagues()).toEqual([]);
    expect((await teamNames())[0]).toEqual({ name: "Red Army", managerEmail: undefined });
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: remover, kind: "managerRemoved", email: ANN, teamId: annsTeam });
    await expect((await actingAs(t, ANN)).mutation(api.teams.rename, { teamId: annsTeam, name: "Back" })).rejects.toThrow(
      refusals.notManager,
    );
  });

  test("a manager leaves: it works like a removal, and is filed", async () => {
    await (await actingAs(t, ANN)).mutation(api.teams.leave, { leagueId });

    expect(await annsLeagues()).toEqual([]);
    expect((await teamNames())[0]).toEqual({ name: "Red Army", managerEmail: undefined });
    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({ by: ANN, kind: "managerLeft", email: ANN, teamId: annsTeam });
  });

  test("someone with no team in the league can't leave it", async () => {
    await expect((await actingAs(t, CAT)).mutation(api.teams.leave, { leagueId })).rejects.toThrow(refusals.runsNoTeam);
  });

  test("a manager can't remove another", async () => {
    await expect((await actingAs(t, BOB)).mutation(api.teams.removeManager, { leagueId, teamId: annsTeam })).rejects.toThrow(
      refusals.notRunner,
    );
  });

  test("a vacated team counts toward the maximum, and can be handed to someone new", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.teams.removeManager, { leagueId, teamId: annsTeam });
    await addManagers(t, leagueId, [CAT, DAN]);
    await expect(addManagers(t, leagueId, [EVE])).rejects.toThrow(refusals.full(4));

    await commissioner.mutation(api.teams.addManager, { leagueId, email: EVE, teamId: annsTeam });
    expect((await teamNames())[0]).toEqual({ name: "Red Army", managerEmail: EVE });
  });

  test("a removed manager can be invited back", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.teams.removeManager, { leagueId, teamId: annsTeam });
    await commissioner.mutation(api.teams.addManager, { leagueId, email: ANN, teamId: annsTeam });

    expect((await annsLeagues())?.map((league) => league.teamName)).toEqual(["Red Army"]);
  });

  test("a team in another league can't be handed on here", async () => {
    const otherLeague = await adminCreatesLeague(t, 2, "Other league");
    const [catsTeam] = await addManagers(t, otherLeague, [CAT]);
    await (await actingAs(t, CAT)).mutation(api.teams.leave, { leagueId: otherLeague });

    await expect(
      (await actingAs(t, COMMISSIONER)).mutation(api.teams.addManager, { leagueId, email: DAN, teamId: catsTeam }),
    ).rejects.toThrow(refusals.noTeam);
  });

  test("removing the manager of a vacated team is refused", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.teams.removeManager, { leagueId, teamId: annsTeam });
    await expect(commissioner.mutation(api.teams.removeManager, { leagueId, teamId: annsTeam })).rejects.toThrow(refusals.noManager);
  });

  test("a team that has a manager can't be handed to another", async () => {
    await expect(
      (await actingAs(t, COMMISSIONER)).mutation(api.teams.addManager, { leagueId, email: CAT, teamId: annsTeam }),
    ).rejects.toThrow(refusals.notVacated);
  });
});
