import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { DataModel } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { recordEvent } from "../mail/letters";
import { putOnTeam } from "../leagues/teams";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../outbound/deploymentSettings";
import { teamsOf } from "../shared/leagueAccess";
import { adminEmail, normaliseEmail } from "./allowedEmails";

// The one test account (spec/02): a dummy that signs in with a secret instead of a link, so Claude
// can drive the live site. The email and the secret live only on the deployment; the secret is
// read afresh on every sign-in and never stored, so changing it ends the old one at once. While
// either is unset the path is off. Every refusal is the same: no tokens.
//
// The browser signs in with:
//   signIn("test-account", { email, secret })
// The operator makes the account manager of a league's team once, on the live site:
//   npx convex run --prod signIn/testAccount:setUp '{"leagueName":"Alpha","teamNumber":2}'

/** The provider's id, which the browser names to sign in this way. */
export const TEST_ACCOUNT_PROVIDER = "test-account";

/** The test account's email and secret, or null while either is unset: the path is off. */
function testAccount(): { email: string; secret: string } | null {
  const email = process.env[TEST_ACCOUNT_EMAIL_SETTING];
  const secret = process.env[TEST_ACCOUNT_SECRET_SETTING];
  return email && secret ? { email: normaliseEmail(email), secret } : null;
}

const sha256 = async (text: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/** Whether two strings match, taking the same time wherever they differ: both are hashed to the
 *  same length first, and every byte is compared. */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

export const TestAccount = ConvexCredentials<DataModel>({
  id: TEST_ACCOUNT_PROVIDER,
  authorize: async (credentials, ctx) => {
    const account = testAccount();
    if (account === null) return null;
    const { email, secret } = credentials;
    if (typeof email !== "string" || typeof secret !== "string") return null;
    // Both checks always run, so a wrong email takes as long as a wrong secret.
    const rightSecret = await sameSecret(secret, account.secret);
    if (normaliseEmail(email) !== account.email || !rightSecret) return null;
    const existing = await retrieveAccount(ctx, { provider: TEST_ACCOUNT_PROVIDER, account: { id: account.email } }).catch(() => null);
    if (existing) return { userId: existing.user._id };
    const { user } = await createAccount(ctx, {
      provider: TEST_ACCOUNT_PROVIDER,
      account: { id: account.email },
      profile: { email: account.email },
    });
    return { userId: user._id };
  },
});

/** Makes the test account manager of team `teamNumber` in the league named `leagueName`, and lets
 *  it sign in. Run again, it changes nothing. The team must be vacated or already the account's. */
export const setUp = internalMutation({
  args: { leagueName: v.string(), teamNumber: v.number() },
  returns: v.union(v.literal("made manager"), v.literal("already manager")),
  handler: async (ctx, { leagueName, teamNumber }) => {
    const account = testAccount();
    if (account === null) throw new Error(`${TEST_ACCOUNT_EMAIL_SETTING} and ${TEST_ACCOUNT_SECRET_SETTING} must both be set first`);
    const leagues = (await ctx.db.query("leagues").collect()).filter((league) => league.name === leagueName);
    if (leagues.length !== 1) throw new Error(`${leagues.length} leagues are named "${leagueName}": one must be`);
    const [league] = leagues;
    const team = (await teamsOf(ctx, league._id)).find((each) => each.number === teamNumber);
    if (!team) throw new Error(`"${leagueName}" has no team ${teamNumber}`);
    if (team.managerEmail === account.email) return "already manager";
    if (team.managerEmail !== undefined) throw new Error(`team ${teamNumber} of "${leagueName}" already has a manager`);
    const { teamId, teamName } = await putOnTeam(ctx, league, account.email, team._id);
    await recordEvent(ctx, league._id, adminEmail(), { kind: "managerAdded", email: account.email, teamId, teamName });
    return "made manager";
  },
});
