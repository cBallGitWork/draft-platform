import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { gameweekRefusals } from "../../../convex/gameweeks/leagueGameweeks";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { giveDeadlineRule } from "../../support/convex/leagueRules.harness";
import { syncWith } from "../../support/convex/footballSync.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import { recordedSeason } from "../../support/recorded/fpl.payloads";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";

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

const recordPassed = () => t.mutation(internal.gameweeks.deadlineRecorder.recordPassed, {});
const passedRows = () => t.run((ctx) => ctx.db.query("passedDeadlines").collect());
const shownDeadline = async (gameweek: number) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId }))[gameweek - 1].deadline;
const setUsed = async (gameweek: number, used: boolean) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId, gameweek, used });

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
  expect(error).toHaveBeenCalledWith(expect.stringContaining("football sync failed"));
  const kickoffs = await t.run(async (ctx) => (await ctx.db.query("fixtures").collect()).map((fixture) => fixture.kickoff));
  expect(kickoffs).toContain(OPENER);
  expect(await passedRows()).toEqual([]);
  expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
});

describe("a postponed first match", () => {
  test("after the deadline, the football sync keeps the recorded deadline and the gameweek stays begun", async () => {
    vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
    await syncWith(t, openerPostponed());

    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
    await expect(setUsed(GAMEWEEK, false)).rejects.toThrow(gameweekRefusals.begun(GAMEWEEK));
    const change = await (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: { ...FIRST_RULES, format: "totalPoints" } });
    expect(change).toBe(GAMEWEEK + 1);
  });

  test("before the deadline, moves it to the next match's, and the gameweek can still be changed", async () => {
    vi.setSystemTime(deadlineBefore(OPENER) - HOUR_MS);
    await syncWith(t, openerPostponed());

    expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(SECOND));
    vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
    await setUsed(GAMEWEEK, false);
  });
});
