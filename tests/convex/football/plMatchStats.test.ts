import { expect, test } from "vitest";
import { codesByOpta } from "../../../convex/football/feedIds";
import { plStatLines, plStats } from "../../../convex/football/plMatch";
import type { RawPlPlayerStats } from "../../../convex/football/premierLeague";
import { fplElementsWithout, FULL_STATS, hullEvertonReads, MATCH, recordedGw6, recordedPlFixture } from "../../support/recorded/gw6.payloads";

const gw6 = recordedGw6();
const { fpl, pl } = gw6;
const hullEverton = recordedPlFixture(MATCH.hullEverton.pl);
const codeByOpta = codesByOpta(fpl.bootstrap.elements);
const reads = hullEvertonReads(gw6);
const readOf = (plId: number): RawPlPlayerStats => structuredClone(reads.get(plId)!);

test("a man's stats keep every name and value the feed sent", () => {
  const coyle = readOf(FULL_STATS.coyle.pl);

  const stats = plStats(coyle);

  expect(Object.keys(stats)).toHaveLength(66);
  expect(stats).toEqual(Object.fromEntries(coyle.stats.map((metric) => [metric.name, metric.value])));
  expect(stats).toMatchObject({ formation_place: 2, game_started: 1, mins_played: 90, won_tackle: 1 });
});

test("a stat the feed did not send is left absent, not filled in", () => {
  const stats = plStats(readOf(FULL_STATS.coyle.pl));
  expect("goals" in stats).toBe(false);
  // Some noughts are sent all the same: Opta's choice, kept as it came.
  expect(stats.winning_goal).toBe(0);
});

test("a substitute who came on has his own minutes, and an unused one only formation_place 0", () => {
  expect(plStats(readOf(FULL_STATS.belloumi.pl))).toMatchObject({
    total_sub_on: 1,
    mins_played: 26,
    goals: 1,
    formation_place: 0,
  });
  expect(plStats(readOf(FULL_STATS.phillips.pl))).toEqual({ formation_place: 0 });
});

test("a stat line is the man's and the match's FPL codes, for every man read", () => {
  const { lines, unmatched } = plStatLines(hullEverton, reads, codeByOpta);

  expect(unmatched).toEqual([]);
  expect(lines).toHaveLength(40);
  expect(lines.find((line) => line.playerCode === FULL_STATS.mcBurnie.code)).toEqual({
    playerCode: FULL_STATS.mcBurnie.code,
    fixtureCode: MATCH.hullEverton.code,
    stats: plStats(readOf(FULL_STATS.mcBurnie.pl)),
  });
});

test("a man read whom FPL does not list has no line and is reported; one not read is not", () => {
  const without = codesByOpta(fplElementsWithout(FULL_STATS.coyle.code, FULL_STATS.phillips.code));
  const twoReads = new Map([FULL_STATS.coyle.pl, FULL_STATS.mcBurnie.pl].map((id) => [id, readOf(id)]));

  const { lines, unmatched } = plStatLines(hullEverton, twoReads, without);

  expect(lines.map((line) => line.playerCode)).toEqual([FULL_STATS.mcBurnie.code]);
  expect(unmatched.map((man) => man.plPlayerId)).toEqual([FULL_STATS.coyle.pl]);
});

test("a read that answered for another man than asked throws", () => {
  const crossed = new Map([[FULL_STATS.coyle.pl, readOf(FULL_STATS.mcBurnie.pl)]]);
  expect(() => plStatLines(hullEverton, crossed, codeByOpta)).toThrow(
    `the stats read for player ${FULL_STATS.coyle.pl} answered for player ${FULL_STATS.mcBurnie.pl}`,
  );
});

test("a read for a man neither sheet names throws", () => {
  const palace = pl.playerStats.find((read) => read.fixture === MATCH.palaceForest.pl)!;
  const stray = new Map([[palace.player, palace.payload]]);

  expect(() => plStatLines(hullEverton, stray, codeByOpta)).toThrow(`sheets do not name player ${palace.player}`);
});

test.each([
  [
    "a stat sent twice",
    (read: RawPlPlayerStats) => {
      read.stats.push({ ...read.stats[0] });
    },
    "sent formation_place twice",
  ],
  [
    "a stat that is not a number",
    (read: RawPlPlayerStats) => {
      read.stats[0].value = "2" as never;
    },
    'stat {"name":"formation_place","value":"2"}',
  ],
  [
    "no stats list",
    (read: RawPlPlayerStats) => {
      delete (read as Partial<RawPlPlayerStats>).stats;
    },
    "sent no stats list",
  ],
] as const)("%s is a changed payload, and throws", (_what, change, message) => {
  const read = readOf(FULL_STATS.coyle.pl);
  change(read);

  expect(() => plStats(read)).toThrow(message);
});
