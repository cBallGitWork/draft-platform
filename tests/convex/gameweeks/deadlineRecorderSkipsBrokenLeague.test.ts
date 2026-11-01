import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { LEAGUE_SKIPPED } from "../../../convex/gameweeks/deadlineRecorder";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { HOUR_MS } from "../../../convex/shared/time";
import { adminCreatesLeague } from "../../support/convex/leagues.harness";
import { syncWith } from "../../support/convex/footballSync.harness";
import { sentToday } from "../../support/convex/signIn.harness";
import { pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";
import {
  deadlineBefore,
  GAMEWEEK,
  leagueId,
  OPENER,
  openerPostponed,
  passedRows,
  shownDeadline,
  t,
  useDeadlineRecorderDeployment,
} from "../../support/convex/deadlineRecorder.harness";

// One league whose rules are broken never stops the football feed for the other leagues: it is
// skipped, named in the log and emailed to the admin, and the others carry on (spec/15, #896).

useDeadlineRecorderDeployment();

test("a league whose deadlines can't be worked out is skipped, logged and emailed once, and the healthy league's deadline is recorded as the kickoffs move", async () => {
  const error = silenceConsoleError();
  const broken = await adminCreatesLeague(t, 4, "Broken");
  // Only a row written by hand can be unsound: a commissioner's change is checked.
  await t.run(async (ctx) => {
    await ctx.db.insert("leagueRules", { leagueId: broken, fromGameweek: 1, rules: { ...FIRST_RULES, deadline: { minutesBeforeFirstKickoff: -1 } } });
  });
  vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);

  // Every fixtures batch and markDropped page of the sync records, so each skips the broken league.
  const outcome = await syncWith(t, openerPostponed());

  expect(outcome).toMatchObject({ ok: true });
  const kickoffs = await t.run(async (ctx) => (await ctx.db.query("fixtures").collect()).map((fixture) => fixture.kickoff));
  expect(kickoffs).not.toContain(OPENER);
  const passed = (await passedRows()).filter((row) => row.gameweek === GAMEWEEK);
  expect(passed.map((row) => row.leagueId)).toEqual([leagueId]);
  expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
  expect(error).toHaveBeenCalledWith(expect.stringContaining(`League ${broken} (Broken) ${LEAGUE_SKIPPED}`));

  const emails = await pendingJobs(t, internal.admin.feedFailureEmails.send);
  expect(emails).toHaveLength(1);
  expect(emails[0].args[0]).toMatchObject({ feed: "skippedLeague", error: expect.stringContaining(`League ${broken} (Broken) ${LEAGUE_SKIPPED}`) });
  expect(await sentToday(t)).toBe(1);

  // The skip has its own once-a-day slot, so a real football failure later that day still emails (#980).
  await t.mutation(internal.football.footballSync.record, { trigger: "cron", ranAt: Date.now(), outcome: { ok: false, error: FEED_ERROR } });
  const both = await pendingJobs(t, internal.admin.feedFailureEmails.send);
  expect(both.map((job) => job.args[0])).toEqual([
    expect.objectContaining({ feed: "skippedLeague" }),
    expect.objectContaining({ feed: "football", error: FEED_ERROR }),
  ]);
  expect(await sentToday(t)).toBe(2);
});

const FEED_ERROR = "https://fantasy.premierleague.com/api/bootstrap-static/ answered 503";
