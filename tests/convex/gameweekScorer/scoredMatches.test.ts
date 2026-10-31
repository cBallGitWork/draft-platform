import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { scoredMatches } from "../../../convex/gameweekScorer/scoredMatches";
import type { CardPoints } from "../../../convex/playerCard/cardPoints";
import { positionsNow } from "../../../convex/positions/playerPositions";
import { inTenths, type DoubleGameweekRule } from "../../../convex/scoring/values";
import { HOUR_MS } from "../../../convex/shared/time";
import { BELLOUMI } from "../../support/convex/teamPoints.harness";
import { rulesRevision } from "../../support/convex/leagueRules.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { HULL, HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import {
  ANN,
  EVERTON_STARTERS,
  LEAGUE_FULL_TIME_READ,
  LEAGUE_KICKOFF,
  GAMEWEEK,
  HULL_BENCH,
  HULL_KEEPER,
  HULL_SCORER,
  HULL_STARTERS,
  PHILLIPS,
  holdHullAndEverton,
  readTable,
  scoresLeague,
  type ScoresLeague,
  BOBS_FIRST_POINTS,
  GREALISH,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, liveRecords, lockMatch } from "../../support/convex/gameweekScoresMatch.harness";

// A player's matches as his team scored them (#577; spec/12, Squad): the Squad tab reads them from
// teamInGameweek, auto-subs and overrides included, so the points a team's players are credited
// with add up to its total in the table, live and final. The player card shows his base points
// instead (Craig, 31 Oct 2026), and takes only his role's line from here.
//
// Ann fields Hull from the recorded Hull v Everton. Two of her starters didn't play: Phillips in
// goal, whom Hull's keeper replaces in the slot, and an unused centre-back with no defender on her
// bench who played, so the first who did, a midfielder, comes on in his own area and the formation
// changes. Another midfielder on her bench played but doesn't come on.

/** Hull's centre-back who played the 90, taken out of Ann's squad so no defender on her bench played. */
const PLAYED_CENTRE_BACK = 108416;
/** An unused Hull substitute, a centre-back, starting in the played one's cell. */
const UNUSED_CENTRE_BACK = 496181;
/** Hull midfielders off the bench in the match: the first comes on for Ann, the second doesn't. */
const [ON_IN_HIS_OWN_AREA, LEFT_ON_THE_BENCH] = [BELLOUMI, 608227];

const ANNS_STARTERS = HULL_STARTERS.map((starter) => (starter.playerCode === PLAYED_CENTRE_BACK ? { ...starter, playerCode: UNUSED_CENTRE_BACK } : starter));
const ANNS_BENCH = HULL_BENCH.filter((code) => code !== UNUSED_CENTRE_BACK);
const ANNS_MEN = [...ANNS_STARTERS.map(({ playerCode }) => playerCode), ...ANNS_BENCH];

/** Ann's midfielder in midfield's left-centre slot, who played the match. */
const LEFT_CENTRE_MIDFIELDER = 243413;

/** Ann's league; each of `departed` left her squad before the deadline, his lineup slot vacated. */
async function annsLeague({ bobSaves = true, departed = [] as number[] } = {}): Promise<ScoresLeague> {
  const league = await scoresLeague({ bobSaves });
  // The card names each match's clubs.
  await holdHullAndEverton(league);
  await league.t.run(async (ctx) => {
    const lineup = (await ctx.db.query("lineups").withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", league.leagueId).eq("teamId", league.annsTeam)).unique())!;
    await ctx.db.patch("lineups", lineup._id, { starters: ANNS_STARTERS, bench: ANNS_BENCH });
    for (const playerCode of [PLAYED_CENTRE_BACK, ...departed]) {
      const owned = (await ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", league.leagueId).eq("playerCode", playerCode)).unique())!;
      await ctx.db.delete("squadPlayers", owned._id);
    }
  });
  return league;
}

/** One of his matches in the gameweek as his team scored it. */
type Scored = { fixtureCode: number; points: CardPoints; provisional: boolean };

/** Each of `men`'s matches in the gameweek as `teamId` scored them (scoredMatches.ts). */
async function scoredBy(league: ScoresLeague, teamId: Id<"teams">, men: readonly number[]): Promise<Map<number, Scored[]>> {
  const rows = await league.t.run(async (ctx) => {
    const held = (await ctx.db.get("leagues", league.leagueId))!;
    const positionsOf = await positionsNow(ctx);
    const { of } = await scoredMatches(ctx, held, teamId);
    const each = [];
    for (const code of men) {
      const matches = (await of({ code, positions: await positionsOf(code) })).filter((match) => match.gameweek === GAMEWEEK);
      each.push({ code, matches: matches.map(({ fixture, points, provisional }) => ({ fixtureCode: fixture.code, points, provisional })) });
    }
    return each;
  });
  return new Map(rows.map(({ code, matches }) => [code, matches]));
}

async function annsGameweek(league: ScoresLeague, men: readonly number[]) {
  const ann = await actingAs(league.t, ANN);
  const cards = await scoredBy(league, league.annsTeam, men);
  const table = (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.find((team) => team.teamId === league.annsTeam)!;
  const squad = await ann.query(api.squads.teamSquad.ofMyTeam, { leagueId: league.leagueId, now: LEAGUE_FULL_TIME_READ });
  return { cards, table, squad };
}

/** What his team was credited with from him. */
const credited = (matches: readonly Scored[]) => matches.filter((match) => match.points.scoredAs === "slot").map((match) => match.points.total ?? 0);
const sum = (points: readonly number[]) => inTenths(points.reduce((total, each) => total + each, 0));

/** The seam: his scored matches credit what the table counts, and the Squad tab adds up what
 *  they credit: what his team got from him, never a match labelled not counted (#595). */
async function expectCardsAddUpToTheTable(league: ScoresLeague, provisional: boolean, men: readonly number[] = ANNS_MEN) {
  const { cards, table, squad } = await annsGameweek(league, men);
  expect(sum([...cards.values()].flatMap(credited))).toBe(table.points);
  expect(table.provisional).toBe(provisional);
  for (const [playerCode, matches] of cards) {
    const row = squad.players.find((each) => each.code === playerCode)!;
    const priced = matches.some((match) => match.points.total !== null);
    expect(row.seasonPoints, `player ${playerCode}`).toBe(priced ? sum(credited(matches)) : null);
    expect(matches.every((match) => match.provisional === provisional), `player ${playerCode}`).toBe(true);
  }
  return cards;
}

const RECORDS = mergedHullEverton();

test("live, before full time, nobody is subbed yet and the cards add up to the table, provisionally", async () => {
  const league = await annsLeague();
  const beforeTheGoal = RECORDS.map((record) => (record.playerCode === HULL_SCORER ? { ...record, stats: { ...record.stats, goals_scored: 0 } } : record));
  await liveRecords(league, beforeTheGoal);
  const cards = await expectCardsAddUpToTheTable(league, true);
  expect(cards.get(HULL_KEEPER)![0].points.scoredAs).toBe("notCounted");
  expect(cards.get(ON_IN_HIS_OWN_AREA)![0].points.scoredAs).toBe("notCounted");
});

test("at full time the auto-subs count on the cards as in the table: one into the slot, one in his own area", async () => {
  const league = await annsLeague();
  await fullTimeRecords(league);
  const cards = await expectCardsAddUpToTheTable(league, true);

  // Hull's keeper took Phillips's slot in goal.
  expect(cards.get(HULL_KEEPER)![0].points).toMatchObject({ scoredAs: "slot", position: "GK" });
  // No defender on the bench played, so the midfielder came on in midfield: the formation changed.
  expect(cards.get(ON_IN_HIS_OWN_AREA)![0].points).toMatchObject({ scoredAs: "slot", position: "CM" });
  // He played but stayed on the bench: his best position, labelled as not counted.
  expect(cards.get(LEFT_ON_THE_BENCH)![0].points).toMatchObject({ scoredAs: "notCounted", position: "CM", total: expect.any(Number) });
  // Unused substitutes have no match on their cards.
  expect(cards.get(PHILLIPS)).toEqual([]);
  expect(cards.get(UNUSED_CENTRE_BACK)).toEqual([]);
});

test("once the match locks, the cards add up to the table's final total", async () => {
  const league = await annsLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await expectCardsAddUpToTheTable(league, false);
});

test("a starter who left the squad: the bench fills his slot, and the cards still add up to the table (#597)", async () => {
  const league = await annsLeague({ departed: [LEFT_CENTRE_MIDFIELDER] });
  await fullTimeRecords(league);
  const cards = await expectCardsAddUpToTheTable(league, true, ANNS_MEN.filter((code) => code !== LEFT_CENTRE_MIDFIELDER));

  // The midfielder who stayed on the bench before now takes the departed one's slot, as an auto-sub.
  expect(cards.get(LEFT_ON_THE_BENCH)![0].points).toMatchObject({ scoredAs: "slot", position: "CM" });
  expect(cards.get(ON_IN_HIS_OWN_AREA)![0].points).toMatchObject({ scoredAs: "slot", position: "CM" });
});

const OVERRIDDEN = 12.5;

test("the league's override of a sub's points counts on his card as in the table", async () => {
  const league = await annsLeague();
  await fullTimeRecords(league);
  await league.t.run(async (ctx) => {
    const fixture = (await ctx.db.query("fixtures").first())!;
    await ctx.db.insert("pointsOverrides", { leagueId: league.leagueId, gameweek: GAMEWEEK, fixtureCode: fixture.code, playerCode: ON_IN_HIS_OWN_AREA, points: OVERRIDDEN, reason: "The feed was wrong", by: ANN, at: LEAGUE_FULL_TIME_READ });
  });
  const cards = await expectCardsAddUpToTheTable(league, true);
  expect(cards.get(ON_IN_HIS_OWN_AREA)![0].points).toMatchObject({ scoredAs: "slot", total: OVERRIDDEN });
});

test("a team that never saved a lineup scores its men from its first (#637): its keeper in his slot, its benched fifth midfielder not counted", async () => {
  const league = await annsLeague({ bobSaves: false });
  await fullTimeRecords(league);
  const [{ playerCode: evertonKeeper }] = EVERTON_STARTERS;
  const cardOf = async (playerCode: number) => ({ matches: (await scoredBy(league, league.bobsTeam, [playerCode])).get(playerCode)! });
  const bobs = (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.find((team) => team.teamId === league.bobsTeam)!;
  expect(bobs).toMatchObject({ points: BOBS_FIRST_POINTS, noLineup: false });
  expect((await cardOf(evertonKeeper)).matches[0].points.scoredAs).toBe("slot");
  expect((await cardOf(GREALISH)).matches[0].points.scoredAs).toBe("notCounted");
});

// A double gameweek (spec/03, Double gameweeks; spec/12, The player card): Hull play a second match
// that gameweek, filed after Hull v Everton, and Ann's goalscorer plays in it too.

/** Hull's second match of the gameweek, against a club neither team fields. */
const SECOND_MATCH = 990001;
const SECOND_OPPONENT = 3;

/** How his team scored the scorer's two matches: Hull v Everton's, then the second's. */
type TwoMatches = Record<"first" | "second", Pick<CardPoints, "scoredAs" | "total">>;

/** Ann's league under `rule`, both of Hull's matches at full time, the scorer's second played on
 *  the stats `second` makes of his first's; the cards checked against the table. */
async function doubleGameweek(rule: DoubleGameweekRule, second: (first: Record<string, number>) => Record<string, number>): Promise<TwoMatches & { squad: number | null }> {
  const league = await annsLeague();
  const records = mergedHullEverton();
  const hisFirst = records.find((record) => record.playerCode === HULL_SCORER)!;
  const rulesId = (await rulesRevision(league.t, league.leagueId))!;
  await league.t.run(async (ctx) => {
    const held = (await ctx.db.get("leagueRules", rulesId))!;
    await ctx.db.patch("leagueRules", rulesId, { rules: { ...held.rules, doubleGameweek: rule } });
    await ctx.db.insert("clubs", { code: SECOND_OPPONENT, name: "Arsenal", shortName: "ARS" });
    await ctx.db.insert("fixtures", { code: SECOND_MATCH, gameweek: GAMEWEEK, homeClubCode: HULL, awayClubCode: SECOND_OPPONENT, kickoff: LEAGUE_KICKOFF + HOUR_MS });
  });
  await fullTimeRecords(league, records);
  await league.t.mutation(internal.stats.matchStats.upsertMatch, {
    fixtureCode: SECOND_MATCH,
    readAt: LEAGUE_FULL_TIME_READ,
    records: [{ ...hisFirst, fixtureCode: SECOND_MATCH, stats: second(hisFirst.stats) }],
  });
  const cards = await expectCardsAddUpToTheTable(league, true);
  const shown = (fixtureCode: number) => {
    const { scoredAs, total } = cards.get(HULL_SCORER)!.find((match) => match.fixtureCode === fixtureCode)!.points;
    return { scoredAs, total };
  };
  const { squad } = await annsGameweek(league, [HULL_SCORER]);
  const squadRow = squad.players.find((each) => each.code === HULL_SCORER)!;
  return { first: shown(HULL_EVERTON), second: shown(SECOND_MATCH), squad: squadRow.seasonPoints };
}

/** Thirty minutes and nothing else: fewer points than his goal in the first. */
const QUIET = () => ({ minutes: 30 });

test("best match: his lower match is labelled not counted, at his slot, and the cards add up to the table (#595)", async () => {
  const { first, second } = await doubleGameweek("bestMatch", QUIET);
  expect(first.scoredAs).toBe("slot");
  expect(second.scoredAs).toBe("notCounted");
  expect(second.total!).toBeLessThan(first.total!);
});

test("best match: the Squad tab's season points are his counted match alone, not both his card shows (#595)", async () => {
  const { first, second, squad } = await doubleGameweek("bestMatch", QUIET);
  expect(second.total!).toBeGreaterThan(0);
  expect(squad).toBe(first.total);
  expect(squad).not.toBe(sum([first.total!, second.total!]));
});

test("best match: when his second match is the better, his first is the one not counted (#595)", async () => {
  const { first, second } = await doubleGameweek("bestMatch", (stats) => ({ ...stats, goals_scored: (stats.goals_scored ?? 0) + 2 }));
  expect(first.scoredAs).toBe("notCounted");
  expect(second.scoredAs).toBe("slot");
});

test("best match: a tie counts one, the match filed first as the table does, and labels the other (#595)", async () => {
  const { first, second } = await doubleGameweek("bestMatch", (stats) => stats);
  expect(first.total).toBe(second.total);
  expect(first.scoredAs).toBe("slot");
  expect(second.scoredAs).toBe("notCounted");
});

test("both matches count: both are credited at his slot", async () => {
  const { first, second } = await doubleGameweek("bothMatches", QUIET);
  expect([first.scoredAs, second.scoredAs]).toEqual(["slot", "slot"]);
});
