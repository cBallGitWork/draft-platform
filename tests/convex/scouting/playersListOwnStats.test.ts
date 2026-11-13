import { beforeEach, expect, test } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { OWN_STAT_PREFIX } from "../../../convex/scoring/statKeys";
import type { PlayersSort } from "../../../convex/scouting/playersList";
import { actingAs, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { PALMER, RICE, SAKA } from "../../support/convex/footballRows.harness";
import { holdSeasonTotals, scoutingLeague } from "../../support/convex/scouting.harness";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { BY_NAME, playersListed } from "../../support/convex/playersList.harness";

// Scouting's stat box offers the site set's own stats as well as the feeds' (spec/19, The players
// list; #910): the list says which, and one shown is each player's season total, worked out from
// his season totals as a match's own stat is from its record (spec/14, Own stats). The catalogue's
// stats are tests/convex/scouting/playersList.test.ts's.

const INVOLVEMENTS = { stat: `${OWN_STAT_PREFIX}involvements`, name: "Involvements", shortCode: "INV" };
const HALF_XG = { stat: `${OWN_STAT_PREFIX}half_xg`, name: "Half xG", shortCode: "HXG" };
const MOST_FIRST: PlayersSort = { by: "stat", descending: true };

let t: TestConvex;
let leagueId: Id<"leagues">;
// Saka has goals and xG this season, Palmer only xG, and Rice no totals at all.
beforeEach(async () => {
  ({ t, leagueId } = await scoutingLeague([SAKA, RICE, PALMER]));
  await t.run(async (ctx) => {
    await holdSeasonTotals(ctx, SAKA.code, { goals_scored: 3, expected_goals: 2.5 });
    await holdSeasonTotals(ctx, PALMER.code, { expected_goals: 0.5 });
  });
});

/** The list as Ann reads it, by `stat` the most first, or by name with none shown. */
const listAs = async (stat: string | null = null) => playersListed(await actingAs(t, ANN), leagueId, { sort: stat === null ? BY_NAME : MOST_FIRST, stat });

/** The site's latest set: the first one with goals less half the xG, and half the xG alone. */
const holdOwnStats = () =>
  t.run((ctx) =>
    holdSiteScoring(ctx, {
      scoring: {
        ...structuredClone(FIRST_SCORING),
        ownStats: [
          { ...INVOLVEMENTS, parts: [{ stat: "goals_scored", weight: 1 }, { stat: "expected_goals", weight: -0.5 }] },
          { ...HALF_XG, parts: [{ stat: "expected_goals", weight: 0.5 }] },
        ],
      },
      kind: "fix",
      season: 26,
      number: 1,
      at: Date.now(),
    }),
  );

test("with the first set, which has none, no own stat is offered", async () => {
  expect((await listAs()).ownStats).toEqual([]);
});

test("the site's latest set's own stats are offered, in its order", async () => {
  await holdOwnStats();
  expect((await listAs()).ownStats).toEqual([INVOLVEMENTS, HALF_XG]);
});

test("one shown is each player's season total, worked out from his totals, and sorted by", async () => {
  await holdOwnStats();
  const { players } = await listAs(INVOLVEMENTS.stat);
  expect(players.map((player) => [player.name, player.stat])).toEqual([
    ["Saka", 1.75],
    ["Rice", 0],
    ["Palmer", -0.25],
  ]);
});

test("an own stat the site's set doesn't hold is refused", async () => {
  await holdOwnStats();
  await expect(listAs(`${OWN_STAT_PREFIX}gone`)).rejects.toThrow(`No stat ${OWN_STAT_PREFIX}gone is in the catalogue or the site's own stats`);
});
