import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MANAGERS, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { STARS_PAGE } from "../../../convex/stars/starsRefresh";
import { ARSENAL, insertPlayers } from "../../support/convex/footballRows.harness";
import { BLANK, CAMEO, MATCHES, holdStarsPlayers, lockedRecord, refreshesRun, refreshEveryone, starsRows } from "../../support/convex/stars.harness";
import { pendingJobs, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";

// A player gone from the Premier League keeps his stars while a squad in any league holds him, so
// his manager still sees them, and loses them once none does (#11, starsRefresh.ts).

const [ANN] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdStarsPlayers(t);
  await refreshEveryone(t);
  await t.run(async (ctx) => {
    const cameo = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", CAMEO.code)).unique())!;
    await ctx.db.patch("players", cameo._id, { droppedAt: Date.now() });
  });
});

const annHolds = (playerCode: number) => t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode }));

test("gone but on a squad, he keeps his row through a refresh of everyone, and is still ranked", async () => {
  await annHolds(CAMEO.code);
  const before = (await starsRows(t)).get(CAMEO.code);

  await refreshEveryone(t);

  expect((await starsRows(t)).get(CAMEO.code)?.ratings).toEqual(before?.ratings);
  // Still four in the pool: two above Blank is 50%, 2.5 stars.
  expect((await starsRows(t)).get(BLANK.code)?.ratings[0].stars).toBe(2.5);
});

test("gone and on no squad, he loses his row, and a match locking after doesn't give it back", async () => {
  await refreshEveryone(t);
  expect((await starsRows(t)).has(CAMEO.code)).toBe(false);

  await t.mutation(internal.stars.starsRefresh.refreshMatch, { fixtureCode: MATCHES[0] });
  await refreshesRun(t);

  expect((await starsRows(t)).has(CAMEO.code)).toBe(false);
});

test("gone but on a squad, a match locking keeps his row", async () => {
  await annHolds(CAMEO.code);

  await t.mutation(internal.stars.starsRefresh.refreshMatch, { fixtureCode: MATCHES[0] });
  await refreshesRun(t);

  expect((await starsRows(t)).get(CAMEO.code)).toMatchObject({ matches: MATCHES.length });
});

test(`more gone players than a page, ${STARS_PAGE + 1}, are worked through a page at a time, then everyone is ranked`, ROWS_TO_THE_CAP, async () => {
  const many = Array.from({ length: STARS_PAGE + 1 }, (_, index) => ({ code: 5000 + index, name: `G${index}`, fullName: `G${index}`, clubCode: ARSENAL.code, positions: ["ST" as const] }));
  await t.run(async (ctx) => {
    await insertPlayers(ctx, many);
    for (const { code } of many) for (const fixtureCode of MATCHES) await ctx.db.insert("playerMatchStats", lockedRecord(code, fixtureCode, { minutes: 90 }));
  });
  await refreshEveryone(t);
  await annHolds(many[0].code);
  await t.run(async (ctx) => {
    for (const { code } of many) {
      const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique())!;
      await ctx.db.patch("players", player._id, { droppedAt: Date.now() });
    }
  });

  await t.mutation(internal.stars.starsRefresh.refreshAll, { cursor: null });
  await refreshesRun(t);

  const rows = await starsRows(t);
  expect(many.filter(({ code }) => rows.has(code)).map(({ code }) => code)).toEqual([many[0].code]);
  expect(await pendingJobs(t)).toHaveLength(0);
});
