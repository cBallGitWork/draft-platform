// Signs the one test account in to a site with its secret (spec/02, One test account signs in with
// a secret; convex/signIn/testAccount.ts) and saves the browser's session for Playwright to reuse:
//   npm run test-account
// It reads from .env.local: TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_SECRET (the pair the deployment
// holds), TEST_ACCOUNT_CONVEX_URL (the deployment's https://<name>.convex.cloud), and optionally
// TEST_ACCOUNT_SITE (the live site unless set). The session goes to .shots/test-account.json
// (git-ignored); a test reuses it with `test.use({ storageState: ".shots/test-account.json" })`.

import { chromium } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../../convex/outbound/deploymentSettings";
import { TEST_ACCOUNT_PROVIDER } from "../../convex/signIn/testAccount";
import { signOutWords } from "../../src/frame/words";
import { LIVE_SITE_URL } from "./releaseCheck";

/** Where the saved session goes. */
const TEST_ACCOUNT_STATE = ".shots/test-account.json";
const CONVEX_URL_SETTING = "TEST_ACCOUNT_CONVEX_URL";
const SITE_SETTING = "TEST_ACCOUNT_SITE";
/** How long the site may take to show the account signed in. */
const SIGNED_IN_WAIT_MS = 30_000;

/** Convex Auth's browser storage keys (@convex-dev/auth/react: the key, `_`, and the Convex URL
 *  with everything but letters and digits removed). */
const authStorageKeys = (convexUrl: string) => {
  const namespace = convexUrl.replace(/[^a-zA-Z0-9]/g, "");
  return { jwt: `__convexAuthJWT_${namespace}`, refreshToken: `__convexAuthRefreshToken_${namespace}` };
};

function setting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} isn't set in .env.local`);
  return value;
}

async function main() {
  const convexUrl = setting(CONVEX_URL_SETTING);
  const site = process.env[SITE_SETTING] || LIVE_SITE_URL;
  const params = { email: setting(TEST_ACCOUNT_EMAIL_SETTING), secret: setting(TEST_ACCOUNT_SECRET_SETTING) };
  const { tokens } = await new ConvexHttpClient(convexUrl).action(api.auth.signIn, { provider: TEST_ACCOUNT_PROVIDER, params });
  if (!tokens) throw new Error("the deployment signed nobody in");

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage();
    await page.goto(site);
    const keys = authStorageKeys(convexUrl);
    await page.evaluate(([k, t]) => {
      localStorage.setItem(k.jwt, t.token);
      localStorage.setItem(k.refreshToken, t.refreshToken);
    }, [keys, tokens] as const);
    await page.reload();
    await page.getByRole("button", { name: signOutWords }).waitFor({ timeout: SIGNED_IN_WAIT_MS });
    await page.context().storageState({ path: TEST_ACCOUNT_STATE });
    console.log(`signed in to ${site}; session saved to ${TEST_ACCOUNT_STATE}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
