// Who the app's emails come from, in their one home. No imports, so `scripts/live-setup/` can read
// it in plain Node too.

/** Resend's own test sender, used where `EMAIL_FROM_SETTING` (deploymentSettings.ts) isn't set: it
 *  reaches only the Resend account's own address (spec/20, The live site). */
export const TEST_SENDER = "onboarding@resend.dev";
