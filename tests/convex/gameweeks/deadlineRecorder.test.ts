import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { gameweekRefusals } from "../../../convex/gameweeks/leagueGameweeks";
import { LEAGUES_RECORDED_MOST, recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { changeRules, giveDeadlineRule, setUsed } from "../../support/convex/leagueRules.harness";
import { held, syncWith } from "../../support/convex/footballSync.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { clockRunsTo, expectRefused, silenceConsoleError } from "../../support/convex/test.harness";
import { recordedSeason } from "../../support/recorded/fpl.payloads";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { recordGameweekStarts } from "../../../convex/gameweeks/gameweekStarts";

// The start recording as it is, but a test can make it throw.
vi.mock("../../../convex/gameweeks/gameweekStarts", async (actual) => {
  const starts = await actual<typeof import("../../../convex/gameweeks/gameweekStarts")>();
  return { ...starts, recordGameweekStarts: vi.fn(starts.recordGameweekStarts) };
});

// A league's deadline, once passed, stays where it fell, even if the gameweek's first match is then
// postponed (spec/05; #150). The football sync records it before it writes kickoffs, and every read
// of when a gameweek begins takes the record first. Against FPL's recorded whole season.

/** Gameweek 8 in FPL's recorded season, its matches all after the harness's clock starts. */
const GAMEWEEK = 8;
const payloads = recordedSeason();
const kickoffsOf = (gameweek: number) =>
  payloads.fixtures.flatMap((fixture) => (fixture.event === gameweek && fixture.kickoff_time !== null ? [Date.parse(fixture.kickoff_time)] : [])).toSorted((a, b) => a - b);
const [OPENER, SECOND] = kickoffsOf(GAMEWEEK);
/** A deadline earlier than the first rules', in minutes before the first kickoff. */
const THREE_HOURS = 180;
/** The first rules' deadline, before a kickoff. */
const deadlineBefore = (kickoff: number) => kickoff - FIRST_RULES.deadline.minutesBeforeFirstKickoff * MINUTE_MS;
/** What a failed sync logs (footballSync.ts). */
const SYNC_FAILED_LOG = "football sync failed";

/** FPL's season with gameweek 8's opener postponed, as FPL sends one: no gameweek, no kickoff. */
function openerPostponed() {
  const moved = recordedSeason();
  const opener = moved.fixtures.find((fixture) => fixture.event === GAMEWEEK && fixture.kickoff_time !== null && Date.parse(fixture.kickoff_time) === OPENER)!;
  opener.event = null;
  opener.kickoff_time = null;
  return moved;
}

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await syncWith(t, payloads);
});

const recordPassed = () => t.run((ctx) => recordPassedDeadlines(ctx));
const passedRows = () => t.run((ctx) => ctx.db.query("passedDeadlines").collect());
const shownDeadline = async (gameweek: number) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId }))[gameweek - 1].deadline;
const setUsedIn = (gameweek: number, used: boolean) => setUsed(t, leagueId, gameweek, used);
/** Gameweek 8's opener as held, less its system fields. */
const heldOpener = () =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query("fixtures").collect()).find((fixture) => fixture.kickoff === OPENER)!;
    const { _id, _creationTime, droppedAt, ...fields } = row;
    return fields;
  });

describe("recording", () => {
  test("records each league's deadline once it has passed, under its own rule, and not before", async () => {
    fakeResend();
    const other = await adminCreatesLeague(t, 4, "Other");
    await giveDeadlineRule(t, other, THREE_HOURS);
    vi.setSystemTime(deadlineBefore(OPENER) - 1);
    await recordPassed();
    const before = await passedRows();

    vi.setSystemTime(deadlineBefore(OPENER));
    await recordPassed();

    const gameweek8 = (await passedRows()).filter((row) => row.gameweek === GAMEWEEK);
    expect(before.some((row) => row.leagueId === leagueId && row.gameweek === GAMEWEEK)).toBe(false);
    expect(before.some((row) => row.leagueId === other && row.gameweek === GAMEWEEK)).toBe(true);
    expect(gameweek8.map(({ leagueId, deadline }) => ({ leagueId, deadline })).toSorted((a, b) => a.deadline - b.deadline)).toEqual([
      { leagueId: other, deadline: OPENER - THREE_HOURS * MINUTE_MS },
      { leagueId, deadline: deadlineBefore(OPENER) },
    ]);
  });

  test("recording twice is harmless: the second records nothing and changes nothing", async () => {
    vi.setSystemTime(deadlineBefore(OPENER));
    expect(await recordPassed()).toBeGreaterThan(0);
    const first = await passedRows();

    vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
    expect(await recordPassed()).toBe(0);
    expect(await passedRows()).toEqual(first);
  });
});

test("it fails closed: a league whose deadlines can't be worked out fails the sync, logged and filed, and no kickoff moves", async () => {
  const error = silenceConsoleError();
  fakeResend();
  const broken = await adminCreatesLeague(t, 4, "Broken");
  // Only a row written by hand can be unsound: a commissioner's change is checked.
  await t.run(async (ctx) => {
    await ctx.db.insert("leagueRules", { leagueId: broken, fromGameweek: 1, rules: { ...FIRST_RULES, deadline: { minutesBeforeFirstKickoff: -1 } } });
  });
  vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);

  const outcome = await syncWith(t, openerPostponed());

  expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining(`League ${broken} (Broken)`) });
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SYNC_FAILED_LOG));
  const kickoffs = await t.run(async (ctx) => (await ctx.db.query("fixtures").collect()).map((fixture) => fixture.kickoff));
  expect(kickoffs).toContain(OPENER);
  expect((await passedRows()).filter((row) => row.gameweek === GAMEWEEK)).toEqual([]);
  expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
});

test("it fails closed: a throw while recording a gameweek's start fails the fixtures batch and the sync, and no fixture row changes", async () => {
  const error = silenceConsoleError();
  const STARTS_FAILED = "the gameweek starts can't be read";
  // Once for each fixtures write below: an implementation set on the vi.fn would outlast this test.
  const startsThrowOnce = () => vi.mocked(recordGameweekStarts).mockRejectedValueOnce(new Error(STARTS_FAILED));
  vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
  const { fixtures } = await held(t);
  const opener = await heldOpener();

  startsThrowOnce();
  await expect(t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...opener, gameweek: null, kickoff: null }] })).rejects.toThrow(STARTS_FAILED);
  startsThrowOnce();
  const outcome = await syncWith(t, openerPostponed());

  expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining(STARTS_FAILED) });
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SYNC_FAILED_LOG));
  expect((await held(t)).fixtures).toEqual(fixtures);
});

// The deadline can pass after the sync starts and before it writes the fixtures: each fixtures
// mutation records first, in the same transaction as the kickoffs it moves.
describe("a deadline passing mid-sync", () => {
  test("upsertFixtures records it before postponing the opener, and the gameweek stays begun", async () => {
    const opener = await heldOpener();
    vi.setSystemTime(deadlineBefore(OPENER) + MINUTE_MS);

    await t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...opener, gameweek: null, kickoff: null }] });

    expect((await passedRows()).find((row) => row.leagueId === leagueId && row.gameweek === GAMEWEEK)?.deadline).toBe(deadlineBefore(OPENER));
    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
    await expectRefused(setUsedIn(GAMEWEEK, false), gameweekRefusals.begun(GAMEWEEK));
  });

  test("markDropped records it before dropping the opener, and the gameweek stays begun", async () => {
    const opener = await heldOpener();
    const othersSent = payloads.fixtures.map((fixture) => fixture.code).filter((code) => code !== opener.code);
    vi.setSystemTime(deadlineBefore(OPENER) + MINUTE_MS);

    await t.mutation(internal.football.footballSync.markDropped, {
      table: "fixtures",
      sentKeys: othersSent,
      droppedAt: Date.now(),
      paginationOpts: { cursor: null, numItems: payloads.fixtures.length },
    });

    expect((await passedRows()).find((row) => row.leagueId === leagueId && row.gameweek === GAMEWEEK)?.deadline).toBe(deadlineBefore(OPENER));
    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
    await expectRefused(setUsedIn(GAMEWEEK, false), gameweekRefusals.begun(GAMEWEEK));
  });
});

describe("a postponed first match", () => {
  test("after the deadline, the football sync keeps the recorded deadline and the gameweek stays begun", async () => {
    vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
    await syncWith(t, openerPostponed());

    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
    await expectRefused(setUsedIn(GAMEWEEK, false), gameweekRefusals.begun(GAMEWEEK));
    const change = await changeRules(t, leagueId, { ...FIRST_RULES, format: "totalPoints" });
    expect(change).toBe(GAMEWEEK + 1);
  });

  test("before the deadline, moves it to the next match's, and the gameweek can still be changed", async () => {
    vi.setSystemTime(deadlineBefore(OPENER) - HOUR_MS);
    await syncWith(t, openerPostponed());

    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(SECOND));
    vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
    await setUsedIn(GAMEWEEK, false);
  });
});

describe(`more than ${LEAGUES_RECORDED_MOST} leagues`, () => {
  /** `count` more leagues, written straight in, with no rules. */
  const holdLeagues = (count: number) =>
    t.run(async (ctx) => {
      for (let index = 0; index < count; index += 1) await ctx.db.insert("leagues", { name: `League ${index}`, maxTeams: 4, commissionerEmail: COMMISSIONER });
    });

  test(`with ${LEAGUES_RECORDED_MOST} held the recording runs; one more fails it loudly rather than skip a league`, async () => {
    await holdLeagues(LEAGUES_RECORDED_MOST - 1);
    vi.setSystemTime(deadlineBefore(OPENER));
    await recordPassed();
    expect((await passedRows()).some((row) => row.leagueId === leagueId && row.gameweek === GAMEWEEK)).toBe(true);

    await holdLeagues(1);
    await expect(recordPassed()).rejects.toThrow(`More than ${LEAGUES_RECORDED_MOST} leagues are held`);
  });
});

// Between two football syncs, six hours apart, a deadline passes: each recording sets an alarm for
// the soonest deadline to come, so the gameweek is recorded as begun when it passes, not at the
// next sync.
describe("the alarm at the next deadline", () => {
  const ALARM = getFunctionName(internal.gameweeks.deadlineRecorder.recordDueDeadlines);
  /** The alarms pending, each at its time. */
  const pendingAlarms = () =>
    t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect())
        .filter((job) => job.state.kind === "pending" && job.name === ALARM)
        .map((job) => job.scheduledTime),
    );
  /** The first rules' soonest deadline still to come, from each gameweek's first kickoff. */
  const soonestToCome = () =>
    Math.min(
      ...[...new Set(payloads.fixtures.flatMap((fixture) => (fixture.event === null ? [] : [fixture.event])))]
        .map((gameweek) => deadlineBefore(kickoffsOf(gameweek)[0]))
        .filter((deadline) => deadline > Date.now()),
    );

  test("a deadline passing with no sync since is recorded as it passes", async () => {
    await clockRunsTo(t, deadlineBefore(OPENER));

    expect((await passedRows()).find((row) => row.leagueId === leagueId && row.gameweek === GAMEWEEK)?.deadline).toBe(deadlineBefore(OPENER));
    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
    await expectRefused(setUsedIn(GAMEWEEK, false), gameweekRefusals.begun(GAMEWEEK));
  });

  test("two syncs leave one alarm pending, at the soonest deadline to come", async () => {
    await syncWith(t, payloads);

    expect(await pendingAlarms()).toEqual([soonestToCome()]);
  });

  test("a kickoff moved an hour earlier cancels the alarm set for the old deadline: one is left pending, at the new one", async () => {
    const stale = soonestToCome();
    expect(await pendingAlarms()).toEqual([stale]);
    const moved = recordedSeason();
    const opener = moved.fixtures.find((fixture) => fixture.kickoff_time !== null && deadlineBefore(Date.parse(fixture.kickoff_time)) === stale)!;
    opener.kickoff_time = new Date(Date.parse(opener.kickoff_time!) - HOUR_MS).toISOString();
    expect(stale - HOUR_MS).toBeGreaterThan(Date.now());

    await syncWith(t, moved);

    expect(await pendingAlarms()).toEqual([stale - HOUR_MS]);
  });

  test("once no deadline is to come, no alarm is left pending", async () => {
    const lastKickoff = Math.max(...payloads.fixtures.flatMap((fixture) => (fixture.kickoff_time === null ? [] : [Date.parse(fixture.kickoff_time)])));
    vi.setSystemTime(lastKickoff);
    await recordPassed();

    expect(await pendingAlarms()).toEqual([]);
  });
});
