// What the after-release check (spec/20, Every release) points at and what it needs, in one place:
// playwright.live.config.ts and signIn.live.spec.ts read it, and .github/workflows/release-check.yml
// passes the same three settings in by these names.

/** The live site. */
export const LIVE_SITE_URL = "https://fantasydraftmanager.net";

/** The settings the check reads: two secrets, and an optional other site to point it at, which is
 *  how it is shown to fail on a site that won't sign in. */
export const CHECK_ENV = {
  /** An address Resend receives for the account (its own `<id>.resend.app`), on the live site's
   *  allowed list. A secret: anyone who knew it could spend the day's emails asking for links. */
  email: "RELEASE_CHECK_EMAIL",
  /** A Resend API key that can read received emails: only a full-access key can. */
  resendKey: "RELEASE_CHECK_RESEND_KEY",
  site: "RELEASE_CHECK_SITE",
} as const;

/** The site the check opens: the live one unless another is named. */
export const checkSite = () => process.env[CHECK_ENV.site] || LIVE_SITE_URL;

/** The two secrets, or null while either is missing: the live site isn't set up yet. */
export function checkSecrets(): { email: string; resendKey: string } | null {
  const email = process.env[CHECK_ENV.email];
  const resendKey = process.env[CHECK_ENV.resendKey];
  return email && resendKey ? { email, resendKey } : null;
}

/** Why the check didn't run, said as it skips. */
export const SKIPPED_NO_SECRETS = `skipped: ${CHECK_ENV.email} or ${CHECK_ENV.resendKey} isn't set, so there's no live site to sign in to yet`;
