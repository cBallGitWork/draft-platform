import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { TEST_ACCOUNT_EMAIL_SETTING, TEST_ACCOUNT_SECRET_SETTING } from "../../../convex/outbound/deploymentSettings";
import { TEST_ACCOUNT_PROVIDER, TEST_ACCOUNT_REFUSED, sameSecret } from "../../../convex/signIn/testAccount";
import { LISTED, signInDeployment } from "../../support/convex/signIn.harness";
import type { TestConvex } from "../../support/convex/test.harness";

// spec/02, One test account signs in with a secret.

const TEST_EMAIL = "dummy@example.com";
const SECRET = "a-long-test-secret";

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  vi.stubEnv(TEST_ACCOUNT_EMAIL_SETTING, TEST_EMAIL);
  vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, SECRET);
});

const signInWith = (email: string, secret: string) =>
  t.action(api.auth.signIn, { provider: TEST_ACCOUNT_PROVIDER, params: { email, secret } });

async function signedInEmail(token: string) {
  const [, payload] = token.split(".");
  const subject = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).sub as string;
  return t.withIdentity({ subject }).query(api.signIn.account.signedInAs, {});
}

test("the test email with its secret signs in, as that email", async () => {
  const { tokens } = await signInWith(TEST_EMAIL, SECRET);
  expect(tokens?.token).toBeTruthy();
  expect((await signedInEmail(tokens!.token))?.email).toBe(TEST_EMAIL);
});

test("signing in twice is the same account", async () => {
  await signInWith(TEST_EMAIL, SECRET);
  const second = await signInWith(TEST_EMAIL, SECRET);
  expect(second.tokens).toBeTruthy();
  const users = await t.run((ctx) => ctx.db.query("users").collect());
  expect(users.filter((u) => u.email === TEST_EMAIL)).toHaveLength(1);
});

test("a wrong secret is refused", async () => {
  await expect(signInWith(TEST_EMAIL, "wrong")).rejects.toThrow(TEST_ACCOUNT_REFUSED);
});

test("any other email, even with the secret, is refused the same way", async () => {
  await expect(signInWith(LISTED, SECRET)).rejects.toThrow(TEST_ACCOUNT_REFUSED);
});

test("with the secret unset, the way in is off", async () => {
  vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, "");
  await expect(signInWith(TEST_EMAIL, "")).rejects.toThrow(TEST_ACCOUNT_REFUSED);
});

test("with the email unset, the way in is off", async () => {
  vi.stubEnv(TEST_ACCOUNT_EMAIL_SETTING, "");
  await expect(signInWith("", SECRET)).rejects.toThrow(TEST_ACCOUNT_REFUSED);
});

test("a changed secret ends the old one at once", async () => {
  vi.stubEnv(TEST_ACCOUNT_SECRET_SETTING, "the-new-secret");
  await expect(signInWith(TEST_EMAIL, SECRET)).rejects.toThrow(TEST_ACCOUNT_REFUSED);
});

test("secrets match only when equal", async () => {
  expect(await sameSecret("abc", "abc")).toBe(true);
  expect(await sameSecret("abc", "abd")).toBe(false);
  expect(await sameSecret("abc", "abcd")).toBe(false);
});
