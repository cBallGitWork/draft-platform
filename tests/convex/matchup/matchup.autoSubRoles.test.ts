import { expect, test } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { fullTimeRecords, lockMatch } from "../../support/convex/gameweekScoresMatch.harness";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { DAY_MS } from "../../../convex/shared/time";
import { namedRole, roleIn, rolesOfSlot } from "../../../convex/lineup/roles";
import {
  annsScoredGame,
  GAMEWEEK,
  giveAnnsStarterRole,
  HULL_BENCH_STRIKER,
  HULL_KEEPER,
  HULL_STARTERS,
  HULL_STRIKER,
  leavesAnnsSquad,
  type ScoresLeague,
  scoresLeague,
  slotOf,
} from "../../support/convex/gameweekScores.harness";
// Belloumi, Hull's midfielder, is second on Ann's bench after Hull's keeper.
import { BELLOUMI, PHILLIPS } from "../../support/convex/teamPoints.harness";

// A bench player's role on the matchup once he comes on (#799; spec/05, Auto-subs: "The first
// player in the manager's bench order who can play the empty slot's area takes that slot and its
// role. If none can, the first who keeps the area limits legal comes on in his own area"). The role
// is the one the table's scorer prices him in, so the two never disagree. One who comes on in his
// own area plays the role he had the most stars for at the deadline (#11; Craig, 1 Nov 2026), or,
// with no copy kept then, his new slot's first.

test("a sub into the empty slot plays its role, and a bench player not on plays none", async () => {
  const league = await scoresLeague();
  const keepersSlot = HULL_STARTERS.find((starter) => starter.playerCode === PHILLIPS)!;
  const [first, given] = rolesOfSlot(keepersSlot);
  await giveAnnsStarterRole(league, PHILLIPS, given.key);
  // Full time: Phillips didn't play, so Hull's keeper comes on for him.
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(game.team, HULL_KEEPER)).toMatchObject({ autoSub: { kind: "on" }, role: namedRole(given) });
  expect(given.key).not.toBe(first.key);
  expect(slotOf(game.team, BELLOUMI)).toMatchObject({ counts: false, role: null });
});

// With no stars kept at the deadline: his new slot's first role.
test("a sub who can't play the empty slot's area comes on in his own, on his new slot's role as the scorer priced it", async () => {
  const league = await scoresLeague();
  // Hull's striker has left Ann's squad, and her bench's one forward plays only in midfield, so no
  // one on it can play attack: Belloumi, the first who keeps the lineup legal, comes on in midfield.
  await leavesAnnsSquad(league, HULL_STRIKER);
  await playsOnlyCentreMidfield(league, HULL_BENCH_STRIKER);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  // Midfield's one free cell is its centre: Hull's four stand left, left-centre, right-centre, right.
  expect(slotOf(game.team, BELLOUMI)).toMatchObject({ area: "midfield", autoSub: { kind: "on" }, role: namedRole(roleIn({ area: "midfield", lane: "centre" }, undefined)) });
  expect(slotOf(game.team, HULL_BENCH_STRIKER)).toMatchObject({ counts: false, role: null });
});

/** `playerCode` plays only centre midfield, as his positions are set. */
const playsOnlyCentreMidfield = ({ t }: ScoresLeague, playerCode: number) =>
  t.run(async (ctx) => {
    const positions = (await ctx.db.query("playerPositions").collect()).find((each) => each.code === playerCode)!;
    await ctx.db.patch("playerPositions", positions._id, { set: ["CM"] });
  });

/** Hull's striker gone and Hull's bench forward kept to centre midfield, so Belloumi comes on in
 *  midfield's free centre cell, as above. */
async function belloumiOnInMidfield(league: ScoresLeague) {
  await leavesAnnsSquad(league, HULL_STRIKER);
  await playsOnlyCentreMidfield(league, HULL_BENCH_STRIKER);
}

/** A playmaker earns a point a goal and a ball-winner loses one, so Belloumi's goal scores apart
 *  under each. In force from before the gameweek. */
const ROLES_PRICED_APART = {
  ...FIRST_SCORING,
  roleAdjustments: [
    { role: "playmaker", adjustments: [{ stat: "goals_scored", points: 1 }] },
    { role: "ballWinner", adjustments: [{ stat: "goals_scored", points: -1 }] },
  ],
};

test("a sub coming on in his own area plays his best-star role at the deadline: stars moving after never move his role or points, provisional or final", async () => {
  const league = await scoresLeague();
  const { t, leagueId, annsTeam } = league;
  await t.run(async (ctx) => {
    await holdSiteScoring(ctx, { scoring: ROLES_PRICED_APART, kind: "patch", season: 2026, number: 1, at: Date.now() - 365 * DAY_MS });
    // At the deadline he was a 4-star playmaker and a 2-star ball-winner.
    await ctx.db.insert("deadlineStars", {
      leagueId,
      gameweek: GAMEWEEK,
      teamId: annsTeam,
      bench: [{ playerCode: BELLOUMI, stars: [{ area: "midfield", role: "ballWinner", stars: 2 }, { area: "midfield", role: "playmaker", stars: 4 }] }],
    });
  });
  await belloumiOnInMidfield(league);
  await fullTimeRecords(league);
  const provisional = slotOf((await annsScoredGame(league, GAMEWEEK)).team, BELLOUMI);
  expect(provisional).toMatchObject({ area: "midfield", autoSub: { kind: "on" }, role: { key: "playmaker" } });

  // After the deadline his stars say ball-winner.
  await t.run((ctx) =>
    ctx.db.insert("playerRoleStars", { playerCode: BELLOUMI, matches: 3, ratings: [{ area: "midfield", role: "ballWinner", perMatch: 9, stars: 5 }] }),
  );
  await lockMatch(league);
  const final = slotOf((await annsScoredGame(league, GAMEWEEK)).team, BELLOUMI);

  expect(final).toMatchObject({ role: { key: "playmaker" }, points: provisional.points, provisional: false });
});