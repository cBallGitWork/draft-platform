// The names of the settings the server reads from its deployment, in their one home. No imports, so
// `scripts/live-setup/` can read it in plain Node too, and set the same names it reads.

/** The admin's email (spec/13#who-runs-it). */
export const ADMIN_EMAIL_SETTING = "ADMIN_EMAIL";

/** The app's address, for links in emails. Convex Auth's own name (@convex-dev/auth reads it), so
 *  fixed by the library. */
export const SITE_URL_SETTING = "SITE_URL";

/** Resend's key, for sending email. Convex Auth's own name (`AUTH_<provider>_KEY`, read by
 *  @convex-dev/auth's Resend provider), so fixed by the library. */
export const RESEND_KEY_SETTING = "AUTH_RESEND_KEY";

/** The sender's address: the live site's is set by `npm run setup:live` (docs/setup.md). */
export const EMAIL_FROM_SETTING = "EMAIL_FROM";

/** The one test account's email (spec/02, One test account signs in with a secret). With it or its
 *  secret unset, the test account's way in is off. */
export const TEST_ACCOUNT_EMAIL_SETTING = "TEST_ACCOUNT_EMAIL";

/** The test account's secret. Every sign-in reads it afresh, so changing it ends the old one at once. */
export const TEST_ACCOUNT_SECRET_SETTING = "TEST_ACCOUNT_SECRET";
