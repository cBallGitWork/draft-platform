import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { TEAM_COLOURS } from "../../../convex/leagues/teamColours";
import { ANN, BOB, CAT, addManagers, freshLeague, teamsIn, type TestConvex } from "../../support/convex/leagues.harness";

// #2684: a team made before team colours gets its random start, as a new team does (S12.33).

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  ({ t, leagueId } = await freshLeague());
});

const migrate = () => t.mutation(internal.migrations.teamColoursBackfill.giveTeamsColours, {});

test("S12.33: teams with no colours get two different ones, no two on the same first; teams with colours keep them", async () => {
  const [annsTeam, bobsTeam] = await addManagers(t, leagueId, [ANN, BOB, CAT]);
  await t.run(async (ctx) => {
    await ctx.db.patch("teams", annsTeam, { colours: undefined });
    await ctx.db.patch("teams", bobsTeam, { colours: undefined });
  });
  const catsColours = (await teamsIn(t, leagueId))[2].colours;

  expect(await migrate()).toBe(2);

  const teams = await teamsIn(t, leagueId);
  expect(teams[2].colours).toEqual(catsColours);
  for (const { colours } of teams) {
    expect(colours).toHaveLength(2);
    expect(TEAM_COLOURS).toEqual(expect.arrayContaining(colours ?? []));
    expect(colours?.[0]).not.toBe(colours?.[1]);
  }
  expect(new Set(teams.map(({ colours }) => colours?.[0])).size).toBe(3);
  expect(await migrate()).toBe(0);
});
