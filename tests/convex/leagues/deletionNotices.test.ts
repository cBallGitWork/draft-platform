import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ANN, BOB, deletes, laterBy, leagueWithPeople } from "../../support/convex/leagueDeletion.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, LEAGUE_NAME, actingAs, type TestConvex } from "../../support/convex/leagues.harness";
import { EMAILS_PER_DAY } from "../../../convex/outbound/emailLimit";
import { fakeResend, sentToday, setSentToday, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

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
async function onTheDayItGoes() {
  const deletesAt = await deletes(t, COMMISSIONER, leagueId);
  await laterBy(t, deletesAt - 1 - Date.now());
}

/** Each row kept for someone who wasn't told, without when it was kept. */
const unemailedRows = () =>
  t.run(async (ctx) => (await ctx.db.query("unemailedDeletions").collect()).map(({ leagueName, by, email, reason }) => ({ leagueName, by, email, reason })));

describe("while a deletion can be undone", () => {
  test("deleting a league emails nobody, up to the moment before it goes", async () => {
    const deletesAt = await deletes(t, COMMISSIONER, leagueId);
    await laterBy(t, deletesAt - 1 - Date.now());
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
    await t.run(async (ctx) => {
      for (let i = 0; i < 1200; i += 1) {
        await ctx.db.insert("leagueEvents", { leagueId, at: i, by: ADMIN, event: { kind: "maxTeamsChanged", from: 4, to: 5 } });
      }
    });
    await deletes(t, COMMISSIONER, leagueId);
    await goneForGood();
    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
  });

  test("each counting against the day's emails: the day it goes", async () => {
    await onTheDayItGoes();
    const before = await sentToday(t);
    await goneForGood();
    expect(await sentToday(t)).toBe(before + 3);
  });
});

describe("someone who isn't emailed", () => {
  test("past the day's limit, isn't, and is kept by name with the league's, and logged", async () => {
    await onTheDayItGoes();
    await setSentToday(t, EMAILS_PER_DAY - 1);
    const logged = silenceConsoleError();
    await goneForGood();

    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER]);
    expect(await sentToday(t)).toBe(EMAILS_PER_DAY);
    expect(await unemailedRows()).toEqual([
      { leagueName: LEAGUE_NAME, by: COMMISSIONER, email: ANN, reason: "paused" },
      { leagueName: LEAGUE_NAME, by: COMMISSIONER, email: BOB, reason: "paused" },
    ]);
    expect(logged).toHaveBeenCalledWith(
      `The email saying a league has been deleted wasn't sent to ${ANN}:`,
      "today's emails have all been sent",
    );
  });

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
    expect(logged).toHaveBeenCalledWith(
      `The email saying a league has been deleted wasn't sent to ${ANN}:`,
      new Error("Resend refused the email (500): refused"),
    );
  });
});
