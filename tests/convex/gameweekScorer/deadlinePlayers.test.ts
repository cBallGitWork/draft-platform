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

test("a man who joins another club after the deadline never gains that club's match in the gameweek", async () => {
  const league = await scoresLeague();
  const { t, leagueId, annsTeam } = league;
  const NEW_CLUB = 9001;
  const NEW_CLUBS_MATCH = 9_900_001;
  await keepDeadline(league);
  await t.run(async (ctx) => {
    const fixtures = await ctx.db.query("fixtures").collect();
    const [hull] = fixtures;
    await ctx.db.insert("fixtures", { code: NEW_CLUBS_MATCH, gameweek: GAMEWEEK, homeClubCode: NEW_CLUB, awayClubCode: NEW_CLUB + 1, kickoff: hull.kickoff });
    const row = (await ctx.db.query("players").collect()).find((each) => each.code === HULL_STRIKER)!;
    await ctx.db.patch("players", row._id, { clubCode: NEW_CLUB });
  });

  const fixtureCodes = await t.run(async (ctx) => {
    const held = (await ctx.db.get("leagues", leagueId))!;
    const reads = await leagueReads(ctx, held, (await seasonRules(ctx, leagueId))!);
    const scored = await (await workedOutGameweek(ctx, reads, GAMEWEEK, [annsTeam])).slotsOf(annsTeam);
    return scored.matchesOf.get(HULL_STRIKER)!.map((match) => match.fixture.code);
  });
  expect(fixtureCodes).not.toContain(NEW_CLUBS_MATCH);
  expect(fixtureCodes).toHaveLength(1);
});
