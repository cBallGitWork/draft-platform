import type { Infer } from "convex/values";
import { beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { matchMoveRefusals, matchMoveWarnings } from "../../../convex/gameweeks/matchMoves";
import { noSuchGameweek } from "../../../convex/gameweeks/usedGameweeks";
import type { fixtureRecord } from "../../../convex/schema";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { actingAs, adminCreatesLeague, LEAGUE_NAME, OUTSIDER } from "../../support/convex/leagues.harness";
import { asAdmin } from "../../support/convex/positionsSync.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused, type TestConvex } from "../../support/convex/test.harness";

// The admin moves a match to another gameweek (#1417; spec/07 S07.9), an override the window rule
// (#1416, roundStarts.ts) yields to until he clears it, logged where only he sees it (spec/15).

type Fixture = Infer<typeof fixtureRecord>;

const ROUND_12 = Date.parse("2026-11-21T15:00:00Z");
const ROUNDS = [12, 13, 14, 15];
const startOf = (round: number) => ROUND_12 + (round - 12) * WEEK_MS;

/** Two matches a round, one at its start and one two hours on: `round * 10 + 1` and `+ 2`. */
const SENT: Fixture[] = ROUNDS.flatMap((round) => [
  { code: round * 10 + 1, gameweek: round, homeClubCode: 1, awayClubCode: 2, kickoff: startOf(round) },
  { code: round * 10 + 2, gameweek: round, homeClubCode: 3, awayClubCode: 4, kickoff: startOf(round) + 2 * HOUR_MS },
]);
/** Round 14's later match. */
const LATER_14 = 142;

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment(ROUND_12 - DAY_MS);
  // A league made here sends its commissioner a sign-in link.
  fakeResend();
  await sync();
});

const sync = () => t.mutation(internal.football.footballSync.upsertFixtures, { rows: SENT });
const move = async (fixtureCode: number, gameweek: number | null) =>
  (await asAdmin(t)).mutation(api.gameweeks.matchMoves.move, { fixtureCode, gameweek });
const gameweekOf = async (code: number) =>
  t.run(async (ctx) => (await ctx.db.query("fixtures").withIndex("by_code", (q) => q.eq("code", code)).unique())!.gameweek);

test("a match moved from gameweek 14 to 15 is in 15, and back in 14 once the move is cleared", async () => {
  expect(await move(LATER_14, 15)).toEqual({ warnings: [] });
  expect(await gameweekOf(LATER_14)).toBe(15);

  await move(LATER_14, null);
  expect(await gameweekOf(LATER_14)).toBe(14);
});

test("the window rule yields to a move: the next sync leaves the match where the admin put it, until he clears it", async () => {
  await move(LATER_14, 15);

  await sync();
  expect(await gameweekOf(LATER_14)).toBe(15);

  await move(LATER_14, null);
  await sync();
  expect(await gameweekOf(LATER_14)).toBe(14);
});

test("only the admin moves a match or reads his log", async () => {
  const outsider = await actingAs(t, OUTSIDER);
  await expectRefused(outsider.mutation(api.gameweeks.matchMoves.move, { fixtureCode: LATER_14, gameweek: 15 }), refusals.notAdmin);
  await expectRefused(outsider.query(api.gameweeks.matchMoves.log, {}), refusals.notAdmin);
  expect(await gameweekOf(LATER_14)).toBe(14);
});

test("a match not held, or a gameweek the season doesn't have, is refused", async () => {
  await expectRefused(move(999, 15), matchMoveRefusals.noMatch);
  await expectRefused(move(LATER_14, 16), noSuchGameweek(16, 15));
});

test("his moves and clears are logged, newest first", async () => {
  await move(LATER_14, 15);
  vi.advanceTimersByTime(HOUR_MS);
  await move(LATER_14, null);

  const { rows, more } = await (await asAdmin(t)).query(api.gameweeks.matchMoves.log, {});
  expect(rows.map(({ fixtureCode, from, to }) => ({ fixtureCode, from, to }))).toEqual([
    { fixtureCode: LATER_14, from: 15, to: null },
    { fixtureCode: LATER_14, from: 14, to: 15 },
  ]);
  expect(more).toBe(false);
});

test("a move that makes a gameweek's deadline fall before the gameweek before it ends warns the admin", async () => {
  await adminCreatesLeague(t);

  // Round 14's opener into gameweek 15: 15's first kickoff, before 14's later match.
  expect(await move(141, 15)).toEqual({ warnings: [matchMoveWarnings.beforeLastEnds(15, [LEAGUE_NAME])] });
});

test("a played match moved to a gameweek not yet begun warns that its deadline is already past", async () => {
  await adminCreatesLeague(t);
  vi.setSystemTime(startOf(14) + HOUR_MS);

  expect(await move(141, 15)).toEqual({ warnings: [matchMoveWarnings.past(15, [LEAGUE_NAME])] });
  expect(await gameweekOf(141)).toBe(15);
});
