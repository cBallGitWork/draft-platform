// What the after-release check (spec/20, Every release) points at and needs lives with the setup
// command, in scripts/live-site.mjs; this file adds only the check's own words and its judgement
// of the site's reply. signIn.live.spec.ts reads it, tests/smoke/releaseCheck.spec.ts shows that
// judgement going red on the link limit, and .github/workflows/release-check.yml passes
// CHECK_ENV's settings in by name.

import { expect, type Locator } from "@playwright/test";
import { CHECK_ENV } from "../../scripts/live-site.mjs";
import { replyWords } from "../../src/signIn/words";

export { CHECK_ENV, checkSecrets } from "../../scripts/live-site.mjs";

/** Why the check didn't run, said as it skips. */
export const SKIPPED_NO_SECRETS = `skipped: ${CHECK_ENV.email} or ${CHECK_ENV.resendKey} isn't set, so there's no live site to sign in to yet`;

/** What the check says when the site sent no link. */
export const NO_LINK_SENT = `the site sent no link ("${replyWords.tryLater}" is the hour's sign-in link limit)`;

/** The site's reply to the check's ask must be the one everyone gets once a link is on its way. The
 *  hour's limit on links for one address, reached by a run of releases, stops the check too, and
 *  that goes red like any other failure (Craig, 1 Nov 2026: "sure"; #908; S20.18). */
export async function expectLinkSent(reply: Locator) {
  await expect(reply).not.toBeEmpty();
  await expect(reply, NO_LINK_SENT).toHaveText(replyWords.checkYourEmail);
}
