import { describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, BOB, COMMISSIONER, OUTSIDER, actingAs, freshLeague, type TestConvex } from "../../support/convex/leagues.harness";

// A team's awards, for its page (spec/09, Awards, S09.8; #2680): the months it was Manager of the
// Month, read by anyone in the league.

const award = (t: TestConvex, leagueId: Id<"leagues">, teamId: Id<"teams">, month: string) =>
  t.run((ctx) => ctx.db.insert("awards", { leagueId, month, teamId, points: 100, awardedAt: 0 }));

describe("a team's awards", () => {
  test("S09.8: are the months it was Manager of the Month, oldest first, and none of another team's", async () => {
    const { t, leagueId, teams: [annTeam, bobTeam] } = await freshLeague({ managers: [ANN, BOB] });
    await award(t, leagueId, annTeam, "2026-11");
    await award(t, leagueId, bobTeam, "2026-10");
    await award(t, leagueId, annTeam, "2026-09");
    const read = async (teamId: Id<"teams">) => (await actingAs(t, BOB)).query(api.table.teamAwards.ofTeam, { leagueId, teamId });
    expect(await read(annTeam)).toEqual(["2026-09", "2026-11"]);
    expect(await read(bobTeam)).toEqual(["2026-10"]);
  });

  test("S09.8: a team that has won none has none, and the commissioner reads them; someone outside the league is refused", async () => {
    const { t, leagueId, teams: [annTeam] } = await freshLeague({ managers: [ANN, BOB] });
    expect(await (await actingAs(t, COMMISSIONER)).query(api.table.teamAwards.ofTeam, { leagueId, teamId: annTeam })).toEqual([]);
    await expectRefused((await actingAs(t, OUTSIDER)).query(api.table.teamAwards.ofTeam, { leagueId, teamId: annTeam }), refusals.notInLeague);
  });
});
