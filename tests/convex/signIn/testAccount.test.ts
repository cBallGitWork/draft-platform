// The test account (convex/signIn/testAccount.ts, spec/02): one email signs in with a secret, and
// every other try gets the same refusal. And the operator's step that makes it a team's manager.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../../../convex/outbound/deploymentSettings";
import { TEST_ACCOUNT_PROVIDER, sameSecret } from "../../../convex/signIn/testAccount";
import { addManager, adminCreatesLeague, eventsIn, LEAGUE_NAME, MANAGERS, onTheList, teamsIn } from "../../support/convex/leagues.harness";
import { fakeResend, LISTED, signInDeployment } from "../../support/convex/signIn.harness";
import type { TestConvex } from "../../support/convex/test.harness";

const TEST_EMAIL = "dummy@example.com";
const SECRET = "a-long-test-secret";

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  vi.stubEnv(TEST_ACCOUNT_EMAIL_SETTING, TEST_EMAIL);
  vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, SECRET);
});

async function signInWith(email: string, secret: string) {
  const { tokens } = await t.action(api.auth.signIn, { provider: TEST_ACCOUNT_PROVIDER, params: { email, secret } });
  return tokens ?? null;
}

const usersWith = (email: string) => t.run(async (ctx) => (await ctx.db.query("users").collect()).filter((user) => user.email === email));

describe("signing in with the secret", () => {
  test("the right secret signs in the test email, as one user each time", async () => {
    expect(await signInWith(TEST_EMAIL, SECRET)).not.toBeNull();
    expect(await signInWith(" Dummy@Example.com", SECRET)).not.toBeNull();
    expect(await usersWith(TEST_EMAIL)).toHaveLength(1);
  });

  test("a wrong secret, another email, or either setting unset is refused alike, and makes no user", async () => {
    expect(await signInWith(TEST_EMAIL, "wrong")).toBeNull();
    expect(await signInWith(LISTED, SECRET)).toBeNull();
    vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, "");
    expect(await signInWith(TEST_EMAIL, SECRET)).toBeNull();
    vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, SECRET);
    vi.stubEnv(TEST_ACCOUNT_EMAIL_SETTING, "");
    expect(await signInWith(TEST_EMAIL, SECRET)).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  test("a changed secret ends the old one at once", async () => {
    vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, "the-new-secret");
    expect(await signInWith(TEST_EMAIL, SECRET)).toBeNull();
    expect(await signInWith(TEST_EMAIL, "the-new-secret")).not.toBeNull();
  });

  test("the comparison matches only the same string", async () => {
    expect(await sameSecret("abc", "abc")).toBe(true);
    expect(await sameSecret("abc", "abd")).toBe(false);
    expect(await sameSecret("abc", "abcd")).toBe(false);
  });
});

describe("making the test account a team's manager", () => {
  const setUp = (teamNumber = 2) => t.mutation(internal.signIn.testAccount.setUp, { leagueName: LEAGUE_NAME, teamNumber });

  test("it takes the vacated team, may then sign in, and running it again changes nothing", async () => {
    const leagueId = await adminCreatesLeague(t);
    await addManager(t, leagueId, MANAGERS[0]);
    // A vacated second team, as Alpha's is.
    const second = await t.run((ctx) => ctx.db.insert("teams", { leagueId, number: 2, name: "test2" }));
    expect(await setUp()).toBe("made manager");
    expect(await setUp()).toBe("already manager");
    expect((await teamsIn(t, leagueId)).find((team) => team._id === second)?.managerEmail).toBe(TEST_EMAIL);
    expect(await onTheList(t, TEST_EMAIL)).toBe(true);
    expect((await eventsIn(t, leagueId)).filter((event) => event.kind === "managerAdded" && event.email === TEST_EMAIL)).toHaveLength(1);
  });

  test("a team with another manager is refused, untouched", async () => {
    const leagueId = await adminCreatesLeague(t);
    await addManager(t, leagueId, MANAGERS[0]);
    await addManager(t, leagueId, MANAGERS[1]);
    await expect(setUp()).rejects.toThrow("already has a manager");
    expect((await teamsIn(t, leagueId)).map((team) => team.managerEmail)).toEqual([MANAGERS[0], MANAGERS[1]]);
  });
});
