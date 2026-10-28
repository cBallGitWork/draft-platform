// The after-release check (spec/20, Every release): opens the live site and signs in for real, as a
// manager does: asks for a link, reads it from the check's own inbox (scripts/sign-in-inbox.mjs),
// opens it, and sees Sign out. Then signs out. The live site has no test-only way in.

import { expect, test } from "@playwright/test";
import { signInEmail } from "../../convex/signIn/signInEmail";
import { receivedSignInLink } from "../../scripts/sign-in-inbox.mjs";
import { signOutWords } from "../../src/frame/words";
import { replyWords, signInWords } from "../../src/sign-in/words";
import { checkSecrets, SKIPPED_NO_SECRETS } from "./releaseCheck";

/** The sign-in email's subject: its words don't depend on the link. */
const SIGN_IN_SUBJECT = signInEmail("").subject;

/** How long opening the link may take to sign in: the app loads, then Convex redeems the code. */
const SIGNED_IN_WAIT_MS = 30_000;

const secrets = checkSecrets();

/** Skips the check, saying why where the run's log shows it: GitHub's notice, and the console. */
function skipSaying(reason: string) {
  console.log(`::notice::${reason}`);
  test.skip(true, reason);
}

test("the live site sends a sign-in link, and the link signs in", async ({ page, baseURL }) => {
  if (!secrets) return skipSaying(SKIPPED_NO_SECRETS);
  if (!baseURL) throw new Error("the check has no site to open");

  await page.goto("/");
  await page.getByLabel(signInWords.emailLabel).fill(secrets.email);
  const askedAt = Date.now();
  await page.getByRole("button", { name: signInWords.send }).click();

  const reply = page.getByRole("status");
  await expect(reply).not.toBeEmpty();
  // The hour's limit on links for one address, reached by a run of releases: the site answered,
  // but sends no link this time. Skipped and said, not red, until Craig decides (asked in #512's
  // pull request).
  if ((await reply.textContent()) === replyWords.tryLater) return skipSaying(`skipped: the site answered "${replyWords.tryLater}"`);
  await expect(reply).toHaveText(replyWords.checkYourEmail);

  const link = await receivedSignInLink({ apiKey: secrets.resendKey, to: secrets.email, subject: SIGN_IN_SUBJECT, siteUrl: baseURL, since: askedAt });
  await page.goto(link);
  const signOut = page.getByRole("button", { name: signOutWords });
  await expect(signOut).toBeVisible({ timeout: SIGNED_IN_WAIT_MS });

  await signOut.click();
  await expect(page.getByRole("button", { name: signInWords.send })).toBeVisible();
});
