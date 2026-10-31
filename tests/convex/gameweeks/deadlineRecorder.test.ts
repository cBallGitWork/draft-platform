import { describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { gameweekRefusals } from "../../../convex/gameweeks/leagueGameweeks";
import { LEAGUES_RECORDED_MOST } from "../../../convex/gameweeks/deadlineRecorder";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { adminCreatesLeague, COMMISSIONER } from "../../support/convex/leagues.harness";
import { changeRules, giveDeadlineRule } from "../../support/convex/leagueRules.harness";
import { syncWith } from "../../support/convex/footballSync.harness";
import { fakeResend } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";
import {
  deadlineBefore,
  GAMEWEEK,
  heldOpener,
  kickoffsOf,
  leagueId,
  markOpenerDropped,
  OPENER,
  openerPostponed,
  passedRows,
  recordPassed,
  setUsedIn,
  shownDeadline,
  t,
  useDeadlineRecorderDeployment,
} from "../../support/convex/deadlineRecorder.harness";

// A league's deadline, once passed, stays where it fell, even if the gameweek's first match is then
// postponed (spec/05; #150). The football sync records it before it writes kickoffs, and every read
// of when a gameweek begins takes the record first. Against FPL's recorded whole season.

/** A deadline earlier than the first rules', in minutes before the first kickoff. */
const THREE_HOURS = 180;
/** Gameweek 8's second kickoff, its first once the opener is postponed. */
const [, SECOND] = kickoffsOf(GAMEWEEK);

useDeadlineRecorderDeployment();

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
    vi.setSystemTime(deadlineBefore(OPENER) + MINUTE_MS);

    await markOpenerDropped();

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
