import { internalAction } from "../_generated/server";
import { LEAD_WAKE_TOKEN_SETTING } from "../outbound/deploymentSettings";
import { OUTBOUND_TIMEOUT_MS } from "../outbound/timeouts";

// The lead's wake-up (Craig, 7 Nov 2026: a Convex cron, over cron-job.org; 8 Nov 2026: on the development
// deployment, never the live one, so the live site holds no GitHub token). The lead (`lead.yml`)
// keeps the builders busy, but GitHub's own schedule is not to be relied on: on 5 and 7 Nov 2026 it
// fired nothing for hours and the builders sat idle. So every half hour this asks GitHub to run the
// lead on main, as "Run workflow" does by hand. A pass more than needed costs nothing: the lead runs
// one pass at a time and fills only free slots.

/** This repository on GitHub, as owner/name. */
const REPOSITORY = "cBallGitWork/draft-platform";
/** The workflow-dispatch address of the lead in this repository. */
export const LEAD_DISPATCH_URL = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/lead.yml/dispatches`;
/** The branch the lead runs from. */
export const LEAD_REF = "main";
/** Off the lead's own minutes (7 and 37), so a wake-up lands between GitHub's when those fire. */
export const LEAD_WAKE_CRON = "19,49 * * * *";
/** What GitHub's REST API asks every request to say: the reply shape it wants, the API's
 *  version, which fixes its request and reply shapes, and who is calling. */
const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";
const USER_AGENT = "draft-platform-lead-wake";

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
        accept: GITHUB_ACCEPT,
        "x-github-api-version": GITHUB_API_VERSION,
        "user-agent": USER_AGENT,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: LEAD_REF }),
      // The next wake-up is 30 minutes on, so one GitHub doesn't answer is simply given up.
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GitHub refused to run the lead (${response.status}): ${await response.text()}`);
  },
});
