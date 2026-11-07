import { internalAction } from "../_generated/server";
import { LEAD_WAKE_TOKEN_SETTING } from "../outbound/deploymentSettings";

// The lead's wake-up (Craig, 7 Nov 2026: a Convex cron, over cron-job.org). The lead (`lead.yml`)
// keeps the builders busy, but GitHub's own schedule is not to be relied on: on 5 and 7 Nov 2026 it
// fired nothing for hours and the builders sat idle. So every half hour this asks GitHub to run the
// lead on main, as "Run workflow" does by hand. A pass more than needed costs nothing: the lead runs
// one pass at a time and fills only free slots.

/** The workflow-dispatch address of the lead in this repository. */
export const LEAD_DISPATCH_URL = "https://api.github.com/repos/cBallGitWork/draft-platform/actions/workflows/lead.yml/dispatches";
/** The branch the lead runs from. */
export const LEAD_REF = "main";
/** Off the lead's own minutes (7 and 37), so a wake-up lands between GitHub's when those fire. */
export const LEAD_WAKE_CRON = "19,49 * * * *";
/** How long GitHub may take to answer before the wake-up gives up; the next one is 30 minutes on. */
const DISPATCH_TIMEOUT_MS = 10_000;

/** Asks GitHub to run the lead; nothing with no token set. Throws when GitHub refuses, so the
 *  cron's failure shows in the deployment's logs. */
export const wake = internalAction({
  args: {},
  handler: async (): Promise<void> => {
    const token = process.env[LEAD_WAKE_TOKEN_SETTING];
    if (!token) return;
    const response = await fetch(LEAD_DISPATCH_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "draft-platform-lead-wake",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: LEAD_REF }),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GitHub refused to run the lead (${response.status}): ${await response.text()}`);
  },
});
