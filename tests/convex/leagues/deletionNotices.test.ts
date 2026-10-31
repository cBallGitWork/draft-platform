import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ANN, BOB, deletes, leagueWithPeople, moreEventsThanOneRun } from "../../support/convex/leagueDeletion.harness";
import { notEmailedLog, waitingLog } from "../../../convex/leagues/deletionNotices";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, LEAGUE_NAME, actingAs, type TestConvex } from "../../support/convex/leagues.harness";
import { EMAILS_PER_DAY, startOfNextDay } from "../../../convex/outbound/emailLimit";
import { finishWhatIsDueNow } from "../../support/convex/joining.harness";
import { fakeResend, sentToday, setSentToday, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { elapse, pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";

// The email saying a league has been deleted, sent only once it is gone for good (#320, spec/13,
// Deleting): "just delay the deletion email until its actually gone".

let t: TestConvex;
let leagueId: Id<"leagues">;
let sent: SentEmail[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await leagueWithPeople(t);
  sent = fakeResend();
});

/** The day runs out, the league is deleted for good, and the emails saying so are sent. */
const goneForGood = () => t.finishAllScheduledFunctions(vi.runAllTimers);

/** The commissioner deletes the league and the clock reaches the moment before it goes: the day's
 *  emails counted from here are the day it goes, not the day it was deleted. */
async function toTheMomentBeforeItGoes() {
  const deletesAt = await deletes(t, COMMISSIONER, leagueId);
  await elapse(t, deletesAt - 1 - Date.now());
}

/** Each row kept for someone who wasn't told, without when it was kept. */
const unemailedRows = async () =>
  (await t.run((ctx) => ctx.db.query("unemailedDeletions").collect())).map(({ leagueName, by, email, reason }) => ({ leagueName, by, email, reason }));

describe("while a deletion can be undone", () => {
  test("deleting a league emails nobody, up to the moment before it goes", async () => {
    await toTheMomentBeforeItGoes();
    expect(sent).toEqual([]);
  });

  test("undoing it emails nobody, then or after the day", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId });
    await goneForGood();
    expect(sent).toEqual([]);
    expect(await unemailedRows()).toEqual([]);
  });
});

describe("once it is gone for good, it emails", () => {
  test("everyone who had a part in it but whoever deleted it, once each, saying it has been deleted", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    await goneForGood();

    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
    expect(sent[0].subject).toBe(`${LEAGUE_NAME} has been deleted`);
    expect(sent[0].text).toContain(`${COMMISSIONER} deleted ${LEAGUE_NAME}. It is gone for good`);
  });

  test("the commissioner too, when the admin deleted it", async () => {
    await deletes(t, ADMIN, leagueId);
    await goneForGood();
    expect(sent.map((email) => email.to)).toEqual([COMMISSIONER, CO_COMMISSIONER, ANN, BOB]);
  });

  test("the same people once each, when the league takes more than one run to delete", async () => {
    await moreEventsThanOneRun(t, leagueId);
    await deletes(t, COMMISSIONER, leagueId);
    await goneForGood();
    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
  });

  test("the same people, for a league deleted before #320 that still holds its old list of who wasn't told", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    await t.run(async (ctx) => {
      const { deletion } = (await ctx.db.get("leagues", leagueId))!;
      await ctx.db.patch("leagues", leagueId, { deletion: { ...deletion!, unemailed: [{ email: ANN, reason: "paused" }] } });
    });
    await goneForGood();
    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
  });

  test("each counting against the day's emails: the day it goes", async () => {
    await toTheMomentBeforeItGoes();
    const before = await sentToday(t);
    await goneForGood();
    expect(await sentToday(t)).toBe(before + 3);
  });
});

describe("past the day's emails (spec/13, #837)", () => {
  /** The league goes for good with `left` of the day's emails still to send, and what is due then
   *  runs: nothing waiting for the next day does. */
  async function goesWithEmailsLeft(left: number) {
    await toTheMomentBeforeItGoes();
    await setSentToday(t, EMAILS_PER_DAY - left);
    await elapse(t, 1);
    await finishWhatIsDueNow(t);
  }

  /** The runs still to come, with when each is due. */
  const runsToCome = async () =>
    (await pendingJobs(t)).map(({ name, args, scheduledTime }) => ({ name, emails: (args[0] as { emails: string[] }).emails, scheduledTime }));

  test("with the day's used up, none is sent; they wait for the next UTC day and go then by themselves", async () => {
    await goesWithEmailsLeft(0);
    const goneAt = Date.now();

    expect(sent).toEqual([]);
    expect(await sentToday(t)).toBe(EMAILS_PER_DAY);
    expect(await runsToCome()).toEqual([
      { name: getFunctionName(internal.leagues.deletionNotices.send), emails: [CO_COMMISSIONER, ANN, BOB], scheduledTime: startOfNextDay(goneAt) },
    ]);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(Date.now()).toBe(startOfNextDay(goneAt));
    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
    expect(await sentToday(t)).toBe(3);
    expect(await unemailedRows()).toEqual([]);
  });

  test("with one left, it goes today and the rest wait for tomorrow, logged", async () => {
    const logged = vi.spyOn(console, "log");
    await goesWithEmailsLeft(1);

    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER]);
    expect((await runsToCome()).map(({ emails }) => emails)).toEqual([[ANN, BOB]]);
    expect(logged).toHaveBeenCalledWith(waitingLog(2));

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
  });
});

describe("someone the email service refuses", () => {
  test("when the email service refuses it, is kept as not sent, and the failure logged", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    fakeResend(500);
    const logged = silenceConsoleError();
    await goneForGood();

    expect((await unemailedRows()).map(({ email, reason }) => ({ email, reason }))).toEqual([
      { email: CO_COMMISSIONER, reason: "notSent" },
      { email: ANN, reason: "notSent" },
      { email: BOB, reason: "notSent" },
    ]);
    expect(logged).toHaveBeenCalledTimes(3);
    expect(logged).toHaveBeenCalledWith(notEmailedLog(ANN), new Error("Resend refused the email (500): refused"));
  });
});
