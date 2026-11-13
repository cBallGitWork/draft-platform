// What the after-release check (spec/20, Every release) points at and needs lives with the setup
// command, in scripts/live-site.mjs; this file adds only the check's own words. signIn.live.spec.ts
// reads it, and .github/workflows/release-check.yml passes CHECK_ENV's settings in by name.

import { CHECK_ENV } from "../../scripts/live-site.mjs";

export { CHECK_ENV, checkSecrets } from "../../scripts/live-site.mjs";

/** Why the check didn't run, said as it skips. */
export const SKIPPED_NO_SECRETS = `skipped: ${CHECK_ENV.email} or ${CHECK_ENV.resendKey} isn't set, so there's no live site to sign in to yet`;
