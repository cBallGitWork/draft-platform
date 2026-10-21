import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { EMAILS_PER_DAY } from "./emailLimit";
import {
  ADMIN,
  LISTED,
  SITE_URL,
  UNLISTED,
  ask,
  fakeResend,
  linkCode,
  openLink,
  resetSignInDeployment,
  setSentToday,
  signInDeployment,
  type TestConvex,
} from "./signIn.harness";
import { ASKS_PER_HOUR } from "./signInLinks";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});
afterEach(resetSignInDeployment);

/** What Convex Auth's own signIn says when no ask let the email through. */
const REFUSED = "a sign-in link is sent only by signInLinks:ask";

/** Convex Auth's public signIn asked for a link, as anyone could call it, bypassing `ask`. */
const signInDirectly = (email: string) => t.action(api.auth.signIn, { provider: "resend", params: { email } });

/** Every user and Convex Auth account made so far. */
async function accountsMade() {
  return t.run(async (ctx) => ({
    users: await ctx.db.query("users").collect(),
    authAccounts: await ctx.db.query("authAccounts").collect(),
  }));
}
const NO_ACCOUNTS = { users: [], authAccounts: [] };

async function asksStored(email: string) {
  return t.run((ctx) =>
    ctx.db
      .query("signInAsks")
      .withIndex("by_email_and_askedAt", (q) => q.eq("email", email))
      .collect(),
  );
}

describe("asking for a link", () => {
  test("an email on the list is told to check its email, and gets one link to the site", async () => {
    const sent = fakeResend();

    expect(await ask(t, LISTED)).toBe("checkYourEmail");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(LISTED);
    expect(sent[0].text).toContain(`${SITE_URL}/?code=`);
  });

  test("an email off the list gets the same reply, and no email and no account", async () => {
    const sent = fakeResend();

    expect(await ask(t, UNLISTED)).toBe("checkYourEmail");

    expect(sent).toEqual([]);
    expect(await accountsMade()).toEqual(NO_ACCOUNTS);
  });

  test("the admin's email gets a link without being put on the list", async () => {
    const sent = fakeResend();

    expect(await ask(t, ADMIN)).toBe("checkYourEmail");

    expect(sent.map((email) => email.to)).toEqual([ADMIN]);
  });

  test("an email is matched however it is typed: spaces and capitals change nothing", async () => {
    const sent = fakeResend();

    await ask(t, `  ${LISTED.toUpperCase()} `);

    expect(sent.map((email) => email.to)).toEqual([LISTED]);
  });

  test("two asks let through at once each make their own link, and a third call makes none", async () => {
    const sent = fakeResend();
    await t.mutation(internal.signInLinks.recordAsk, { email: LISTED });
    await t.mutation(internal.signInLinks.recordAsk, { email: LISTED });

    await signInDirectly(LISTED);
    await signInDirectly(LISTED);
    await expect(signInDirectly(LISTED)).rejects.toThrow(REFUSED);

    expect(sent).toHaveLength(2);
  });

  test("Convex Auth's own signIn, called directly with an email, sends nothing", async () => {
    const sent = fakeResend();

    await expect(signInDirectly(LISTED)).rejects.toThrow(REFUSED);

    expect(sent).toEqual([]);
  });

  test("Convex Auth's own signIn, called directly, leaves the link an ask sent working", async () => {
    const sent = fakeResend();
    await ask(t, LISTED);

    await expect(signInDirectly(LISTED)).rejects.toThrow(REFUSED);

    expect(await openLink(t, linkCode(sent[0]))).not.toBeNull();
  });

  test("Convex Auth's own signIn, called directly for an email off the list, makes no account", async () => {
    fakeResend();

    await expect(signInDirectly(UNLISTED)).rejects.toThrow(REFUSED);

    expect(await accountsMade()).toEqual(NO_ACCOUNTS);
  });

  test("an email off the list that has just asked still gets nothing from Convex Auth's own signIn", async () => {
    const sent = fakeResend();
    await ask(t, UNLISTED);

    await expect(signInDirectly(UNLISTED)).rejects.toThrow(REFUSED);

    expect(sent).toEqual([]);
    expect(await accountsMade()).toEqual(NO_ACCOUNTS);
  });
});

describe("the hourly limit", () => {
  test.each([
    ["on the list", LISTED],
    ["off the list", UNLISTED],
  ])("an email %s is told to try later on its fourth ask in an hour", async (_, email) => {
    const sent = fakeResend();
    for (let asked = 0; asked < ASKS_PER_HOUR; asked++) expect(await ask(t, email)).toBe("checkYourEmail");

    expect(await ask(t, email)).toBe("tryLater");

    expect(sent).toHaveLength(email === LISTED ? ASKS_PER_HOUR : 0);
  });

  test("an hour after its first ask, an email can ask again", async () => {
    fakeResend();
    for (let asked = 0; asked < ASKS_PER_HOUR; asked++) await ask(t, LISTED);

    vi.advanceTimersByTime(HOUR_MS);

    expect(await ask(t, LISTED)).toBe("checkYourEmail");
  });

  test("an ask refused as one too many leaves the last link working", async () => {
    const sent = fakeResend();
    for (let asked = 0; asked < ASKS_PER_HOUR; asked++) await ask(t, LISTED);
    await ask(t, LISTED);

    expect(await openLink(t, linkCode(sent[ASKS_PER_HOUR - 1]))).not.toBeNull();
  });
});

describe("the day's email limit", () => {
  async function sendTodaysLastEmail() {
    await setSentToday(t, EMAILS_PER_DAY - 1);
    await ask(t, ADMIN);
  }

  test.each([
    ["on the list", LISTED],
    ["off the list", UNLISTED],
  ])("once the day's emails are spent, an email %s is told links are paused", async (_, email) => {
    const sent = fakeResend();
    await sendTodaysLastEmail();

    expect(await ask(t, email)).toBe("paused");

    expect(sent.map((sentEmail) => sentEmail.to)).toEqual([ADMIN]);
  });

  test("the next day (UTC), links go out again", async () => {
    fakeResend();
    await sendTodaysLastEmail();

    vi.setSystemTime(new Date("2026-10-21T00:00:00Z"));

    expect(await ask(t, LISTED)).toBe("checkYourEmail");
  });
});

describe("when the email can't be sent", () => {
  test("Resend refusing it is told as not sent, and kept on the ask", async () => {
    fakeResend(500);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await ask(t, LISTED)).toBe("notSent");

    expect(logged).toHaveBeenCalledWith(expect.stringContaining(`The sign-in link to ${LISTED} wasn't sent`));
    const [stored] = await asksStored(LISTED);
    expect(stored.sendError).toContain("Resend refused the email (500)");
  });

  test("without AUTH_RESEND_KEY set, it is told as not sent", async () => {
    const sent = fakeResend();
    vi.stubEnv("AUTH_RESEND_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await ask(t, LISTED)).toBe("notSent");

    expect(sent).toEqual([]);
    const [stored] = await asksStored(LISTED);
    expect(stored.sendError).toContain("AUTH_RESEND_KEY isn't set");
  });
});

describe("opening a link", () => {
  test("signs the email in once; the same link a second time is refused", async () => {
    const sent = fakeResend();
    await ask(t, LISTED);
    const code = linkCode(sent[0]);

    expect(await openLink(t, code)).toMatchObject({ token: expect.any(String), refreshToken: expect.any(String) });
    expect(await openLink(t, code)).toBeNull();
  });

  test.each([
    ["signs in a minute before its hour is up", -MINUTE_MS, true],
    ["is refused a minute after its hour is up", MINUTE_MS, false],
  ])("%s", async (_, offsetMs, signsIn) => {
    const sent = fakeResend();
    await ask(t, LISTED);

    vi.advanceTimersByTime(HOUR_MS + offsetMs);

    expect((await openLink(t, linkCode(sent[0]))) !== null).toBe(signsIn);
  });
});

describe("the allowed list", () => {
  test("adding an email twice keeps one row, stored trimmed and lower-cased", async () => {
    expect(await t.mutation(internal.allowedEmails.add, { email: " New@Example.com" })).toBe("added");
    expect(await t.mutation(internal.allowedEmails.add, { email: "new@example.com" })).toBe("already on the list");

    const rows = await t.run((ctx) => ctx.db.query("allowedEmails").collect());
    expect(rows.map((row) => row.email)).toEqual([LISTED, "new@example.com"]);
  });

  test("something that isn't an email address is refused, not stored", async () => {
    await expect(t.mutation(internal.allowedEmails.add, { email: "craig" })).rejects.toThrow("isn't an email address");
  });
});
