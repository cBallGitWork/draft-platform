import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { SEEDED_MANAGERS } from "../../../convex/e2e/seed";
import { E2E_FUNCTIONS_SETTING } from "../../../convex/outbound/deploymentSettings";
import { teamsOf } from "../../../convex/shared/leagueAccess";
import { ADMIN, signInDeployment } from "../../support/convex/signIn.harness";
import { publicFunctions, type TestConvex } from "../../support/convex/test.harness";

// The test-only functions (spec/20, S20.17; #2288): internal only, off unless the deployment
// carries their setting, and the seed's league of a commissioner and four managers, made as people
// would make it.

let t: TestConvex;

beforeEach(async () => {
  t = await signInDeployment();
  vi.stubEnv(E2E_FUNCTIONS_SETTING, "on");
});

const seed = () => t.mutation(internal.e2e.seed.seed, {});

test("S20.17: no test-only function is public", async () => {
  const exposed = [...(await publicFunctions()).keys()].filter((name) => name.startsWith("e2e/"));
  expect(exposed).toEqual([]);
});

test("S20.17: without the test-only setting, the seed refuses and makes nothing", async () => {
  vi.stubEnv(E2E_FUNCTIONS_SETTING, "");
  await expect(seed()).rejects.toThrow(`${E2E_FUNCTIONS_SETTING} isn't set`);
  expect(await t.run((ctx) => ctx.db.query("leagues").collect())).toEqual([]);
});

test("S20.17: the seed makes the admin's league, its commissioner and four managers each on a team, joined by invite", async () => {
  const made = await seed();
  expect(made.admin).toBe(ADMIN);
  expect(made.managers).toHaveLength(SEEDED_MANAGERS);

  const { league, teams, invites } = await t.run(async (ctx) => ({
    league: await ctx.db.get("leagues", made.leagueId),
    teams: await teamsOf(ctx, made.leagueId),
    invites: await ctx.db.query("invites").collect(),
  }));
  expect(league).toMatchObject({ name: made.leagueName, commissionerEmail: made.commissioner, maxTeams: SEEDED_MANAGERS });
  expect(teams.map((team) => team.managerEmail)).toEqual(made.managers);
  for (const invite of invites) {
    expect(invite.invitedBy).toBe(made.commissioner);
    expect(invite.joined).toBeDefined();
  }
});

test("S20.17: each seed is a league and people of its own", async () => {
  const [first, second] = [await seed(), await seed()];
  expect(second.leagueName).not.toBe(first.leagueName);
  expect(second.commissioner).not.toBe(first.commissioner);
  expect(second.managers.filter((email) => first.managers.includes(email))).toEqual([]);
});
