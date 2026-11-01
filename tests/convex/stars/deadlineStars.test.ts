import { beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { deadlineStarsIn } from "../../../convex/stars/deadlineStars";
import { UNSURE, type Stars } from "../../../convex/stars/starsShape";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { FOUR_FOUR_TWO, holdSquad, passNextDeadline } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { pendingJobs } from "../../support/convex/test.harness";

// Stars kept at the deadline (#11, deadlineStars.ts; spec/05 Auto-subs, Craig, 1 Nov 2026): each
// team's bench as it stood when the lineup locked, with the stars that pick an auto-sub's role.

const [ANN] = MANAGERS;
const NEXT = 9;
const [FIRST_ON] = FOUR_FOUR_TWO.bench;
const RATED = { area: "midfield" as const, role: "playmaker", stars: 4 as Stars };
const UNSURE_RATING = { area: "midfield" as const, role: "boxToBox", stars: UNSURE as Stars };

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  vi.useFakeTimers();
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
  await holdSquad(t, leagueId, annsTeam);
  await (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [...FOUR_FOUR_TWO.starters], bench: [...FOUR_FOUR_TWO.bench] } });
  const ratings = [RATED, UNSURE_RATING].map((rating) => ({ ...rating, perMatch: 5 }));
  await t.run((ctx) => ctx.db.insert("playerRoleStars", { playerCode: FIRST_ON, matches: 3, ratings }));
});

/** What auto-subs read for gameweek NEXT: each team's bench players' kept stars. */
async function kept() {
  const teams = await t.run(async (ctx) => [...(await deadlineStarsIn(ctx, leagueId, NEXT))].map(([teamId, bench]) => ({ teamId, bench: [...bench] })));
  return new Map(teams.map(({ teamId, bench }) => [teamId, new Map(bench)]));
}

test("the deadline's recording asks for the league's benches to be kept with their stars", async () => {
  await passNextDeadline(t);
  expect((await pendingJobs(t, internal.stars.deadlineStars.storeLeague)).map((job) => job.args[0])).toContainEqual({ leagueId, gameweek: NEXT });
});

test("each bench player is kept with his rated roles; “?” and “—” pick nothing, so aren't kept", async () => {
  await passNextDeadline(t);
  await t.mutation(internal.stars.deadlineStars.storeLeague, { leagueId, gameweek: NEXT });

  const bench = (await kept()).get(annsTeam)!;
  expect([...bench.keys()]).toEqual(FOUR_FOUR_TWO.bench);
  expect(bench.get(FIRST_ON)).toEqual([RATED]);
});

test("kept once: stars changed after the deadline don't reach a second keeping", async () => {
  await passNextDeadline(t);
  await t.mutation(internal.stars.deadlineStars.storeLeague, { leagueId, gameweek: NEXT });
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("playerRoleStars").withIndex("by_playerCode", (q) => q.eq("playerCode", FIRST_ON)).unique())!;
    await ctx.db.patch("playerRoleStars", row._id, { ratings: [{ ...RATED, stars: 1, perMatch: 1 }] });
  });

  await t.mutation(internal.stars.deadlineStars.storeLeague, { leagueId, gameweek: NEXT });

  expect((await kept()).get(annsTeam)!.get(FIRST_ON)).toEqual([RATED]);
});

test("a gameweek with nothing kept, one locked before this was built, holds no stars", async () => {
  expect((await kept()).size).toBe(0);
});

test("a keeping that never happened is asked for again by the next recording, for the latest begun gameweek", async () => {
  await passNextDeadline(t);
  await t.mutation(internal.stars.deadlineStars.keepMissing, {});

  expect((await pendingJobs(t, internal.stars.deadlineStars.storeLeague)).map((job) => job.args[0])).toContainEqual({ leagueId, gameweek: NEXT });
  expect(await pendingJobs(t, internal.stars.deadlineStars.keepMissing)).not.toHaveLength(0);
});

/** How many keepings of gameweek NEXT are waiting. */
const askedForNext = async () => (await pendingJobs(t, internal.stars.deadlineStars.storeLeague)).filter((job) => job.args[0].gameweek === NEXT).length;

test("not asked for again once kept", async () => {
  await passNextDeadline(t);
  const before = await askedForNext();
  await t.run((ctx) => ctx.db.insert("deadlineStars", { leagueId, gameweek: NEXT, teamId: annsTeam, bench: [] }));

  await t.mutation(internal.stars.deadlineStars.keepMissing, {});

  expect(await askedForNext()).toBe(before);
});

test("not asked for again once one of the gameweek's matches has locked, after which stars may have moved", async () => {
  await passNextDeadline(t);
  const before = await askedForNext();
  await t.run(async (ctx) => {
    const [fixture] = await ctx.db.query("fixtures").withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", NEXT)).collect();
    await ctx.db.insert("matchStatsStatus", { fixtureCode: fixture.code, state: "locked", fullTimeAt: Date.now(), lastReadAt: Date.now(), lockedAt: Date.now() });
  });

  await t.mutation(internal.stars.deadlineStars.keepMissing, {});

  expect(await askedForNext()).toBe(before);
});
