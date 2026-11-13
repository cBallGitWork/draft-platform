import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Position } from "../../../convex/positions/positionTables";
import { workedOutGameweek } from "../../../convex/gameweekScorer/gameweekScores";
import { leagueReads } from "../../../convex/gameweekScorer/teamGameweek";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { fullTimeRecords } from "../../support/convex/gameweekScoresMatch.harness";
import {
  annsScoredGame,
  annsSquadAndEvery,
  GAMEWEEK,
  HULL_KEEPER,
  HULL_STRIKER,
  type ScoresLeague,
  scoresLeague,
  slotOf,
} from "../../support/convex/gameweekScores.harness";
import { HULL_EVERTON } from "../../support/convex/matchStats.harness";
import { PHILLIPS } from "../../support/convex/teamPoints.harness";

// A begun gameweek reads each man its lineup named as he stood at the league's deadline (#1540;
// spec/06, When positions change: "A position change counts from each league's own deadline"), so
// a position he loses or a club he joins weeks later never re-works its auto-subs: the table's
// stored total, the matchup, a player's card and the Squad tab keep agreeing.

/** The league's deadline recording keeps each team's lineup as it stood (deadlineStars.ts). */
const keepDeadline = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.stars.deadlineStars.storeLeague, { leagueId, gameweek: GAMEWEEK });

/** `playerCode`'s positions become `positions`, as the admin or the feeds move them. */
const nowPlays = ({ t }: ScoresLeague, playerCode: number, positions: Position[]) =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query("playerPositions").collect()).find((each) => each.code === playerCode)!;
    await ctx.db.patch("playerPositions", row._id, { set: positions });
  });

test("a bench keeper who loses GK after the deadline still came on for the keeper who didn't play, on the matchup and the Squad tab", async () => {
  const league = await scoresLeague();
  await keepDeadline(league);
  await nowPlays(league, HULL_KEEPER, ["CB"]);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(game.team, HULL_KEEPER)).toMatchObject({ autoSub: { kind: "on" }, counts: true });
  expect(slotOf(game.team, PHILLIPS)).toMatchObject({ autoSub: { kind: "off" } });
  const { squad, every } = await annsSquadAndEvery(league);
  expect([...squad.starters, ...squad.bench].find((slot) => slot.playerCode === HULL_KEEPER)).toMatchObject({ counts: true });
  expect(squad).toEqual(every);
});

test("with nothing kept at the deadline, a gameweek reads him as he is now: no keeper, so he can't come on", async () => {
  const league = await scoresLeague();
  await nowPlays(league, HULL_KEEPER, ["CB"]);
  await fullTimeRecords(league);

  const game = await annsScoredGame(league, GAMEWEEK);
  expect(slotOf(game.team, HULL_KEEPER).autoSub?.kind).not.toBe("on");
});

const NEW_CLUB = 9001;
const NEW_CLUBS_MATCH = 9_900_001;

/** `playerCode` joins NEW_CLUB, which has a match of its own in the gameweek. */
const joinsNewClub = ({ t }: ScoresLeague, playerCode: number) =>
  t.run(async (ctx) => {
    const [hull] = await ctx.db.query("fixtures").collect();
    await ctx.db.insert("fixtures", { code: NEW_CLUBS_MATCH, gameweek: GAMEWEEK, homeClubCode: NEW_CLUB, awayClubCode: NEW_CLUB + 1, kickoff: hull.kickoff });
    const row = (await ctx.db.query("players").collect()).find((each) => each.code === playerCode)!;
    await ctx.db.patch("players", row._id, { clubCode: NEW_CLUB });
  });

/** The codes of `playerCode`'s matches in Ann's gameweek, as the scorer reads them. */
const matchCodesOf = ({ t, leagueId, annsTeam }: ScoresLeague, playerCode: number) =>
  t.run(async (ctx) => {
    const held = (await ctx.db.get("leagues", leagueId))!;
    const reads = await leagueReads(ctx, held, (await seasonRules(ctx, leagueId))!);
    const scored = await (await workedOutGameweek(ctx, reads, GAMEWEEK, [annsTeam])).slotsOf(annsTeam);
    return scored.matchesOf.get(playerCode)!.map((match) => match.fixture.code);
  });

test("a man who joins another club after the deadline never gains that club's match in the gameweek", async () => {
  const league = await scoresLeague();
  await keepDeadline(league);
  await joinsNewClub(league, HULL_STRIKER);

  const fixtureCodes = await matchCodesOf(league, HULL_STRIKER);
  expect(fixtureCodes).not.toContain(NEW_CLUBS_MATCH);
  expect(fixtureCodes).toHaveLength(1);
});

test("with nothing kept at the deadline, a man who has since joined another club scores the match he played then, not his new club's (#2039)", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  const scored = async () => {
    // His shirt's club is his club now; what he scored in the gameweek is all else.
    const { breakdown, points, provisional, counts, status, autoSub } = slotOf((await annsScoredGame(league, GAMEWEEK)).team, HULL_STRIKER);
    return { breakdown, points, provisional, counts, status, autoSub };
  };
  const before = await scored();
  await joinsNewClub(league, HULL_STRIKER);

  expect(await scored()).toEqual(before);
  expect(await matchCodesOf(league, HULL_STRIKER)).toEqual([HULL_EVERTON]);
});
