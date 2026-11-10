import type { Infer } from "convex/values";
import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { inKickoffOrder, windowGameweek } from "../../../convex/gameweeks/roundStarts";
import type { fixtureRecord } from "../../../convex/schema";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// A gameweek is a date window (spec/05 S05.22, spec/07 S07.9; #1416): gameweek N runs from the
// feed's round N's first kickoff as first scheduled to round N+1's, and each match counts in the
// window it kicks off in, so a rearranged match makes a double or a blank week.

type Fixture = Infer<typeof fixtureRecord>;

const ROUND_12 = Date.parse("2026-11-21T15:00:00Z");
const ROUND_13 = ROUND_12 + WEEK_MS;
const ROUND_14 = ROUND_13 + WEEK_MS;
/** The Tuesday evening after round 14 starts. */
const MIDWEEK_AFTER_14 = ROUND_14 + 3 * DAY_MS + 4 * HOUR_MS;

/** Two matches a round, clubs 1 and 2 meeting in each round, 3 and 4 too, home and away turned. */
const SENT: Fixture[] = [ROUND_12, ROUND_13, ROUND_14].flatMap((kickoff, index) => {
  const round = 12 + index;
  const turned = index % 2 === 1;
  return [
    { code: round * 10 + 1, gameweek: round, homeClubCode: turned ? 2 : 1, awayClubCode: turned ? 1 : 2, kickoff },
    { code: round * 10 + 2, gameweek: round, homeClubCode: turned ? 4 : 3, awayClubCode: turned ? 3 : 4, kickoff: kickoff + 2 * HOUR_MS },
  ];
});
/** Round 12's clubs 1 v 2. */
const REARRANGED = 121;

let t: TestConvex;
beforeEach(() => {
  t = freshConvex();
});

const sync = (rows: Fixture[]) => t.mutation(internal.football.footballSync.upsertFixtures, { rows });
/** Each held match's gameweek, by its code. */
const heldGameweeks = async () => new Map((await t.run((ctx) => ctx.db.query("fixtures").collect())).map((row) => [row.code, row.gameweek]));
/** The gameweeks a club plays in, a double named twice. */
const gameweeksOf = async (club: number) =>
  (await t.run((ctx) => ctx.db.query("fixtures").collect()))
    .filter((row) => row.homeClubCode === club || row.awayClubCode === club)
    .map((row) => row.gameweek);
const rearranged = (change: Partial<Fixture>) => SENT.map((row) => (row.code === REARRANGED ? { ...row, ...change } : row));

test("each match is held in the gameweek its round makes, while nothing has moved", async () => {
  await sync(SENT);

  expect(await heldGameweeks()).toEqual(new Map(SENT.map((row) => [row.code, row.gameweek])));
});

test("a round 12 match moved to a midweek after round 14 starts counts in gameweek 14: a double for both clubs, a blank in 12", async () => {
  await sync(SENT);

  await sync(rearranged({ kickoff: MIDWEEK_AFTER_14 }));

  expect((await heldGameweeks()).get(REARRANGED)).toBe(14);
  for (const club of [1, 2]) expect((await gameweeksOf(club)).toSorted()).toEqual([13, 14, 14]);
  expect((await gameweeksOf(3)).toSorted()).toEqual([12, 13, 14]);
});

test("the feed's round isn't followed: a match it renumbers stays in the window it kicks off in", async () => {
  await sync(SENT);

  await sync(rearranged({ gameweek: 14 }));

  expect((await heldGameweeks()).get(REARRANGED)).toBe(12);
});

test("a match moved with no new date is in no gameweek until it gets one", async () => {
  await sync(SENT);

  await sync(rearranged({ gameweek: null, kickoff: null }));
  expect((await heldGameweeks()).get(REARRANGED)).toBeNull();

  await sync(rearranged({ gameweek: null }));
  expect((await heldGameweeks()).get(REARRANGED)).toBeNull();

  await sync(rearranged({ kickoff: MIDWEEK_AFTER_14 }));
  expect((await heldGameweeks()).get(REARRANGED)).toBe(14);
});

test("a round's start is its first kickoff as first seen: later moves never change it", async () => {
  await sync(SENT);
  const starts = () => t.run(async (ctx) => (await ctx.db.query("roundStarts").collect()).map(({ round, firstKickoff }) => [round, firstKickoff]));
  const first = await starts();
  expect(first).toEqual([
    [12, ROUND_12],
    [13, ROUND_13],
    [14, ROUND_14],
  ]);

  await sync(SENT.map((row) => ({ ...row, kickoff: row.kickoff! + HOUR_MS })));

  expect(await starts()).toEqual(first);
});

test("a kickoff before the season's first round starts is in no gameweek; one after the last start is in the last", () => {
  const starts = new Map([
    [1, ROUND_12],
    [2, ROUND_13],
  ]);

  expect(windowGameweek(ROUND_12 - 1, starts)).toBeNull();
  expect(windowGameweek(ROUND_12, starts)).toBe(1);
  expect(windowGameweek(ROUND_13 - 1, starts)).toBe(1);
  expect(windowGameweek(ROUND_13 + 10 * WEEK_MS, starts)).toBe(2);
  expect(windowGameweek(null, starts)).toBeNull();
});

test("the sync hands its matches over earliest first, those with no kickoff time last", () => {
  const unordered: Fixture[] = [{ ...SENT[3], kickoff: null }, SENT[2], SENT[0]];

  expect(inKickoffOrder(unordered).map(({ code }) => code)).toEqual([SENT[0].code, SENT[2].code, SENT[3].code]);
});
