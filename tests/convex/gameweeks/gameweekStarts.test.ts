import { beforeEach, expect, test } from "vitest";
import type { ScheduledMatch } from "../../../convex/gameweeks/deadline";
import { gameweekStartsOf, recordGameweekStarts } from "../../../convex/gameweeks/gameweekStarts";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// Each gameweek's first kickoff, recorded once it passes and kept where it fell (#414), by season:
// FPL numbers every season's gameweeks 1 to 38 again.

const SATURDAY_3PM = Date.parse("2026-10-24T14:00:00Z");
/** Gameweek 9 kicks off at 3pm, its second match two hours later; gameweek 10 a week on. */
const MATCHES: ScheduledMatch[] = [
  { gameweek: 9, kickoff: SATURDAY_3PM },
  { gameweek: 9, kickoff: SATURDAY_3PM + 2 * HOUR_MS },
  { gameweek: 10, kickoff: SATURDAY_3PM + WEEK_MS },
];
/** The same day of the week a year on: next season. */
const A_SEASON_ON = 52 * WEEK_MS;
/** Gameweek 9 with its opener postponed: no gameweek, no kickoff. */
const OPENER_POSTPONED: ScheduledMatch[] = [{ gameweek: null, kickoff: null }, ...MATCHES.slice(1)];

let t: TestConvex;
beforeEach(() => {
  t = freshConvex();
});

const record = (matches: readonly ScheduledMatch[], now: number) => t.run((ctx) => recordGameweekStarts(ctx, matches, now));
/** The recorded starts read for `matches`, as [gameweek, first kickoff] pairs: a Map can't leave t.run. */
const startsOf = async (matches: readonly ScheduledMatch[]) => new Map(await t.run(async (ctx) => [...(await gameweekStartsOf(ctx, matches))]));
const rows = () => t.run((ctx) => ctx.db.query("gameweekStarts").collect());

test("records a gameweek's first kickoff once it has passed, and not before", async () => {
  await record(MATCHES, SATURDAY_3PM - 1);
  expect(await startsOf(MATCHES)).toEqual(new Map());

  await record(MATCHES, SATURDAY_3PM);
  expect(await startsOf(MATCHES)).toEqual(new Map([[9, SATURDAY_3PM]]));
});

test("a recorded start stays where it fell once the first match leaves the gameweek", async () => {
  await record(MATCHES, SATURDAY_3PM + HOUR_MS);
  await record(OPENER_POSTPONED, SATURDAY_3PM + 3 * HOUR_MS);

  expect(await startsOf(OPENER_POSTPONED)).toEqual(new Map([[9, SATURDAY_3PM]]));
  expect(await rows()).toHaveLength(1);
});

test("recording twice is harmless: one row a gameweek", async () => {
  await record(MATCHES, SATURDAY_3PM + WEEK_MS);
  await record(MATCHES, SATURDAY_3PM + WEEK_MS);

  expect((await rows()).map(({ gameweek }) => gameweek).toSorted((one, other) => one - other)).toEqual([9, 10]);
});

test("a start recorded last season isn't read for the same gameweek this season", async () => {
  const nextSeason = MATCHES.map((match) => ({ ...match, kickoff: match.kickoff! + A_SEASON_ON }));
  await record(MATCHES, SATURDAY_3PM);

  expect(await startsOf(nextSeason)).toEqual(new Map());
  await record(nextSeason, nextSeason[0].kickoff!);
  expect(await startsOf(nextSeason)).toEqual(new Map([[9, nextSeason[0].kickoff]]));
});

test("while a new season's matches arrive beside last season's, last season's start nothing in the new one", async () => {
  const nextSeasonOpener = { gameweek: 9, kickoff: SATURDAY_3PM + A_SEASON_ON };
  await record([...MATCHES, nextSeasonOpener], SATURDAY_3PM + 2 * WEEK_MS);

  expect(await rows()).toEqual([]);
});

test("with no kickoff held, nothing is recorded or read", async () => {
  await record([{ gameweek: null, kickoff: null }], SATURDAY_3PM);

  expect(await rows()).toEqual([]);
  expect(await startsOf([])).toEqual(new Map());
});
