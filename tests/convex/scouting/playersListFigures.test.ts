import { beforeEach, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PlayersSort } from "../../../convex/scouting/playersList";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
import { FPL_SEASON } from "../../support/recorded/plSeasons.payloads";
import { actingAs, addManagers, adminCreatesLeague, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, SAKA, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { playersListed } from "../../support/convex/playersList.harness";

// Every row of Scouting's list shows his season's minutes, goals, assists and shots on target (the
// approved picture, #1028), with no stat chosen, and each sorts the list. A stat chosen is
// tests/convex/scouting/playersList.test.ts's.

const RICE = { code: 1002, name: "Rice", fullName: "Declan Rice", clubCode: ARSENAL.code, positions: ["CDM" as const] };
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM" as const] };

let t: TestConvex;
let leagueId: Id<"leagues">;
// Saka and Palmer have totals this season, Rice none at all.
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, [ANN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, RICE, PALMER]);
    await ctx.db.insert("playerSeasonStats", {
      season: FPL_SEASON,
      playerCode: SAKA.code,
      stats: { minutes: 540, goals_scored: 3, assists: 4, ontarget_scoring_att: 9, expected_goals: 2.5 },
    });
    await ctx.db.insert("playerSeasonStats", { season: FPL_SEASON, playerCode: PALMER.code, stats: { minutes: 610, goals_scored: 5, ontarget_scoring_att: 7 } });
  });
});

const listAs = async (sort: PlayersSort) =>
  playersListed(await actingAs(t, ANN), leagueId, { sort });

test("each row has his season's minutes, goals, assists and shots on target, all 0 for one who hasn't played", async () => {
  const { players } = await listAs({ by: "name", descending: false });
  expect(players.map(({ name, figures }) => [name, figures])).toEqual([
    ["Palmer", { minutes: 610, goals: 5, assists: 0, shotsOnTarget: 7 }],
    ["Rice", NO_FIGURES],
    ["Saka", { minutes: 540, goals: 3, assists: 4, shotsOnTarget: 9 }],
  ]);
});

test.each([
  ["minutes", ["Palmer", "Saka", "Rice"]],
  ["goals", ["Palmer", "Saka", "Rice"]],
  ["assists", ["Saka", "Palmer", "Rice"]],
  ["shotsOnTarget", ["Saka", "Palmer", "Rice"]],
] as const)("the list sorts by %s, the most first", async (by, names) => {
  expect((await listAs({ by, descending: true })).players.map(({ name }) => name)).toEqual(names);
});

test("the fewest first, ties by name", async () => {
  expect((await listAs({ by: "assists", descending: false })).players.map(({ name }) => name)).toEqual(["Palmer", "Rice", "Saka"]);
});
