import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { abandonRefusals } from "../../../convex/match/abandonedMatches";
import { adminByline, matchWords } from "../../../convex/mail/letterWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import { GAMEWEEK, HULL_POINTS, HULL_SCORER, nameOf, readTable, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, storedLeague, storeLeague } from "../../support/convex/gameweekScoresMatch.harness";
import { actingAs, ADMIN, ANN, COMMISSIONER } from "../../support/convex/leagues.harness";
import { EVERTON_CLUB, HULL_CITY, HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { fakeClaude } from "../../support/convex/scouts.harness";
import { clockRunsTo, expectRefused } from "../../support/convex/test.harness";

// The admin marks a match abandoned, or takes the mark back (#904; spec/05 S05.6, S05.7, S05.46,
// S05.47): Hull v Everton, locked and stored, Ann fielding Hull and Bob Everton, so every man in
// either lineup played in it.

const MATCH_NAME = matchWords(HULL_CITY.name, EVERTON_CLUB.name);

const marks = async ({ t }: ScoresLeague, by = ADMIN, fixtureCode: number = HULL_EVERTON) => {
  // A final gameweek scored again asks for its recap (home/recaps.ts).
  fakeClaude();
  await (await actingAs(t, by)).mutation(api.match.abandonedMatches.mark, { fixtureCode });
  await clockRunsTo(t, Date.now());
};
const unmarks = async ({ t }: ScoresLeague, by = ADMIN) => {
  await (await actingAs(t, by)).mutation(api.match.abandonedMatches.unmark, { fixtureCode: HULL_EVERTON });
  await clockRunsTo(t, Date.now());
};
const overridesScorer = async ({ t, leagueId }: ScoresLeague) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.table.pointsOverrides.override, {
    leagueId,
    fixtureCode: HULL_EVERTON,
    playerCode: HULL_SCORER,
    points: 12,
    reason: "A goal the feed missed",
  });

/** Gameweek 6's points, Ann's then Bob's, as the table has them and as stored. */
async function gameweekPoints(league: ScoresLeague) {
  const table = (await readTable(league))!.results.find((each) => each.gameweek === GAMEWEEK)!.teams.map(({ points }) => points);
  const stored = await league.t.run(async (ctx) => (await ctx.db.query("finalScores").collect()).map(({ points }) => points));
  return { table, stored };
}
const recordsOf = ({ t }: ScoresLeague) => t.run((ctx) => ctx.db.query("playerMatchStats").collect());
const lettersAbout = async ({ t }: ScoresLeague, subject: string) => (await t.run((ctx) => ctx.db.query("letters").collect())).filter((letter) => letter.subject === subject);

test("a match marked abandoned counts as never played: its records and overrides go, every man in it scores nothing, and the league is told", async () => {
  const league = await storedLeague();
  await overridesScorer(league);
  const scorer = await nameOf(league, HULL_SCORER);

  await marks(league);

  expect(await recordsOf(league)).toEqual([]);
  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toEqual([]);
  const page = await (await actingAs(league.t, ANN)).query(api.match.matchPage.ofMatch, { leagueId: league.leagueId, fixtureCode: HULL_EVERTON });
  expect(page?.abandoned).toBe(true);
  // Every man fielded played in it, so every slot is empty and the bench can't fill one.
  expect(await gameweekPoints(league)).toEqual({ table: [0, 0], stored: [0, 0] });
  // His season's goal went with the record.
  const season = await league.t.run((ctx) => ctx.db.query("playerSeasonStats").collect());
  expect(season.every((row) => Object.values(row.stats).every((value) => value === 0))).toBe(true);

  const letters = await lettersAbout(league, `${MATCH_NAME} was abandoned`);
  expect(letters.length).toBeGreaterThan(0);
  expect(new Set(letters.map((letter) => letter.leagueId))).toEqual(new Set([league.leagueId]));
  expect(letters[0].kind).toBe("commissioner");
  expect(letters[0].body).toContain(`${adminByline} marked ${MATCH_NAME}, gameweek ${GAMEWEEK}, abandoned.`);
  expect(letters[0].body).toContain(`The league's overrides in it went with it: ${scorer}.`);
});

test("while the mark stands the feeds write nothing for the match", async () => {
  const league = await storedLeague();
  await marks(league);

  await league.t.mutation(internal.stats.matchStats.upsertMatch, { fixtureCode: HULL_EVERTON, readAt: Date.now(), records: mergedHullEverton() });
  expect(await recordsOf(league)).toEqual([]);
  const due = await league.t.query(internal.stats.matchStatsDue.due, { now: Date.now() });
  expect(due.matches).toEqual([]);
});

test("taking the mark back has the next read write the match again, the deleted override staying deleted, and tells the league", async () => {
  const league = await storedLeague();
  await overridesScorer(league);
  await marks(league);

  await unmarks(league);
  const due = await league.t.query(internal.stats.matchStatsDue.due, { now: Date.now() });
  expect(due.matches.map((match) => match.fixtureCode)).toEqual([HULL_EVERTON]);
  await fullTimeRecords(league);
  await lockMatch(league);
  await storeLeague(league);

  expect((await recordsOf(league)).length).toBe(mergedHullEverton().length);
  expect(await league.t.run((ctx) => ctx.db.query("pointsOverrides").collect())).toEqual([]);
  expect((await gameweekPoints(league)).table[0]).toBe(HULL_POINTS);
  const [letter] = await lettersAbout(league, `${MATCH_NAME} is no longer abandoned`);
  expect(letter.body).toContain(`${adminByline} took back the abandoned mark on ${MATCH_NAME}, gameweek ${GAMEWEEK}.`);
});

test("only the admin marks a match, once, and only one that has kicked off", async () => {
  const league = await storedLeague();
  await expectRefused(marks(league, COMMISSIONER), refusals.notAdmin);
  await expectRefused(unmarks(league), abandonRefusals.notMarked);
  await expectRefused(marks(league, ADMIN, 424_242), abandonRefusals.noMatch);
  await league.t.run(async (ctx) => {
    await ctx.db.insert("fixtures", { code: 424_243, gameweek: GAMEWEEK + 1, homeClubCode: HULL_CITY.code, awayClubCode: EVERTON_CLUB.code, kickoff: Date.now() + 60_000 });
  });
  await expectRefused(marks(league, ADMIN, 424_243), abandonRefusals.notKickedOff);

  await marks(league);
  await expectRefused(marks(league), abandonRefusals.alreadyMarked);
});
