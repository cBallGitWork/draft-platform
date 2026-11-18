import { makeFunctionReference } from "convex/server";
import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS } from "../../../convex/shared/time";
import { ADMIN, ANN, COMMISSIONER, actingAs, freshLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, SAKA, completeRecord, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { EXAMPLE_SET, everyArea } from "../../support/convex/scoring.example";
import { GW1 } from "../../support/convex/seasonPoints.harness";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The admin setting a match's stats by hand (regression catalogue, 15 Nov 2026; #2303): moving the
// winning goal from one man to another (SC-087, spec/07 S07.11) and setting a man's stats when the
// feed left him missing at full time (SC-094, S07.13), which a commissioner may not (SC-095).
//
// Not built yet: no admin function sets a match stat (#2194 builds the feeds page's side), so each
// test is marked expected to fail. `setStat` names the function those builds add; when it lands,
// point the reference at it, drop `.fails`, and each test checks the case as the catalogue wrote it.

/** The admin's hand-set of one man's stat in one match, as the builds of #2194 and S07.11 add it. */
const setStat = makeFunctionReference<"mutation", { fixtureCode: number; playerCode: number; stat: string; value: number }>(
  "admin/matchStatEdits:setStat",
);

/** An Arsenal striker who played beside Saka in gameweek 1. */
const HAVERTZ_PLAYER: HeldPlayer = { code: 1010, name: "Havertz", fullName: "Kai Havertz", clubCode: ARSENAL.code, positions: ["ST"] };
/** The site's set with a winning goal worth 3 everywhere, so moving it moves points. */
const WINNING_GOAL_POINTS = 3;
const WITH_WINNING_GOAL = {
  ...structuredClone(EXAMPLE_SET),
  rules: [...structuredClone(EXAMPLE_SET.rules), { shape: "perAction", stat: "winning_goal", values: { byArea: everyArea(WINNING_GOAL_POINTS) } }],
} as StoredScoringSet;
/** After gameweek 1's full time. */
const NOW = GW1.kickoff + DAY_MS;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  ({ t, leagueId } = await freshLeague({ managers: [ANN] }));
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, HAVERTZ_PLAYER]);
    await ctx.db.insert("fixtures", GW1);
    await holdSiteScoring(ctx, { scoring: WITH_WINNING_GOAL, kind: "fix" });
    // The feed credits Saka with the winner; Havertz played 90 minutes without it.
    await ctx.db.insert("playerMatchStats", completeRecord(SAKA.code, GW1.code, { minutes: 90, goals_scored: 1, winning_goal: 1 }));
    await ctx.db.insert("playerMatchStats", completeRecord(HAVERTZ_PLAYER.code, GW1.code, { minutes: 90, goals_scored: 1 }));
  });
});

/** His gameweek 1 on his card, as Ann sees it: the stats it holds and his points there. */
async function gameweek1Of(playerCode: number) {
  const card = await (await actingAs(t, ANN)).query(api.playerCard.playerCard.card, { leagueId, playerCode, now: NOW });
  const match = card!.matches.find((each) => each.fixtureCode === GW1.code)!;
  return { stats: match.stats, points: match.points[0].total };
}

// Passes now, so the expected failures below fail on the missing function, never on their setup.
test("SC-087 S07.11 (its given): the feed credits Saka with the winner, which his points count", async () => {
  // As a winger in attacking midfield: goal 5, minutes 2, winning goal 3; Havertz in attack: goal 4, minutes 2.
  expect(await gameweek1Of(SAKA.code)).toMatchObject({ stats: { winning_goal: 1 }, points: 5 + 2 + WINNING_GOAL_POINTS });
  expect(await gameweek1Of(HAVERTZ_PLAYER.code)).toMatchObject({ points: 4 + 2 });
});

test.fails("SC-087 S07.11: the admin moves the winning goal from Saka to Havertz; Havertz gets it, Saka loses it, and the points move", async () => {
  const sakaBefore = await gameweek1Of(SAKA.code);
  const havertzBefore = await gameweek1Of(HAVERTZ_PLAYER.code);

  const admin = await actingAs(t, ADMIN);
  await admin.mutation(setStat, { fixtureCode: GW1.code, playerCode: SAKA.code, stat: "winning_goal", value: 0 });
  await admin.mutation(setStat, { fixtureCode: GW1.code, playerCode: HAVERTZ_PLAYER.code, stat: "winning_goal", value: 1 });

  const saka = await gameweek1Of(SAKA.code);
  const havertz = await gameweek1Of(HAVERTZ_PLAYER.code);
  expect(saka.stats).toMatchObject({ winning_goal: 0 });
  expect(havertz.stats).toMatchObject({ winning_goal: 1 });
  expect(saka.points).toBe(sakaBefore.points! - WINNING_GOAL_POINTS);
  expect(havertz.points).toBe(havertzBefore.points! + WINNING_GOAL_POINTS);
});

test.fails("SC-094 S07.13: the stats the admin sets by hand for a man missing at full time are the ones he scores from", async () => {
  await t.run(async (ctx) => {
    const havertz = await ctx.db
      .query("playerMatchStats")
      .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", GW1.code).eq("playerCode", HAVERTZ_PLAYER.code))
      .unique();
    // He played, but the feed never sent his line.
    await ctx.db.patch("playerMatchStats", havertz!._id, { stats: {} });
  });

  await (await actingAs(t, ADMIN)).mutation(setStat, { fixtureCode: GW1.code, playerCode: HAVERTZ_PLAYER.code, stat: "minutes", value: 90 });

  // As a striker in attack, 90 minutes is EXAMPLE_SET's 2.
  expect(await gameweek1Of(HAVERTZ_PLAYER.code)).toMatchObject({ stats: { minutes: 90 }, points: 2 });
});

test.fails("SC-095 S07.13: a commissioner trying to set a man's stats is refused, as the admin sets feed values, and nothing changes", async () => {
  const before = await gameweek1Of(SAKA.code);

  await expectRefused(
    (await actingAs(t, COMMISSIONER)).mutation(setStat, { fixtureCode: GW1.code, playerCode: SAKA.code, stat: "winning_goal", value: 0 }),
    refusals.notAdmin,
  );

  expect(await gameweek1Of(SAKA.code)).toEqual(before);
});
