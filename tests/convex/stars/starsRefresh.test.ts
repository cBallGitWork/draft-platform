import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { HOUR_MS } from "../../../convex/shared/time";
import { STARS_PAGE } from "../../../convex/stars/starsRefresh";
import { UNSURE } from "../../../convex/stars/starsShape";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { freshConvex, pendingJobs, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import { ARSENAL, insertPlayers } from "../../support/convex/footballRows.harness";
import {
  BLANK,
  CAMEO,
  holdStarsPlayers,
  insertMatch,
  lockedRecord,
  MATCHES,
  NEWCOMER,
  refreshesRun,
  refreshEveryone,
  SCORER,
  STEADY,
  STOPPER,
  starsOf,
  starsRows,
  UNUSED,
} from "../../support/convex/stars.harness";

// Stars kept up to date (#11, starsRefresh.ts): each player's points per match under each role
// stored, then everyone ranked, as matches lock and as the site's scoring changes.

beforeEach(() => vi.useFakeTimers());

const STRIKER_ROLES = DEFAULT_ROLES.ST.map((role) => `attack/${role.key}`);
/** His stars, the same for every striker's role while no role adjustment is in force. */
async function asOne(t: TestConvex, playerCode: number) {
  const stars = await starsOf(t, playerCode);
  const values = new Set(STRIKER_ROLES.map((key) => stars.get(key)));
  expect(values.size).toBe(1);
  return [...values][0];
}

async function rated(): Promise<TestConvex> {
  const t = freshConvex();
  await holdStarsPlayers(t);
  await refreshEveryone(t);
  return t;
}

test("every striker is ranked against the others on points per match: 10, 6, 2 and 1 make 5, 3.5, 2.5 and 1 stars", async () => {
  const t = await rated();
  // A pool of four: one above Steady is 25%, past 4's cut; two above Blank, 50%; three above Cameo.
  expect(await asOne(t, SCORER.code)).toBe(5);
  expect(await asOne(t, STEADY.code)).toBe(3.5);
  expect(await asOne(t, BLANK.code)).toBe(2.5);
  expect(await asOne(t, CAMEO.code)).toBe(1);
  expect((await starsRows(t)).get(SCORER.code)).toMatchObject({ matches: MATCHES.length });
});

test("two matches show “?”, and one who never came on holds no row", async () => {
  const t = await rated();
  expect(await asOne(t, NEWCOMER.code)).toBe(UNSURE);
  expect((await starsRows(t)).get(NEWCOMER.code)).toMatchObject({ matches: 2 });
  expect((await starsRows(t)).has(UNUSED.code)).toBe(false);
});

test("a centre-back is rated for every defence role, against the defence alone", async () => {
  const t = await rated();
  const stars = await starsOf(t, STOPPER.code);
  expect([...stars.keys()]).toEqual([...DEFAULT_ROLES.FB, ...DEFAULT_ROLES.CB, ...DEFAULT_ROLES.SW].map((role) => `defence/${role.key}`));
  expect(new Set(stars.values())).toEqual(new Set([5]));
});

test("a match locking with no stars held yet refreshes every player", async () => {
  const t = freshConvex();
  await holdStarsPlayers(t);
  await t.mutation(internal.stars.starsRefresh.refreshMatch, { fixtureCode: MATCHES[0] });
  await refreshesRun(t);
  expect(await asOne(t, SCORER.code)).toBe(5);
  expect(await asOne(t, CAMEO.code)).toBe(1);
});

test("a later lock works out its own players again and ranks everyone: Blank's five goals move Steady down", async () => {
  const t = await rated();
  const LATE = 504;
  await t.run(async (ctx) => {
    await insertMatch(ctx, LATE, MATCHES.length);
    await ctx.db.insert("playerMatchStats", lockedRecord(BLANK.code, LATE, { minutes: 90, goals_scored: 5 }));
  });

  await t.mutation(internal.stars.starsRefresh.refreshMatch, { fixtureCode: LATE });
  await refreshesRun(t);

  // Blank: (2 + 2 + 2 + 22) / 4 = 7 a match, now above Steady's 6.
  expect((await starsRows(t)).get(BLANK.code)).toMatchObject({ matches: 4 });
  expect(await asOne(t, BLANK.code)).toBe(3.5);
  expect(await asOne(t, STEADY.code)).toBe(2.5);
});

test("a player who has left the Premier League, on no squad, drops out on the next refresh of everyone", async () => {
  const t = await rated();
  await t.run(async (ctx) => {
    const cameo = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", CAMEO.code)).unique())!;
    await ctx.db.patch("players", cameo._id, { droppedAt: Date.now() });
  });
  vi.advanceTimersByTime(HOUR_MS);

  await refreshEveryone(t);

  expect((await starsRows(t)).has(CAMEO.code)).toBe(false);
  // Of three, two above Blank is 67%, past 2's cut (65%): 1.5 stars.
  expect(await asOne(t, BLANK.code)).toBe(1.5);
});

test("matches are priced under today's scoring: a role's adjustment in force lifts his points per match under it", async () => {
  const t = await rated();
  const poacher = DEFAULT_ROLES.ST[0].key;
  const ratingOf = async (role: string) => (await starsRows(t)).get(SCORER.code)!.ratings.find((rating) => rating.role === role)!.perMatch;
  const before = await ratingOf(poacher);
  await t.run((ctx) =>
    holdSiteScoring(ctx, {
      scoring: { ...FIRST_SCORING, roleAdjustments: [{ role: poacher, adjustments: [{ stat: "goals_scored", points: 1 }] }] },
      kind: "patch",
      season: 2026,
      number: 1,
      at: Date.now(),
    }),
  );

  await refreshEveryone(t);

  expect(await ratingOf(poacher)).toBe(before + 2);
  expect(await ratingOf(DEFAULT_ROLES.ST[1].key)).toBe(before);
});

test(`a refresh of everyone goes a page of ${STARS_PAGE} players at a time`, async () => {
  const t = freshConvex();
  const many = Array.from({ length: STARS_PAGE + 1 }, (_, index) => ({ code: 3000 + index, name: `P${index}`, fullName: `P${index}`, clubCode: ARSENAL.code, positions: ["ST" as const] }));
  await t.run((ctx) => insertPlayers(ctx, many));

  await t.mutation(internal.stars.starsRefresh.refreshAll, { cursor: null });

  expect(await pendingJobs(t, internal.stars.starsRefresh.refreshAll)).toHaveLength(1);
  expect(await pendingJobs(t, internal.stars.starsRefresh.rank)).toHaveLength(0);
  await refreshesRun(t);
  expect(await pendingJobs(t)).toHaveLength(0);
});

test("a player who loses every position drops his row on the next refresh", async () => {
  const t = await rated();
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", STEADY.code)).unique())!;
    await ctx.db.patch("playerPositions", row._id, { set: [] });
  });

  await refreshEveryone(t);

  expect((await starsRows(t)).has(STEADY.code)).toBe(false);
});

test("a match with records but no kickoff held is left out, said, and everyone else is still rated", async () => {
  const logged = silenceConsoleError();
  const t = freshConvex();
  await holdStarsPlayers(t);
  const UNDATED = 509;
  await t.run(async (ctx) => {
    await ctx.db.insert("fixtures", { code: UNDATED, gameweek: null, homeClubCode: ARSENAL.code, awayClubCode: ARSENAL.code, kickoff: null });
    await ctx.db.insert("playerMatchStats", lockedRecord(SCORER.code, UNDATED, { minutes: 90 }));
  });

  await refreshEveryone(t);

  expect((await starsRows(t)).get(SCORER.code)).toMatchObject({ matches: MATCHES.length });
  expect(await asOne(t, SCORER.code)).toBe(5);
  expect(await asOne(t, CAMEO.code)).toBe(1);
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`match ${UNDATED}`));
});

test("a player whose record can't be priced keeps the stars he had, said, and the rest are rated again", async () => {
  const logged = silenceConsoleError();
  const t = await rated();
  const before = (await starsRows(t)).get(STEADY.code);
  const LATE = 504;
  await t.run(async (ctx) => {
    await insertMatch(ctx, LATE, MATCHES.length);
    await ctx.db.insert("playerMatchStats", lockedRecord(STEADY.code, LATE, { minutes: 90, goals_scored: Number.POSITIVE_INFINITY }));
    await ctx.db.insert("playerMatchStats", lockedRecord(BLANK.code, LATE, { minutes: 90, goals_scored: 5 }));
  });

  await t.mutation(internal.stars.starsRefresh.refreshMatch, { fixtureCode: LATE });
  await refreshesRun(t);

  expect((await starsRows(t)).get(STEADY.code)?.matches).toBe(before?.matches);
  expect((await starsRows(t)).get(BLANK.code)).toMatchObject({ matches: 4 });
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`Player ${STEADY.code}'s stars`));
});

test("a refresh of everyone stopped part-way loses no row", async () => {
  const t = freshConvex();
  const many = Array.from({ length: STARS_PAGE + 1 }, (_, index) => ({ code: 3000 + index, name: `P${index}`, fullName: `P${index}`, clubCode: ARSENAL.code, positions: ["ST" as const] }));
  await holdStarsPlayers(t);
  await t.run((ctx) => insertPlayers(ctx, many));
  await refreshEveryone(t);
  const before = await starsRows(t);

  // One page, then the run stops: the next page and the ranking never come.
  await t.mutation(internal.stars.starsRefresh.refreshAll, { cursor: null });

  expect([...(await starsRows(t)).keys()].sort()).toEqual([...before.keys()].sort());
});
