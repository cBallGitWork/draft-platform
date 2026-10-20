import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  ADMIN,
  LISTED,
  ask,
  fakeResend,
  linkCode,
  openLink,
  resetSignInDeployment,
  signInDeployment,
  type TestConvex,
} from "./signIn.harness";

const DAY_MS = 24 * 60 * 60 * 1000;

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});
afterEach(resetSignInDeployment);

/** Asks for a link for `email` and opens it: the browser's tokens, and who the server sees. */
async function signIn(email: string) {
  const sent = fakeResend();
  await ask(t, email);
  const tokens = await openLink(t, linkCode(sent[0]));
  if (!tokens) throw new Error(`the link to ${email} didn't sign in`);
  const session = await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    return ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user!._id))
      .unique();
  });
  // Convex Auth's token names the user and the session, as `getAuthUserId` reads it.
  return { tokens, asUser: t.withIdentity({ subject: `${session!.userId}|${session!._id}` }) };
}

const refresh = async (refreshToken: string) => (await t.action(api.auth.signIn, { refreshToken })).tokens ?? null;

test("signed out, the browser is signed in as nobody", async () => {
  expect(await t.query(api.account.signedInAs, {})).toBeNull();
});

test("signed in by a link, a manager is seen by their email, as no admin, and in no league", async () => {
  const { asUser } = await signIn(LISTED);

  expect(await asUser.query(api.account.signedInAs, {})).toEqual({ email: LISTED, isAdmin: false, inLeague: false });
});

test("the admin, signed in, is seen as the admin", async () => {
  const { asUser } = await signIn(ADMIN);

  expect(await asUser.query(api.account.signedInAs, {})).toMatchObject({ email: ADMIN, isAdmin: true });
});

test("a session keeps a device signed in for 30 days, and no longer", async () => {
  const { tokens } = await signIn(LISTED);

  vi.advanceTimersByTime(29 * DAY_MS);
  const day29 = await refresh(tokens.refreshToken);
  expect(day29).not.toBeNull();

  vi.advanceTimersByTime(2 * DAY_MS);
  expect(await refresh(day29!.refreshToken)).toBeNull();
});
