// A team's awards on its page and My team's header band (spec/09, Awards, S09.8): the months it was
// Manager of the Month in, oldest first.

import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ANN, BOB, actingAs, freshLeague, type TestConvex } from "../../support/convex/leagues.harness";

let t: TestConvex;
let leagueId: Id<"leagues">;
let annTeam: Id<"teams">;
let bobTeam: Id<"teams">;
beforeEach(async () => {
  ({ t, leagueId, teams: [annTeam, bobTeam] } = await freshLeague({ managers: [ANN, BOB] }));
});

const otherTeam = async (email: string, teamId: Id<"teams">) => (await (await actingAs(t, email)).query(api.squads.otherSquad.ofTeam, { leagueId, teamId })).awards;
const myTeam = async (email: string) => (await actingAs(t, email)).query(api.table.awards.ofMyTeam, { leagueId });

test("S09.8 a team's page lists the months it was Manager of the Month in, oldest first, and none of another team's", async () => {
  await t.run(async (ctx) => {
    for (const [month, teamId] of [["2026-12", annTeam], ["2026-10", annTeam], ["2026-11", bobTeam]] as const)
      await ctx.db.insert("awards", { leagueId, month, teamId, points: 50, awardedAt: 0 });
  });
  expect(await otherTeam(BOB, annTeam)).toEqual(["2026-10", "2026-12"]);
  expect(await otherTeam(ANN, bobTeam)).toEqual(["2026-11"]);
  expect(await myTeam(ANN)).toEqual(["2026-10", "2026-12"]);
  expect(await myTeam(BOB)).toEqual(["2026-11"]);
});

test("S09.8 a team that has won nothing lists no awards", async () => {
  expect(await otherTeam(BOB, annTeam)).toEqual([]);
  expect(await myTeam(ANN)).toEqual([]);
});
