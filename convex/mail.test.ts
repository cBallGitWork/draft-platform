import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { refusals } from "./leagueAccess";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "./leagues.harness";
import { adminByline } from "./letterWords";
import { mailRefusals } from "./mail";
import { BODY_MAX, SUBJECT_MAX, UNREAD_COUNTED } from "./mailLimits";
import { fakeResend, resetSignInDeployment, signInDeployment } from "./signIn.harness";

// Mail (#26, spec/16): a filed letter reaches exactly the right people, unread until opened, and
// the count matches; the commissioner writes to the whole league.

const [ANN, BOB, CAT] = MANAGERS;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
});
afterEach(resetSignInDeployment);

async function mailOf(email: string) {
  const person = await actingAs(t, email);
  return {
    letters: () => person.query(api.mail.letters, {}),
    subjects: async () => (await person.query(api.mail.letters, {})).map((letter) => letter.subject),
    unread: () => person.query(api.mail.unreadCount, {}),
    open: (letterId: Id<"letters">) => person.mutation(api.mail.open, { letterId }),
    writeToLeague: (subject: string, body: string) => person.mutation(api.mail.writeToLeague, { leagueId, subject, body }),
  };
}

/** Every letter filed, as [to, subject]. */
const everyLetter = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).map((row) => [row.to, row.subject]));

describe("letters about the league's events", () => {
  test("each goes to everyone in the league as it is after the event, and to nobody else", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);

    expect(await (await mailOf(ANN)).subjects()).toEqual([`${BOB} joined as manager of Team 2`, `${ANN} joined as manager of Team 1`]);
    // Bob joined after Ann, so her letter was never his.
    expect(await (await mailOf(BOB)).subjects()).toEqual([`${BOB} joined as manager of Team 2`]);
    expect(await (await mailOf(CAT)).letters()).toEqual([]);
    expect(await (await mailOf(ADMIN)).letters()).toEqual([]);
  });

  test("someone with two parts in the league gets one copy", async () => {
    await addManagers(t, leagueId, [COMMISSIONER, ANN]);
    const copies = (await everyLetter()).filter(([to, subject]) => to === COMMISSIONER && subject === `${ANN} joined as manager of Team 2`);
    expect(copies).toHaveLength(1);
  });

  test("a league's letters stay in that league", async () => {
    const otherLeague = await adminCreatesLeague(t, 4, "Other");
    await addManagers(t, otherLeague, [CAT]);
    await addManagers(t, leagueId, [ANN]);

    expect((await (await mailOf(CAT)).letters()).map((letter) => letter.leagueName)).toEqual(["Other"]);
    expect((await (await mailOf(ANN)).letters()).map((letter) => letter.leagueName)).toEqual(["Tim Hortons Pro League"]);
  });

  test("the copy to whoever did it is filed read, and everyone else's unread", async () => {
    await addManagers(t, leagueId, [ANN]);
    const commissioner = await mailOf(COMMISSIONER);
    const ann = await mailOf(ANN);

    expect((await commissioner.letters()).map((letter) => letter.read)).toEqual([true, false, false]);
    expect(await ann.unread()).toBe(1);
  });

  test("the admin is named as the admin, never by his email", async () => {
    const [, named] = await t.run((ctx) => ctx.db.query("letters").collect());
    expect(named.body).toBe(`${adminByline} named ${COMMISSIONER} the league's commissioner.`);
    expect(named.body).not.toContain(ADMIN);
  });

  test("a manager who is removed is told, and gets nothing after", async () => {
    const [annTeam] = await addManagers(t, leagueId, [ANN, BOB]);
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.teams.removeManager, { leagueId, teamId: annTeam });
    await addManagers(t, leagueId, [CAT]);

    const ann = await (await mailOf(ANN)).subjects();
    expect(ann[0]).toBe(`${ANN} was removed from Team 1`);
    expect(ann).not.toContain(`${CAT} joined as manager of Team 3`);
    expect(await (await mailOf(BOB)).subjects()).toContain(`${CAT} joined as manager of Team 3`);
    expect(await (await mailOf(BOB)).subjects()).toContain(`${ANN} was removed from Team 1`);
  });

  test("a co-commissioner who is replaced is told, as is the one named", async () => {
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await commissioner.mutation(api.leagues.nameCoCommissioner, { leagueId, email: ANN });

    const replacing = `${ANN} is the co-commissioner`;
    expect((await (await mailOf(CO_COMMISSIONER)).subjects())[0]).toBe(replacing);
    expect((await (await mailOf(ANN)).subjects())[0]).toBe(replacing);
  });

  test("a manager who leaves gets the letter saying so, already read", async () => {
    await addManagers(t, leagueId, [ANN]);
    await (await actingAs(t, ANN)).mutation(api.teams.leave, { leagueId });

    const [left] = await (await mailOf(ANN)).letters();
    expect(left).toMatchObject({ subject: `${ANN} left Team 1`, read: true });
  });
});

describe("unread", () => {
  test("a letter is unread until its reader opens it, and the count says so", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    const ann = await mailOf(ANN);
    expect(await ann.unread()).toBe(2);

    const [newest] = await ann.letters();
    await ann.open(newest.letterId);
    expect((await ann.letters()).map((letter) => letter.read)).toEqual([true, false]);
    expect(await ann.unread()).toBe(1);

    await ann.open(newest.letterId);
    expect(await ann.unread()).toBe(1);
  });

  test("opening your copy leaves everyone else's unread", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    const ann = await mailOf(ANN);
    for (const letter of await ann.letters()) await ann.open(letter.letterId);

    expect(await ann.unread()).toBe(0);
    expect(await (await mailOf(BOB)).unread()).toBe(1);
  });

  test("nobody can open a letter that isn't theirs", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    const [annsLetter] = await (await mailOf(ANN)).letters();
    await expect((await mailOf(BOB)).open(annsLetter.letterId)).rejects.toThrow(mailRefusals.noLetter);
    await expect(t.mutation(api.mail.open, { letterId: annsLetter.letterId })).rejects.toThrow(refusals.signedOut);
  });

  test(`the count stops one past ${UNREAD_COUNTED}`, async () => {
    await addManagers(t, leagueId, [ANN]);
    const commissioner = await mailOf(COMMISSIONER);
    for (let letter = 0; letter < UNREAD_COUNTED + 5; letter += 1) await commissioner.writeToLeague(`Letter ${letter}`, "Hello");

    expect(await (await mailOf(ANN)).unread()).toBe(UNREAD_COUNTED + 1);
  });

  test("signed out, there is no Mail", async () => {
    expect(await t.query(api.mail.letters, {})).toEqual([]);
    expect(await t.query(api.mail.unreadCount, {})).toBe(0);
  });
});

describe("the commissioner's letter to the league", () => {
  beforeEach(async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
  });

  test("it reaches everyone in the league, from the commissioner, newest first", async () => {
    vi.advanceTimersByTime(60_000);
    await (await mailOf(COMMISSIONER)).writeToLeague("  Draft night  ", " Friday at eight. ");

    const [newest, older] = await (await mailOf(BOB)).letters();
    expect(newest).toMatchObject({ subject: "Draft night", body: "Friday at eight.", from: COMMISSIONER, read: false });
    expect(newest.at).toBeGreaterThan(older.at);
    expect((await everyLetter()).filter(([, subject]) => subject === "Draft night").map(([to]) => to).sort()).toEqual(
      [ANN, BOB, COMMISSIONER].sort(),
    );
    expect((await (await mailOf(COMMISSIONER)).letters())[0].read).toBe(true);
  });

  test.each([CO_COMMISSIONER, ADMIN])("%s can write one too", async (writer) => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await (await mailOf(writer)).writeToLeague("Hello", "From me.");
    expect((await (await mailOf(ANN)).letters())[0]).toMatchObject({ subject: "Hello", from: writer });
  });

  test("a manager can't write one", async () => {
    await expect((await mailOf(ANN)).writeToLeague("Hello", "Hi.")).rejects.toThrow(refusals.notRunner);
  });

  test.each([
    { case: "a blank subject", subject: "  ", body: "Hi.", refusal: mailRefusals.blankSubject },
    { case: "blank text", subject: "Hello", body: " ", refusal: mailRefusals.blankBody },
    { case: "a subject too long", subject: "x".repeat(SUBJECT_MAX + 1), body: "Hi.", refusal: mailRefusals.subjectTooLong },
    { case: "text too long", subject: "Hello", body: "x".repeat(BODY_MAX + 1), refusal: mailRefusals.bodyTooLong },
  ])("a letter with $case is refused, and nothing is filed", async ({ subject, body, refusal }) => {
    const before = (await everyLetter()).length;
    await expect((await mailOf(COMMISSIONER)).writeToLeague(subject, body)).rejects.toThrow(refusal);
    expect(await everyLetter()).toHaveLength(before);
  });

  test("a subject and text at their longest are sent", async () => {
    await (await mailOf(COMMISSIONER)).writeToLeague("x".repeat(SUBJECT_MAX), "y".repeat(BODY_MAX));
    expect((await (await mailOf(ANN)).letters())[0].subject).toHaveLength(SUBJECT_MAX);
  });
});
