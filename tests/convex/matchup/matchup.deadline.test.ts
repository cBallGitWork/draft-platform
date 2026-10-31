import { expect, test } from "vitest";
import { roleIn, rolesOfSlot } from "../../../convex/lineup/roles";
import {
  annsScoredGame,
  BOBS_TEAM,
  EVERTON_STARTERS,
  GAMEWEEK,
  HULL_SCORER,
  HULL_STARTERS,
  lineupOf,
  matchupAs,
  type ScoresLeague,
  scoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { ADMIN, COMMISSIONER } from "../../support/convex/leagues.harness";

// Who sees a lineup on the matchup, and when (#799; spec/10, The matchup, as a live match): before
// the deadline nobody sees another team's, the commissioner and the admin included ("they just get
// to view what the managers see", Craig, 31 Oct 2026); at it both show, each starter in his role.

test.each([
  ["the commissioner", COMMISSIONER],
  ["the admin", ADMIN],
])("before the deadline %s sees only who meets whom, no lineup, as a manager does", async (_who, email) => {
  const league = await scoresLeague();
  const read = await matchupAs(league, email, { teamId: league.annsTeam, gameweek: GAMEWEEK + 1 });
  expect(read).toMatchObject({ kind: "headToHead", teamId: league.annsTeam, gameweek: GAMEWEEK + 1 });
  // The whole game, so a lineup sent beside it would fail here.
  expect(read?.kind === "headToHead" && read.game).toEqual({ kind: "notBegun", opponent: { kind: "team", teamName: BOBS_TEAM } });
});

test("once the deadline has passed each starter on both sides carries his role: the one he was given, else his slot's first", async () => {
  const league = await scoresLeague();
  const scorer = HULL_STARTERS.find((starter) => starter.playerCode === HULL_SCORER)!;
  const [first, given] = rolesOfSlot(scorer);
  await giveRole(league, HULL_SCORER, given.key);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(lineupOf(game.team).starters.map((slot) => slot.playerCode)).toEqual(HULL_STARTERS.map((starter) => starter.playerCode));
  const hull = new Map(lineupOf(game.team).starters.map((slot) => [slot.playerCode, slot.role]));
  expect(hull.get(HULL_SCORER)).toEqual(given);
  expect(given.key).not.toBe(first.key);
  // The rest of Hull's, and every one of Everton's, plays his slot's first.
  for (const starter of HULL_STARTERS.filter(({ playerCode }) => playerCode !== HULL_SCORER)) {
    expect(hull.get(starter.playerCode)).toEqual(roleIn(starter, undefined));
  }
  const everton = new Map(lineupOf(game.opponent).starters.map((slot) => [slot.playerCode, slot.role]));
  for (const starter of EVERTON_STARTERS) expect(everton.get(starter.playerCode)).toEqual(roleIn(starter, undefined));
  // The bench carries none: spec/10 names the starters' roles.
  expect(lineupOf(game.team).bench.every((slot) => !("role" in slot))).toBe(true);
});

/** Ann's saved lineup gives `playerCode` the role `role`, as Tactics saves it. */
const giveRole = ({ t, annsTeam }: ScoresLeague, playerCode: number, role: string) =>
  t.run(async (ctx) => {
    const lineup = (await ctx.db.query("lineups").collect()).find((each) => each.teamId === annsTeam)!;
    const starters = lineup.starters.map((starter) => (starter.playerCode === playerCode ? { ...starter, role } : starter));
    await ctx.db.patch("lineups", lineup._id, { starters });
  });
