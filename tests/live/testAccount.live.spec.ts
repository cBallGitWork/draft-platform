// Signs the test account (convex/signIn/testAccount.ts, spec/02) in to the live site with its
// secret, and saves the session for later runs to reuse:
//   npm run test-account
// which runs Playwright with .env.local loaded. It reads TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_SECRET (the same values the live
// deployment holds) and TEST_ACCOUNT_CONVEX_URL, the live deployment's address. While any is
// missing it skips, as it does in CI, which holds none. The session goes to TEST_ACCOUNT_STATE
// (gitignored); a later test reuses it with `test.use({ storageState: TEST_ACCOUNT_STATE })`.

import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../../convex/outbound/deploymentSettings";
import { TEST_ACCOUNT_PROVIDER } from "../../convex/signIn/testAccount";
import { signOutWords } from "../../src/frame/words";

/** Where the saved session goes: .gitignore keeps it out of the repository. */
export const TEST_ACCOUNT_STATE = ".auth/test-account.json";
/** The live deployment's address, as the site's VITE_CONVEX_URL is. */
const CONVEX_URL_SETTING = "TEST_ACCOUNT_CONVEX_URL";
/** Convex Auth's browser keys (@convex-dev/auth/react), each ending with the deployment's address
 *  stripped to letters and digits. */
const TOKEN_KEYS = { token: "__convexAuthJWT", refreshToken: "__convexAuthRefreshToken" } as const;
const SIGNED_IN_WAIT_MS = 30_000;

test("the test account signs in with its secret, and its session is saved", async ({ page }) => {
  const email = process.env[TEST_ACCOUNT_EMAIL_SETTING];
  const secret = process.env[TEST_ACCOUNT_SECRET_SETTING];
  const convexUrl = process.env[CONVEX_URL_SETTING];
  test.skip(!email || !secret || !convexUrl, `${TEST_ACCOUNT_EMAIL_SETTING}, ${TEST_ACCOUNT_SECRET_SETTING} or ${CONVEX_URL_SETTING} isn't set`);

  const { tokens } = await new ConvexHttpClient(convexUrl!).action(api.auth.signIn, {
    provider: TEST_ACCOUNT_PROVIDER,
    params: { email: email!, secret: secret! },
  });
  // Never says why, or prints what it sent: the secret stays out of the log.
  if (!tokens) throw new Error("the live site refused the test account's secret");

  const namespace = convexUrl!.replace(/[^a-zA-Z0-9]/g, "");
  await page.goto("/");
  await page.evaluate(
    ({ keys, values, namespace }) => {
      localStorage.setItem(`${keys.token}_${namespace}`, values.token);
      localStorage.setItem(`${keys.refreshToken}_${namespace}`, values.refreshToken);
    },
    { keys: TOKEN_KEYS, values: tokens, namespace },
  );
  await page.reload();
  await expect(page.getByRole("button", { name: signOutWords })).toBeVisible({ timeout: SIGNED_IN_WAIT_MS });
  await page.context().storageState({ path: TEST_ACCOUNT_STATE });
});
