// What the setup command (`npm run setup:live`, scripts/live-setup.mjs) sets up, in one home: the
// live site's sender, and the names it gives each service (spec/20, The live site). The site's
// address and the after-release check's secrets are the check's own (tests/live/releaseCheck.ts).

import {
  ADMIN_EMAIL_SETTING,
  EMAIL_FROM_SETTING,
  RESEND_KEY_SETTING,
  SITE_URL_SETTING,
} from "../../convex/outbound/deploymentSettings.ts";
import { MINUTE_MS, SECOND_MS } from "../../convex/shared/time.ts";
import { CHECK_ENV, LIVE_SITE_URL } from "../../tests/live/releaseCheck.ts";

export { LIVE_SITE_URL };
export const LIVE_DOMAIN = new URL(LIVE_SITE_URL).hostname;
/** The mailbox sign-in links come from, at the live domain. */
const SENDER_MAILBOX = "signin";
export const LIVE_SENDER = `${SENDER_MAILBOX}@${LIVE_DOMAIN}`;

/** The Vercel project the site is served from. */
export const VERCEL_PROJECT = "draft-platform";

/** The settings on the live Convex deployment: the five sign-in needs (docs/setup.md), and the
 *  sender. */
export const SETTING = {
  jwtPrivateKey: "JWT_PRIVATE_KEY",
  jwks: "JWKS",
  siteUrl: SITE_URL_SETTING,
  adminEmail: ADMIN_EMAIL_SETTING,
  resendKey: RESEND_KEY_SETTING,
  sender: EMAIL_FROM_SETTING,
};
// The release's own names (scripts/release.mjs), which the setup command puts in Vercel.
export { DEPLOY_KEY_SETTING, VERCEL_PRODUCTION } from "../release.mjs";

/** How each pasted key starts, so a key pasted into the wrong prompt is caught before it's saved. */
export const DEPLOY_KEY_PREFIX = "prod:";
export const RESEND_KEY_PREFIX = "re_";

/** Resend's sending region: Ireland, the nearest to the managers. */
export const RESEND_REGION = "eu-west-1";
/** Resend's status for a domain it has checked. */
export const RESEND_VERIFIED = "verified";
/** How long the command waits for Resend's check: DNS can take longer, and a re-run waits again. */
export const VERIFY_POLL_EVERY_MS = 10 * SECOND_MS;
export const VERIFY_POLL_FOR_MS = 5 * MINUTE_MS;

/** The repository whose merges go live, through Vercel's GitHub app (#512). */
export const GITHUB_REPO = "cBallGitWork/draft-platform";
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
/** The after-release check's two GitHub secrets (.github/workflows/release-check.yml). */
export const RELEASE_CHECK_SECRET = { email: CHECK_ENV.email, resendKey: CHECK_ENV.resendKey };
/** How a Resend receiving address ends (`<anything>@<id>.resend.app`, its Receiving tab). */
export const RESEND_RECEIVING_SUFFIX = ".resend.app";

/** The positions sync (convex/positions/positionsSync.ts), run once by hand on the live site. */
export const POSITIONS_SYNC_RUN = "positions/positionsSync:run";
export const POSITIONS_SYNC_LATEST = "positions/positionsSync:latest";
export const MANUAL_TRIGGER = { trigger: "manual" };
/** The function whose presence on the live deployment says its server code is there. */
export const DEPLOYED_FUNCTION = POSITIONS_SYNC_RUN;
/** Puts an address on the live site's allowed list (convex/signIn/allowedEmails.ts). */
export const ALLOW_EMAIL = "signIn/allowedEmails:add";
