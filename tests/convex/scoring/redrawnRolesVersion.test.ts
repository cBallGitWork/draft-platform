import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { addManagers, adminCreatesLeague, MANAGERS } from "../../support/convex/leagues.harness";
import { EDITED, holdSiteScoring, inGameweek, NOTICE, patch, t, TODAY, useSiteScoringDeployment, versions } from "../../support/convex/siteScoring.harness";
import { ATTACK, LEFT_BACK } from "../../support/convex/teamPoints.harness";

// The redrawn roles go into the site's set (#1445; spec/05 `S05.27`, `S05.3`): from the next
// gameweek not begun, and every starter on a role cut on #1196 moves to the role he'd get dropped
// into that slot, his lineup never refused (spec/05, Roles' patch rule).

useSiteScoringDeployment();

const NEXT = 9;
/** The 5 Nov mixes as the site's set held them: here, one old role. */
const OLD_SET: StoredScoringSet = {
  ...FIRST_SCORING,
  ownStats: FIRST_ROLE_OWN_STATS.filter(({ stat }) => stat !== "league:ground_duels_won"),
  roles: [{ role: "lateRunner", bonus: { parts: [{ stat: "goals_scored", weight: 2 }], bars: [1, 2, 3] }, cost: { parts: [{ stat: "big_chance_missed", weight: 1 }], bars: [2, 3, 4] } }],
};
const CENTRE_MIDFIELD = { area: "midfield", lane: "centre" } as const;

const addRedrawnRoles = () => t.mutation(internal.scoring.firstRolesVersion.addRedrawnRoles, {});
const rowsOf = (teamId: Id<"teams">) =>
  t.run(async (ctx) => (await ctx.db.query("lineups").collect()).filter((row) => row.teamId === teamId).map(({ fromGameweek, starters }) => ({ fromGameweek, starters })));

async function holdLeague() {
  await holdGameweeks(t, { next: NEXT });
  await t.run((ctx) => holdSiteScoring(ctx, { scoring: OLD_SET, kind: "fix", at: TODAY - 1 }));
  const leagueId = await adminCreatesLeague(t);
  const [annsTeam, bobsTeam] = await addManagers(t, leagueId, MANAGERS.slice(0, 2));
  // Ann's lineup in force since gameweek 5; Bob saved one for gameweek 10.
  const lineup = (teamId: Id<"teams">, fromGameweek: number, starters: Doc<"lineups">["starters"]) =>
    t.run(async (ctx) => {
      await ctx.db.query("lineups").collect().then((rows) => Promise.all(rows.filter((row) => row.teamId === teamId).map((row) => ctx.db.delete("lineups", row._id))));
      await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek, starters, bench: [] });
    });
  await lineup(annsTeam, 5, [{ playerCode: 1, ...CENTRE_MIDFIELD, role: "lateRunner" }, { playerCode: 2, ...LEFT_BACK, role: "invertedFullBack" }]);
  await lineup(bobsTeam, 10, [{ playerCode: 3, ...ATTACK, role: "shadowStriker" }]);
  return { annsTeam, bobsTeam };
}

// S05.27, S05.3
test("they score from the next gameweek not begun, in place of the set's, the gameweeks before keeping theirs", async () => {
  await holdLeague();

  expect(await addRedrawnRoles()).toEqual({ name: "26_27.2", fromGameweek: NEXT, moved: 2 });
  // Gameweek 8 had begun before the old set too, so it keeps the first set.
  expect(await inGameweek(NEXT - 1)).toEqual(FIRST_SCORING);
  expect(await inGameweek(NEXT)).toEqual({ ...OLD_SET, ownStats: FIRST_ROLE_OWN_STATS, roles: FIRST_ROLES });
  expect(await addRedrawnRoles()).toBeNull();
  expect(await versions()).toBe(2);
});

test("a starter on a cut role moves to the role he'd be dropped on from that gameweek, the begun ones untouched", async () => {
  const { annsTeam, bobsTeam } = await holdLeague();
  await addRedrawnRoles();

  // With no stars, the slot's first: saved as no role. Anyone else keeps his.
  expect(await rowsOf(annsTeam)).toEqual([
    { fromGameweek: 5, starters: [{ playerCode: 1, ...CENTRE_MIDFIELD, role: "lateRunner" }, { playerCode: 2, ...LEFT_BACK, role: "invertedFullBack" }] },
    { fromGameweek: NEXT, starters: [{ playerCode: 1, ...CENTRE_MIDFIELD }, { playerCode: 2, ...LEFT_BACK, role: "invertedFullBack" }] },
  ]);
  expect(await rowsOf(bobsTeam)).toEqual([{ fromGameweek: 10, starters: [{ playerCode: 3, ...ATTACK }] }]);
});

test("while a patch made without them waits to take effect, they aren't added", async () => {
  await holdGameweeks(t, { next: NEXT });
  await patch(EDITED, TODAY + NOTICE);

  await expect(addRedrawnRoles()).rejects.toThrow(/waits to take effect/);
});
