import { describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { seasonGameweekCount } from "../../../convex/gameweeks/seasonGameweeks";
import { seasonGameweeks } from "../../../convex/gameweeks/usedGameweeks";
import { playerOfTheSeasonLetter } from "../../../convex/table/awardWords";
import { playersOfTheSeason } from "../../../convex/table/playerOfTheSeason";
import { GAMEWEEK, nameOf, scoresLeague } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, storeLeague } from "../../support/convex/gameweekScoresMatch.harness";
import { fakeClaude } from "../../support/convex/scouts.harness";
import { everyJobRuns } from "../../support/convex/test.harness";

// Player of the Season (spec/09, Awards; #2678): the most points over the league's own gameweeks,
// those level split by the best points per game (every match he played in), any still level
// sharing it (Craig, 19 and 26 Nov 2026, on #2678).

const [SAKA, PALMER, HAALAND] = [1, 2, 3];

describe("the season's winner", () => {
  test("S09.5: the player with the most points wins", () => {
    const tallies = [
      { playerCode: SAKA, points: 231.5, games: 34 },
      { playerCode: PALMER, points: 240, games: 36 },
      { playerCode: HAALAND, points: 199, games: 30 },
    ];
    expect(playersOfTheSeason(tallies)).toEqual([tallies[1]]);
  });

  test("S09.5: players level on points are split by the best points per game", () => {
    const saka = { playerCode: SAKA, points: 231.5, games: 34 };
    const palmer = { playerCode: PALMER, points: 231.5, games: 30 };
    expect(playersOfTheSeason([saka, palmer])).toEqual([palmer]);
  });

  test("S09.5: players still level after points per game share it", () => {
    const saka = { playerCode: SAKA, points: 231.5, games: 34 };
    const palmer = { playerCode: PALMER, points: 231.5, games: 34 };
    expect(playersOfTheSeason([saka, palmer, { playerCode: HAALAND, points: 100, games: 20 }])).toEqual([saka, palmer]);
  });

  test("S09.5: a season no player has played in has no winner", () => {
    expect(playersOfTheSeason([])).toEqual([]);
  });

  test("S09.5: Mail names each winner, the points and the games", () => {
    const { subject, body } = playerOfTheSeasonLetter(["Saka"], 231.5, 34);
    expect(subject).toContain("Saka");
    expect(body).toContain("231.5");
    expect(body).toContain("34 games");
    expect(playerOfTheSeasonLetter(["Saka", "Palmer"], 231.5, 34).subject).toContain("Saka and Palmer share");
  });
});

test("S09.5: once the league's last gameweek is final, its Player of the Season is stored and Mailed once", async () => {
  const league = await scoresLeague();
  // Gameweek 6 the league's only one, so its season ends once it is final.
  const count = await league.t.run((ctx) => seasonGameweekCount(ctx));
  const unusedGameweeks = seasonGameweeks(count).filter((gameweek) => gameweek > GAMEWEEK);
  await league.t.run((ctx) => ctx.db.patch("leagues", league.leagueId, { unusedGameweeks, scoringStart: GAMEWEEK }));
  await fullTimeRecords(league);
  await lockMatch(league);
  fakeClaude();
  const awards = () => league.t.run(async (ctx) => (await ctx.db.query("awards").collect()).filter((award) => "playerCode" in award));
  const awardLetters = async () =>
    (await league.t.run((ctx) => ctx.db.query("letters").collect())).filter((letter) => letter.subject.includes("Player of the Season"));

  await storeLeague(league);
  await everyJobRuns(league.t);
  const [award, ...others] = await awards();
  expect(others).toEqual([]);
  expect(award).toMatchObject({ leagueId: league.leagueId, games: 1 });
  const told = await awardLetters();
  expect(told.length).toBeGreaterThan(0);
  const name = await nameOf(league, "playerCode" in award ? award.playerCode : 0);
  expect(told.every((letter) => letter.subject.includes(name) && letter.body.includes(`${award.points}`))).toBe(true);

  // Stored again, it is awarded and Mailed no more.
  await league.t.mutation(internal.table.finalScores.rescore, { leagueId: league.leagueId, gameweek: GAMEWEEK });
  await everyJobRuns(league.t);
  expect(await awards()).toHaveLength(1);
  expect(await awardLetters()).toHaveLength(told.length);
});
