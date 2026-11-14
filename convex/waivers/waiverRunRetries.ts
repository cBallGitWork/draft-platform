import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { sendEmail } from "../outbound/email";
import { takeTodaysEmail } from "../outbound/emailLimit";
import { leagueLabel, logFailure } from "../shared/errors";
import { momentIn } from "../shared/moments";
import { PRODUCT_NAME } from "../shared/product";
import { adminEmail } from "../signIn/allowedEmails";
import { latestEnded } from "./waiverLock";
import { waiverOrderRow } from "./waiverOrder";
import { WAIVER_CHECK_EVERY } from "./waiverRun";

// A waiver run that fails (#2193, spec/08 Waivers and free agency, S08.23): "A run does every claim
// or none: Wednesday's 18:00 run crashing after 3 of 6 claims leaves all 6 undone, and it is tried
// again at once. A second run for the same time does nothing. Still failing after its retries, the
// admin is emailed and managers see 'Waivers delayed'" (Craig, 14 Nov 2026). The cron starts each
// run here (waiverRun.ts `runLeagueDue`); `run` there is one transaction, so a try that throws
// part-way leaves every claim undone.

/** How many times a run is tried at once, the first included, before the admin is emailed and
 *  managers see "Waivers delayed": Claude's choice. */
export const RUN_TRIES = 3;

/** Makes the league's run for `at`, tried again at once while it throws. With `backFrom`, the
 *  deadline the window shut at, each try also puts the free agents back on waivers (#1478), once a
 *  deadline, in time order: before a run after the deadline, so it hands them out, and after a
 *  catch-up run from before it, which frees those nobody claimed then. Still failing after RUN_TRIES, `runFailed` tells the admin;
 *  the cron tries it again at its next look, the run time being still unrun. */
export const runWithRetries = internalAction({
  args: { leagueId: v.id("leagues"), at: v.number(), backFrom: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, at, backFrom }) => {
    let error = "";
    for (let tries = 1; tries <= RUN_TRIES; tries++) {
      try {
        const putBack = (deadline: number) => ctx.runMutation(internal.waivers.backOnWaivers.putBackOnWaivers, { leagueId, deadline });
        if (backFrom !== null && backFrom <= at) await putBack(backFrom);
        await ctx.runMutation(internal.waivers.waiverRun.run, { leagueId, at });
        if (backFrom !== null && backFrom > at) await putBack(backFrom);
        return null;
      } catch (failed: unknown) {
        error = logFailure(`League ${leagueId}'s waiver run for ${new Date(at).toISOString()} failed, try ${tries} of ${RUN_TRIES}`, failed);
      }
    }
    await ctx.runMutation(internal.waivers.waiverRunRetries.runFailed, { leagueId, at, error });
    return null;
  },
});

/** Wording for Craig to change in the pull request: the admin's email for a run still failing. */
export function runFailedEmail(leagueName: string, at: number, error: string, zone: string | undefined) {
  return {
    subject: `${PRODUCT_NAME}: waivers delayed in ${leagueName}`,
    text: [
      `${leagueName}'s waiver run for ${momentIn(at, zone)} failed ${RUN_TRIES} times in a row, so none of its claims were made:`,
      "",
      error,
      "",
      `Its managers see "Waivers delayed". It is tried again every ${WAIVER_CHECK_EVERY.minutes} minutes until it runs.`,
    ].join("\n"),
  };
}

/** Marks the league's run for `at` delayed once its tries are spent, and emails the admin once for
 *  it; nothing once a run for that time or later has been made or skipped. */
export const runFailed = internalMutation({
  args: { leagueId: v.id("leagues"), at: v.number(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, at, error }) => {
    const league = await ctx.db.get("leagues", leagueId);
    const held = await waiverOrderRow(ctx, leagueId);
    if (league === null || (held !== null && (at <= held.ranAt || held.delayedRun === at))) return null;
    if (held !== null) await ctx.db.patch("waiverOrders", held._id, { delayedRun: at });
    else {
      // A league never run gets its row here, its run still due: `at` is after `ranAt`.
      const gameweek = await latestEnded(ctx, await leagueDeadlines(ctx, leagueId), Date.now());
      await ctx.db.insert("waiverOrders", { leagueId, winners: [], gameweek, ranAt: at - 1, delayedRun: at });
    }
    if (!(await takeTodaysEmail(ctx))) {
      console.error(`${leagueLabel(league)}'s waiver run is delayed, but the day's emails are all gone, so the admin wasn't emailed: ${error}`);
      return null;
    }
    await ctx.scheduler.runAfter(0, internal.waivers.waiverRunRetries.emailRunFailed, { leagueName: league.name, at, error });
    return null;
  },
});

/** Sends the admin `runFailedEmail`, logging one the service refuses. */
export const emailRunFailed = internalAction({
  args: { leagueName: v.string(), at: v.number(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueName, at, error }) => {
    try {
      const admin = adminEmail();
      const zone = (await ctx.runQuery(internal.signIn.timeZone.zoneFor, { email: admin })) ?? undefined;
      await sendEmail(admin, runFailedEmail(leagueName, at, error, zone));
    } catch (sendError) {
      console.error(`The email saying ${leagueName}'s waivers are delayed wasn't sent to the admin:`, sendError);
    }
    return null;
  },
});
