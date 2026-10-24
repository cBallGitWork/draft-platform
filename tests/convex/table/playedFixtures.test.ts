import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { holdGameweeks, rulesRevision, rulesWith } from "../../support/convex/leagueRules.harness";
import { actingAs, addManager, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A gameweek's fixtures are stored once it begins, and read as stored ever after (#137; spec/13,
// Gameweeks: "a change reshuffles only fixtures not yet played"; Craig, 22 Oct 2026: "A played
// gameweek's fixtures are therefore frozen and never re-drawn because a team joined").

const [ANN, BOB, CAT, DAN] = MANAGERS;
/** The gameweeks the tests play before changing anything: 1 to PLAYED. */
const PLAYED = 5;
/** A gameweek not yet begun, which the commissioner can still tick or untick. */
const FUTURE = PLAYED + 3;
/** How long after the league is made gameweek 1 kicks off: its deadline, 90 minutes before, falls
 *  after the league is made. Each next gameweek kicks off a week on. */
const KICKS_OFF_IN = 2 * HOUR_MS;

let t: TestConvex;
let leagueId: Id<"leagues">;
let seasonStart: number;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, [ANN, BOB, CAT]);
  seasonStart = Date.now();
  await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
});

/** Moves the clock on to just after `gameweek` kicks off: it and every one before have begun, and
 *  the next hasn't. */
const playUpTo = (gameweek: number) => vi.setSystemTime(seasonStart + (gameweek - 1) * WEEK_MS + KICKS_OFF_IN);
const recordPassed = () => t.run((ctx) => recordPassedDeadlines(ctx));
const storedRows = () => t.run((ctx) => ctx.db.query("playedFixtures").collect());
const storedGameweeksOf = async (league: Id<"leagues">) =>
  (await storedRows()).flatMap((row) => (row.leagueId === league ? [row.gameweek] : [])).toSorted((a, b) => a - b);
const read = async () => (await (await actingAs(t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId }))!.gameweeks;
type Gameweeks = Awaited<ReturnType<typeof read>>;
const played = (gameweeks: Gameweeks) => gameweeks.filter(({ gameweek }) => gameweek <= PLAYED);
const toCome = (gameweeks: Gameweeks) => gameweeks.filter(({ gameweek }) => gameweek > PLAYED);
const setUsed = async (gameweek: number, used: boolean) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId, gameweek, used });
const changeRules = async (change: Parameters<typeof rulesWith>[0]) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: rulesWith(change), revision: await rulesRevision(t, leagueId) });
const upTo = (last: number) => Array.from({ length: last }, (_, index) => index + 1);

describe("storing", () => {
  test("the football sync's recorder stores each gameweek once it has begun, and none before", async () => {
    playUpTo(PLAYED);
    await recordPassed();
    expect(await storedGameweeksOf(leagueId)).toEqual(upTo(PLAYED));

    playUpTo(PLAYED + 1);
    await recordPassed();
    expect(await storedGameweeksOf(leagueId)).toEqual(upTo(PLAYED + 1));
  });

  test("stores what the draw gave, so the fixtures read the same before and after", async () => {
    playUpTo(PLAYED);
    const drawn = await read();
    await recordPassed();
    expect(await read()).toEqual(drawn);
  });

  test("storing again stores nothing more and changes nothing", async () => {
    playUpTo(PLAYED);
    await recordPassed();
    const first = await storedRows();
    await recordPassed();
    expect(await storedRows()).toEqual(first);
  });

  test("a stored gameweek is read as stored, not drawn again", async () => {
    playUpTo(PLAYED);
    await recordPassed();
    const [drawn] = await read();
    // Turn gameweek 1's fixtures round, as a different draw might have had them.
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("playedFixtures").collect()).find((each) => each.gameweek === 1)!;
      await ctx.db.patch("playedFixtures", row._id, { fixtures: row.fixtures.toReversed() });
    });
    const [stored] = await read();
    expect(stored.fixtures).toEqual(drawn.fixtures.toReversed());
  });

  test("a gameweek that began before the league was made isn't stored: the league never played it (#282)", async () => {
    playUpTo(PLAYED);
    const later = await adminCreatesLeague(t, 4, "Later");
    await addManagers(t, later, [ANN, BOB]);
    await recordPassed();
    expect(await storedGameweeksOf(later)).toEqual([]);

    playUpTo(PLAYED + 1);
    await recordPassed();
    expect(await storedGameweeksOf(later)).toEqual([PLAYED + 1]);
  });

  test("nothing is stored for a league of one team, which has no fixtures", async () => {
    const lonely = await adminCreatesLeague(t, 4, "Lonely");
    await addManager(t, lonely, DAN);
    playUpTo(PLAYED);
    await recordPassed();
    expect(await storedGameweeksOf(lonely)).toEqual([]);
  });

  test("nothing is stored for a gameweek played as total points", async () => {
    await changeRules({ format: "totalPoints" });
    playUpTo(PLAYED);
    await recordPassed();
    expect(await storedRows()).toEqual([]);
  });
});

describe("a gameweek played keeps its fixtures", () => {
  beforeEach(async () => {
    playUpTo(PLAYED);
    await recordPassed();
  });

  test.each([
    ["unticking", false],
    ["ticking again", true],
  ])("%s a gameweek to come leaves gameweeks 1 to 5's pairings as they were", async (_, used) => {
    if (used) await setUsed(FUTURE, false);
    const before = await read();
    await setUsed(FUTURE, used);
    const after = await read();

    expect(played(after)).toEqual(played(before));
    expect(after.some(({ gameweek }) => gameweek === FUTURE)).toBe(used);
  });

  test("a rule change leaves the stored gameweeks as they were, and draws those to come by it", async () => {
    const before = await read();
    expect(await changeRules({ oddTeamOut: "bye", gamesPerGameweek: 2 })).toBe(PLAYED + 1);
    const after = await read();

    expect(played(after)).toEqual(played(before));
    expect(toCome(after)).not.toEqual(toCome(before));
  });

  test("a team joining leaves the stored gameweeks as they were, and plays only those to come", async () => {
    const before = await read();
    await addManager(t, leagueId, DAN);
    const after = await read();

    expect(played(after)).toEqual(played(before));
    const teamsPlaying = (gameweeks: Gameweeks) => gameweeks.flatMap(({ fixtures }) => fixtures.flatMap(({ team, opponent }) => [team, opponent]));
    expect(teamsPlaying(played(after))).not.toContain("Team 4");
    expect(teamsPlaying(toCome(after))).toContain("Team 4");
  });
});

test("a team joining stores the gameweeks begun first, even before the football sync has", async () => {
  playUpTo(PLAYED);
  const before = await read();
  expect(await storedRows()).toEqual([]);

  await addManager(t, leagueId, DAN);

  expect(await storedGameweeksOf(leagueId)).toEqual(upTo(PLAYED));
  expect(played(await read())).toEqual(played(before));
});
