// Who the app's emails come from, in their one home. No imports, so `scripts/live-setup/` can read
// it in plain Node too.

/** The deployment setting naming the sender's address: the live site's is set by
 *  `npm run setup:live` (docs/setup.md). */
export const EMAIL_FROM_SETTING = "EMAIL_FROM";

/** Resend's own test sender, used where `EMAIL_FROM_SETTING` isn't set: it reaches only the Resend
 *  account's own address (spec/20, The live site). */
export const TEST_SENDER = "onboarding@resend.dev";
