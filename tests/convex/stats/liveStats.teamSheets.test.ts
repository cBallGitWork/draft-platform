import { beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL, plFixturesUrl, plFixtureUrl } from "../../../convex/football/football";
import { codesByOpta } from "../../../convex/football/feedIds";
import { SHEETS_BEFORE_KICKOFF_MS } from "../../../convex/football/matchTeamSheets";
import { matchSlots } from "../../../convex/football/plMatch";
import { PL_UPCOMING } from "../../../convex/football/premierLeague";
import { MINUTE_MS } from "../../../convex/shared/time";
import { stagedGw6, stageTime, tickAt } from "../../support/convex/liveStats.harness";
import { BOTH_ELEVENS, GAMEWEEK, HULL_EVERTON, KICKOFF, withHullEverton } from "../../support/convex/matchStats.harness";
import { refusedError, silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";
import { MATCH, recordedGw6, type Gw6Payloads } from "../../support/recorded/gw6.payloads";

// The team sheets before kickoff (#45; spec/10, The match page: "From the lineups, about an hour
// before kickoff"): in the hour before a match kicks off, each tick reads its sheets alone (the
// gameweek's list for its id, and its own read) and keeps both sides' men, one row a match. A read
// that changes them replaces them; one with nobody named, or one that fails, leaves them. The page
// showing them is tests/convex/match/matchPage.test.ts's.

beforeEach(() => vi.useFakeTimers());

const SHEETS_OPEN = KICKOFF - SHEETS_BEFORE_KICKOFF_MS;
const dueAt = (t: TestConvex, now: number) => t.query(internal.football.matchTeamSheets.due, { now });
const heldSheets = (t: TestConvex, fixtureCode = HULL_EVERTON) =>
  t.run((ctx) => ctx.db.query("matchTeamSheets").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)).unique());

/** Gameweek 6 as the feeds send it before Hull v Everton kicks off: its sheets out, the match not begun. */
function beforeKickoff(): Gw6Payloads {
  const payloads = recordedGw6();
  for (const fixture of [...payloads.pl.round.content, ...payloads.pl.fixtures]) {
    if (fixture.id === MATCH.hullEverton.pl) fixture.status = PL_UPCOMING;
  }
  return payloads;
}

/** A match's men as its sheets name them, by FPL code. */
function sheetMen(payloads: Gw6Payloads, plId: number) {
  const fixture = payloads.pl.fixtures.find((each) => each.id === plId)!;
  return matchSlots(fixture, codesByOpta(payloads.fpl.bootstrap.elements)).slots.map(({ playerCode, started }) => ({ playerCode, started }));
}

test("a match's sheets are due from an hour before its kickoff until it kicks off, and not a minute either side", async () => {
  const t = await withHullEverton();
  const hullEverton = [{ fixtureCode: HULL_EVERTON, gameweek: GAMEWEEK }];

  expect(await dueAt(t, SHEETS_OPEN - MINUTE_MS)).toEqual([]);
  expect(await dueAt(t, SHEETS_OPEN)).toEqual(hullEverton);
  expect(await dueAt(t, KICKOFF - MINUTE_MS)).toEqual(hullEverton);
  expect(await dueAt(t, KICKOFF)).toEqual([]);
});

test("a match the feed has dropped, or postponed out of its gameweek, has no sheets read", async () => {
  const t = await withHullEverton();
  const patchFixture = (fields: { droppedAt?: number; gameweek?: null }) =>
    t.run(async (ctx) => ctx.db.patch("fixtures", (await ctx.db.query("fixtures").unique())!._id, fields));

  await patchFixture({ droppedAt: KICKOFF });
  expect(await dueAt(t, SHEETS_OPEN)).toEqual([]);
  await patchFixture({ droppedAt: undefined, gameweek: null });
  expect(await dueAt(t, SHEETS_OPEN)).toEqual([]);
});

test("a tick within the hour reads only the match's sheets and keeps both sides' men, with no tick row", async () => {
  const t = await withHullEverton();
  const payloads = beforeKickoff();

  const { fetch, latest } = await tickAt(t, SHEETS_OPEN + MINUTE_MS, payloads);

  expect(fetch.mock.calls.map(([url]) => url).toSorted()).toEqual(
    [FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL, plFixturesUrl(GAMEWEEK), plFixtureUrl(MATCH.hullEverton.pl)].toSorted(),
  );
  const men = sheetMen(payloads, MATCH.hullEverton.pl);
  expect(men.filter((man) => man.started)).toHaveLength(BOTH_ELEVENS);
  expect(await heldSheets(t)).toMatchObject({ fixtureCode: HULL_EVERTON, men });
  expect(latest).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.query("playerMatchStats").collect())).toEqual([]);
});

test("a change to the sheets replaces the held men; a read naming nobody leaves them", async () => {
  const t = await withHullEverton();
  const payloads = beforeKickoff();
  await tickAt(t, SHEETS_OPEN, payloads);

  // A starter dropped to the bench in the warm-up.
  const changed = beforeKickoff();
  const hullSheet = changed.pl.fixtures.find((each) => each.id === MATCH.hullEverton.pl)!.teamLists![0]!;
  const [dropped, ...rest] = hullSheet.lineup;
  hullSheet.lineup = rest;
  hullSheet.substitutes = [...hullSheet.substitutes, dropped];
  delete hullSheet.formation;
  await tickAt(t, SHEETS_OPEN + MINUTE_MS, changed);
  const men = sheetMen(changed, MATCH.hullEverton.pl);
  expect(men.filter((man) => man.started)).toHaveLength(BOTH_ELEVENS - 1);
  expect((await heldSheets(t))!.men).toEqual(men);

  const unnamed = beforeKickoff();
  unnamed.pl.fixtures.find((each) => each.id === MATCH.hullEverton.pl)!.teamLists = [null, null];
  await tickAt(t, SHEETS_OPEN + 2 * MINUTE_MS, unnamed);
  expect((await heldSheets(t))!.men).toEqual(men);
});

test("sheets that will not read are logged and the held men stand", async () => {
  const errors = silenceConsoleError();
  const t = await withHullEverton();
  const payloads = beforeKickoff();
  await tickAt(t, SHEETS_OPEN, payloads);
  const url = plFixtureUrl(MATCH.hullEverton.pl);

  await tickAt(t, SHEETS_OPEN + MINUTE_MS, payloads, url);

  expect(errors).toHaveBeenCalledWith(`match ${HULL_EVERTON}'s team sheets failed: ${refusedError(url)}`);
  expect((await heldSheets(t))!.men).toEqual(sheetMen(payloads, MATCH.hullEverton.pl));
});

test("with a match live and another within the hour, a tick reads FPL once, the live one in full and the other's sheets", async () => {
  const t = await withHullEverton();
  const PALACE_FOREST = MATCH.palaceForest.code;
  const minute = 45;
  await t.run((ctx) =>
    ctx.db.insert("fixtures", { code: PALACE_FOREST, gameweek: GAMEWEEK, homeClubCode: 31, awayClubCode: 17, kickoff: stageTime(minute) + SHEETS_BEFORE_KICKOFF_MS / 2 }),
  );
  const payloads = stagedGw6(minute);

  const { fetch, latest } = await tickAt(t, stageTime(minute), payloads);

  const urls = fetch.mock.calls.map(([url]) => url);
  expect(urls.filter((url) => url === FPL_BOOTSTRAP_URL)).toHaveLength(1);
  expect(latest.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true }] });
  // Its sheets read; none kept, as the recorded FPL players are cut to Hull's and Everton's men.
  expect(urls).toContain(plFixtureUrl(MATCH.palaceForest.pl));
  // The live match's men are its records; its sheets are not read apart.
  expect(await heldSheets(t)).toBeNull();
});
