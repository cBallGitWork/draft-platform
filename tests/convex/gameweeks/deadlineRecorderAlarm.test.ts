import { getFunctionName } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { gameweekRefusals } from "../../../convex/gameweeks/leagueGameweeks";
import { HOUR_MS } from "../../../convex/shared/time";
import { syncWith } from "../../support/convex/footballSync.harness";
import { clockRunsTo, expectRefused } from "../../support/convex/test.harness";
import { recordedSeason } from "../../support/recorded/fpl.payloads";
import {
  deadlineBefore,
  GAMEWEEK,
  kickoffsOf,
  leagueId,
  OPENER,
  passedRows,
  payloads,
  recordPassed,
  setUsedIn,
  shownDeadline,
  t,
  useDeadlineRecorderDeployment,
} from "../../support/convex/deadlineRecorder.harness";

useDeadlineRecorderDeployment();

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
