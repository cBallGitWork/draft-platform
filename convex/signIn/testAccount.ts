import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount } from "@convex-dev/auth/server";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../outbound/deploymentSettings";
import { normaliseEmail } from "./allowedEmails";

// spec/02, One test account signs in with a secret: one dummy account signs in with a secret
// instead of a link, so Claude can test the live site. Both are deployment settings, never code;
// with either unset this way in refuses everyone. No page offers it: the browser tests call
// `signIn` with this provider and `{ email, secret }` (tests/live/testAccountSignIn.ts).

/** The provider's id, which `signIn` names. */
export const TEST_ACCOUNT_PROVIDER = "test-account";

/** The one refusal: a wrong email, a wrong secret and the way in being off all get it. */
export const TEST_ACCOUNT_REFUSED = "That sign-in isn't accepted.";

const sha256 = async (text: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/** Whether two strings match, taking the same time wherever they differ: both are hashed to one
 *  length, then every byte is compared. */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The test account's email if `email` and `secret` are its pair, otherwise null. */
export async function testAccountEmail(email: unknown, secret: unknown): Promise<string | null> {
  const wantedEmail = process.env[TEST_ACCOUNT_EMAIL_SETTING];
  const wantedSecret = process.env[TEST_ACCOUNT_SECRET_SETTING];
  if (!wantedEmail || !wantedSecret || typeof email !== "string" || typeof secret !== "string") return null;
  const secretMatches = await sameSecret(secret, wantedSecret);
  const emailMatches = normaliseEmail(email) === normaliseEmail(wantedEmail);
  return secretMatches && emailMatches ? normaliseEmail(wantedEmail) : null;
}

export const testAccount = ConvexCredentials({
  id: TEST_ACCOUNT_PROVIDER,
  async authorize({ email, secret }, ctx) {
    const accountEmail = await testAccountEmail(email, secret);
    if (!accountEmail) throw new Error(TEST_ACCOUNT_REFUSED);
    // Linked by email, so the account is the same user a link to that email signs in.
    const { user } = await createAccount(ctx, {
      provider: TEST_ACCOUNT_PROVIDER,
      account: { id: accountEmail },
      profile: { email: accountEmail },
      shouldLinkViaEmail: true,
    });
    return { userId: user._id };
  },
});
