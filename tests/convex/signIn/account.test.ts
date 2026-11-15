import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import {
  ADMIN,
  LISTED,
  ask,
  fakeResend,
  linkCode,
  openLink,
  signInDeployment,
} from "../../support/convex/signIn.harness";
import type { TestConvex } from "../../support/convex/test.harness";
import { DAY_MS } from "../../../convex/shared/time";

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});

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
  expect(await t.query(api.signIn.account.signedInAs, {})).toBeNull();
});

test("signed in by a link, a manager is seen by their email, as no admin, and in no league", async () => {
  const { asUser } = await signIn(LISTED);

  expect(await asUser.query(api.signIn.account.signedInAs, {})).toEqual({
    email: LISTED,
    isAdmin: false,
    inLeague: false,
    leagues: [],
    switchableLeagueIds: [],
    currentLeagueId: null,
  });
});

test("the admin, signed in, is seen as the admin", async () => {
  const { asUser } = await signIn(ADMIN);

  expect(await asUser.query(api.signIn.account.signedInAs, {})).toMatchObject({ email: ADMIN, isAdmin: true });
});

test("a session keeps a device signed in for 30 days, and no longer", async () => {
  const { tokens } = await signIn(LISTED);

  vi.advanceTimersByTime(29 * DAY_MS);
  const day29 = await refresh(tokens.refreshToken);
  expect(day29).not.toBeNull();

  vi.advanceTimersByTime(2 * DAY_MS);
  expect(await refresh(day29!.refreshToken)).toBeNull();
});

/** Every device signed in: Convex Auth's sessions. */
const sessions = () => t.run((ctx) => ctx.db.query("authSessions").collect());

test("LG-006 S02.1: an empty email sent past the browser is told to check its email, with no email sent and nothing stored", async () => {
  const sent = fakeResend();

  expect(await ask(t, "")).toBe("checkYourEmail");

  expect(sent).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("signInAsks").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("LG-016 S02.2: a link asked for on the laptop and opened on the phone signs the phone in, and only it", async () => {
  const sent = fakeResend();
  // The laptop's ask is answered with words, never a session.
  expect(await ask(t, LISTED)).toBe("checkYourEmail");
  expect(await sessions()).toEqual([]);

  expect(await openLink(t, linkCode(sent[0]))).not.toBeNull();

  const phone = await sessions();
  expect(phone).toHaveLength(1);
  const asPhone = t.withIdentity({ subject: `${phone[0].userId}|${phone[0]._id}` });
  expect(await asPhone.query(api.signIn.account.signedInAs, {})).toMatchObject({ email: LISTED });
});

test("LG-020 S02.3: signed out in one tab, the session ends, so another tab can't renew it and is seen as nobody", async () => {
  const { tokens, asUser } = await signIn(LISTED);

  await asUser.action(api.auth.signOut, {});

  expect(await sessions()).toEqual([]);
  expect(await refresh(tokens.refreshToken)).toBeNull();
  expect(await t.query(api.signIn.account.signedInAs, {})).toBeNull();
});
