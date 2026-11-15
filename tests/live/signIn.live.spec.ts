// The after-release check (spec/20, Every release): opens the live site and signs in for real, as a
// manager does: asks for a link, reads it from the check's own inbox (scripts/sign-in-inbox.mjs),
// opens it, and sees Sign out. Then signs out. The live site has no test-only way in.

import { expect, test } from "@playwright/test";
import { SIGN_IN_SUBJECT_START } from "../../convex/signIn/signInEmail";
import { receivedSignInLink } from "../../scripts/sign-in-inbox.mjs";
import { signOutWords } from "../../src/frame/words";
import { signInWords } from "../../src/signIn/words";
import { checkSecrets, expectLinkSent, SKIPPED_NO_SECRETS } from "./releaseCheck";

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

  await expectLinkSent(page.getByRole("status"));

  const link = await receivedSignInLink({ apiKey: secrets.resendKey, to: secrets.email, subject: SIGN_IN_SUBJECT_START, siteUrl: baseURL, since: askedAt });
  await page.goto(link);
  const signOut = page.getByRole("button", { name: signOutWords });
  await expect(signOut).toBeVisible({ timeout: SIGNED_IN_WAIT_MS });

  await signOut.click();
  await expect(page.getByRole("button", { name: signInWords.send })).toBeVisible();
});
