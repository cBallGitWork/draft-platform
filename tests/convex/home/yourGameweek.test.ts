import { expect, test } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { DEADLINE, GAMEWEEK, homeAt, HULL_BENCH, HULL_KEEPER, HULL_SCORER, HULL_STARTERS, LEAGUE_FULL_TIME_READ, nameOf, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { EVERTON_CLUB, HULL_CITY, HULL_EVERTON } from "../../support/convex/matchStats.harness";

// League home's panels on the reader's own team (#1976; Craig, 13 Nov 2026, on #1976): his squad's
// news, his lineup's flagged starters in the pitch's order, the waiver runs and his claims, and this
// gameweek's matches with his players or his opponent's. Ann fields Hull and Bob Everton, playing
// each other in gameweek 6's one match.

const KNOCK = "Knock - 75% chance of playing";
const HAMSTRING = "Hamstring injury - Expected back 29 Nov";

/** Gives FPL's news note to the player with `code`. */
const giveNews = ({ t }: ScoresLeague, code: number, news: string, chanceOfPlaying: number | null) =>
  t.run(async (ctx) => {
    const row = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique();
    await ctx.db.patch("players", row!._id, { news, chanceOfPlaying });
  });

test("lists each of his squad's players FPL gives a note, word for word, and his flagged starters in the pitch's order", async () => {
  const league = await scoresLeague();
  const benchMan = HULL_BENCH.find((code) => code !== HULL_KEEPER)!;
  const [, firstStarter] = HULL_STARTERS;
  await giveNews(league, HULL_SCORER, KNOCK, 75);
  await giveNews(league, benchMan, HAMSTRING, 0);
  await giveNews(league, firstStarter.playerCode, "Suspended", 0);
  const yours = (await homeAt(league, LEAGUE_FULL_TIME_READ))!.yours!;

  const noted = await Promise.all(
    [
      [firstStarter.playerCode, "Suspended", 0],
      [HULL_SCORER, KNOCK, 75],
      [benchMan, HAMSTRING, 0],
    ].map(async ([playerCode, news, chanceOfPlaying]) => ({ playerCode, name: await nameOf(league, playerCode as number), news, chanceOfPlaying })),
  );
  expect(yours.squadNews.toSorted((one, other) => one.playerCode - other.playerCode)).toEqual(noted.toSorted((one, other) => (one.playerCode as number) - (other.playerCode as number)));
  // The bench man is no starter; the back line stands before the midfield.
  expect(yours.lineup).toEqual({ set: true, flagged: [noted[0], noted[1]] });
});

test("holds the league's waiver runs and his claims waiting", async () => {
  const league = await scoresLeague();
  const yours = (await homeAt(league, LEAGUE_FULL_TIME_READ))!.yours!;
  expect(yours.waiverRuns).toEqual(FIRST_RULES.waivers.runs);
  expect(yours.claims).toBe(0);
});

test("names this gameweek's match with his players and his opponent's", async () => {
  const league = await scoresLeague();
  const home = (await homeAt(league, LEAGUE_FULL_TIME_READ))!;
  expect(home.thisGameweek?.gameweek).toBe(GAMEWEEK);
  expect(home.deadline).toBe(DEADLINE);
  const [match] = home.yours!.premierLeague;
  expect(home.yours!.premierLeague).toHaveLength(1);
  expect({ fixtureCode: match.fixtureCode, home: match.home, away: match.away }).toEqual({ fixtureCode: HULL_EVERTON, home: HULL_CITY, away: EVERTON_CLUB });
  expect(match.you).toContain(await nameOf(league, HULL_SCORER));
  expect(match.them).toHaveLength(20);
});
