import { expect, test } from "vitest";
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
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
// Belloumi, Hull's midfielder, is second on Ann's bench after Hull's keeper.
import { BELLOUMI, PHILLIPS } from "../../support/convex/teamPoints.harness";

// A bench player's role on the matchup once he comes on (#799; spec/05, Auto-subs: "The first
// player in the manager's bench order who can play the empty slot's area takes that slot and its
// role. If none can, the first who keeps the area limits legal comes on in his own area"). The role
// is the one the table's scorer prices him in, so the two never disagree; until stars (#11), one
// who comes on in his own area plays his new slot's first.

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
