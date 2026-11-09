import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Cell } from "../../../convex/lineup/pitch";
import { ROLE_CARD_MATCHES } from "../../../convex/lineup/roleCardShape";
import { roleIn, rolesOfSlot } from "../../../convex/lineup/roles";
import { categoryName } from "../../../convex/scoring/categories";
import { scoreMatch } from "../../../convex/scoring/scoring";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, COVENTRY, completeRecord, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { MANAGERS, OUTSIDER, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { EXAMPLE_SET, GOAL_AND_ASSIST, pricedRole } from "../../support/convex/scoring.example";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { expectRefused } from "../../support/convex/test.harness";

// A player's role card for a slot (#848; spec/05 Roles): the slot's roles, what each scores more
// and less for in the site's set, and his last 5 matches played priced under each, against his
// base points (Craig, 6 Nov 2026, on #848). The site plays EXAMPLE_SET with two roles scored.

const [ANN] = MANAGERS;
const NOW = Date.parse("2026-10-01T12:00:00Z");
const STRIKER: Cell = { area: "attack", lane: "centre" };
const CENTRE_BACK: Cell = { area: "defence", lane: "centre" };
/** A back four's two centre-backs, then a back three's three. */
const BACK_FOUR: Cell[] = [STRIKER, { area: "defence", lane: "leftCentre" }, { area: "defence", lane: "rightCentre" }];
const BACK_THREE: Cell[] = [STRIKER, { area: "defence", lane: "leftCentre" }, CENTRE_BACK, { area: "defence", lane: "rightCentre" }];

/** A poacher earns +1 a goal, a false 9 +2 an assist. */
const SET = { ...structuredClone(EXAMPLE_SET), roles: [pricedRole("poacher", "goals_scored", 1), pricedRole("falseNine", "assists", 2)] } as StoredScoringSet;

/** An Arsenal striker who joined from Chelsea: his first match was Chelsea's. */
const FORWARD = { code: 1003, name: "Forward", fullName: "Forward", clubCode: ARSENAL.code, news: "", chanceOfPlaying: null, positions: ["ST" as const] };

/** Seven matches a week apart, gameweeks 1 to 7, the newest last: Arsenal at home to Coventry but
 *  the first, Chelsea at home to Coventry. */
const MATCHES = Array.from({ length: 7 }, (_, index) => ({
  code: 100 + index,
  gameweek: index + 1,
  homeClubCode: index === 0 ? CHELSEA.code : ARSENAL.code,
  awayClubCode: COVENTRY.code,
  kickoff: NOW - (7 - index) * 7 * DAY_MS,
}));

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, [ANN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA, COVENTRY]);
    await insertPlayers(ctx, [FORWARD]);
    for (const each of MATCHES) await ctx.db.insert("fixtures", each);
    await holdSiteScoring(ctx, { scoring: SET, kind: "fix", season: 2026, number: 1, at: 0 });
  });
});

const hold = (...records: (Omit<ReturnType<typeof completeRecord>, "state"> & { state: "provisional" | "complete" })[]) =>
  t.run(async (ctx) => {
    for (const record of records) await ctx.db.insert("playerMatchStats", record);
  });

const cardAs = async (email: string, cell = STRIKER, formation = BACK_FOUR) =>
  (await actingAs(t, email)).query(api.lineup.roleCard.forSlot, { leagueId, playerCode: FORWARD.code, cell, formation, now: NOW });

test("the card lists exactly the slot's roles, in its order, with their descriptions", async () => {
  const { roles } = await cardAs(ANN);
  expect(roles.map(({ key }) => key)).toEqual(rolesOfSlot(STRIKER, BACK_FOUR).map(({ key }) => key));
  expect(roles[0].description).toBe(roleIn(STRIKER, roles[0].key).description);
});

test("a centre-back's card offers sweeper and libero only in a back three", async () => {
  expect((await cardAs(ANN, CENTRE_BACK, BACK_FOUR)).roles.map(({ key }) => key)).toEqual(rolesOfSlot(CENTRE_BACK, BACK_FOUR).map(({ key }) => key));
  expect((await cardAs(ANN, CENTRE_BACK, BACK_THREE)).roles.map(({ key }) => key)).toContain("libero");
});

test("each role's more and less come from its adjustments in the site's set, else the role's own words", async () => {
  const { roles } = await cardAs(ANN);
  const role = (key: string) => roles.find((each) => each.key === key)!;
  expect(role("poacher")).toMatchObject({ rewards: [categoryName("goals_scored")], punishes: [categoryName("hand_ball")] });
  expect(role("falseNine")).toMatchObject({ rewards: [categoryName("assists")], punishes: [categoryName("hand_ball")] });
  // The set scores no target man: his own words.
  expect(role("targetMan")).toMatchObject({ rewards: roleIn(STRIKER, "targetMan").rewards, punishes: roleIn(STRIKER, "targetMan").costs });
});

test("with no match played the card has none", async () => {
  expect((await cardAs(ANN)).matches).toEqual([]);
});

test("a match priced under two roles gives the two totals the scoring gives, against his base points", async () => {
  await hold(completeRecord(FORWARD.code, MATCHES[6].code, GOAL_AND_ASSIST));
  const [match] = (await cardAs(ANN)).matches;
  const under = (role: string) => match.roles.find((each) => each.role === role)!;

  expect(match).toMatchObject({ gameweek: 7, pastSeason: null, opponent: { club: COVENTRY, home: true }, minutes: 90, base: scoreMatch(GOAL_AND_ASSIST, SET, STRIKER).total });
  expect(under("poacher")).toMatchObject({ points: 1, total: scoreMatch(GOAL_AND_ASSIST, SET, STRIKER, "poacher").total });
  expect(under("falseNine")).toMatchObject({ points: 2, total: scoreMatch(GOAL_AND_ASSIST, SET, STRIKER, "falseNine").total });
  expect(under("poacher").line).toMatchObject({ name: "Poacher", points: 1 });
  // A role the set doesn't score adds nothing and has no line.
  expect(under("targetMan")).toEqual({ role: "targetMan", points: 0, total: match.base, line: null });
});

test("only his last 5 matches played count, cameos included, newest first, at whichever club", async () => {
  await hold(
    completeRecord(FORWARD.code, MATCHES[0].code, { minutes: 90 }),
    completeRecord(FORWARD.code, MATCHES[1].code, { minutes: 90 }),
    completeRecord(FORWARD.code, MATCHES[2].code, { minutes: 3 }),
    // An unused substitute, and a match still live, aren't played.
    completeRecord(FORWARD.code, MATCHES[3].code, {}, { played: false }),
    { ...completeRecord(FORWARD.code, MATCHES[4].code, { minutes: 90 }), state: "provisional" as const },
    completeRecord(FORWARD.code, MATCHES[5].code, { minutes: 90 }),
    completeRecord(FORWARD.code, MATCHES[6].code, { minutes: 90 }),
  );
  await t.run(async (ctx) => {
    const first = await ctx.db.query("playerMatchStats").withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", MATCHES[0].code)).unique();
    await ctx.db.patch("playerMatchStats", first!._id, { clubCode: CHELSEA.code });
  });
  const { matches } = await cardAs(ANN);

  expect(matches.map(({ gameweek }) => gameweek)).toEqual([7, 6, 3, 2, 1]);
  expect(matches).toHaveLength(ROLE_CARD_MATCHES);
  expect(matches[2].minutes).toBe(3);
  // Gameweek 1, for Chelsea at home to Coventry.
  expect(matches[4].opponent).toEqual({ club: COVENTRY, home: true });
});

test("last season's matches played fill in behind this season's", async () => {
  await hold(completeRecord(FORWARD.code, MATCHES[6].code, GOAL_AND_ASSIST));
  await t.run(async (ctx) => {
    const past = (kickoff: number, stats: Record<string, number>) =>
      ctx.db.insert("pastPlayerMatchStats", { season: 2025, playerCode: FORWARD.code, fplPosition: 4, match: { kickoff, startingPosition: "ST", stats } });
    await past(1, { minutes: 90, goals_scored: 2 });
    await past(2, { minutes: 0 });
    await past(3, { minutes: 20 });
  });
  const { matches } = await cardAs(ANN);

  expect(matches.map(({ gameweek, pastSeason, minutes }) => ({ gameweek, pastSeason, minutes }))).toEqual([
    { gameweek: 7, pastSeason: null, minutes: 90 },
    { gameweek: null, pastSeason: 2025, minutes: 20 },
    { gameweek: null, pastSeason: 2025, minutes: 90 },
  ]);
  expect(matches[2]).toMatchObject({ opponent: null, base: scoreMatch({ minutes: 90, goals_scored: 2 }, SET, STRIKER).total });
});

test("someone with no team in the league is refused", async () => {
  await expectRefused(cardAs(OUTSIDER), refusals.runsNoTeam);
});
