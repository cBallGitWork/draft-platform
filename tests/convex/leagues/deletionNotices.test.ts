import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ANN, BOB, accountOf, deletes, leagueWithPeople } from "../../support/convex/leagueDeletion.harness";
import { ADMIN, COMMISSIONER, CO_COMMISSIONER, LEAGUE_NAME, actingAs, leagueRow, type TestConvex } from "../../support/convex/leagues.harness";
import { EMAILS_PER_DAY } from "../../../convex/outbound/emailLimit";
import { fakeResend, sentToday, setSentToday, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// The email saying a league will be deleted, and when (#75, spec/13, Deleting).

let t: TestConvex;
let leagueId: Id<"leagues">;
let sent: SentEmail[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await leagueWithPeople(t);
  sent = fakeResend();
});

describe("deleting a league emails", () => {
  test("everyone with a part in it but whoever deleted it, saying it will be deleted, and when", async () => {
    await deletes(t, COMMISSIONER, leagueId);

    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER, ANN, BOB]);
    expect(sent[0].subject).toBe(`${LEAGUE_NAME} will be deleted`);
    // Deleted at 09:00 UTC on 20 Oct 2026: 10:00 in London a day later.
    expect(sent[0].text).toContain(`${COMMISSIONER} deleted ${LEAGUE_NAME}.`);
    expect(sent[0].text).toContain("on Wednesday 21 October at 10:00 BST.");
  });

  test("the commissioner too, when the admin deletes it", async () => {
    await deletes(t, ADMIN, leagueId);
    expect(sent.map((email) => email.to)).toEqual([COMMISSIONER, CO_COMMISSIONER, ANN, BOB]);
  });

  test("each counting against the day's emails", async () => {
    const before = await sentToday(t);
    await deletes(t, COMMISSIONER, leagueId);
    expect(await sentToday(t)).toBe(before + 3);
  });
});

describe("someone who isn't emailed", () => {
  test("past the day's limit, isn't, and whoever deleted it is told who", async () => {
    await setSentToday(t, EMAILS_PER_DAY - 1);
    await deletes(t, COMMISSIONER, leagueId);

    expect(sent.map((email) => email.to)).toEqual([CO_COMMISSIONER]);
    expect(await sentToday(t)).toBe(EMAILS_PER_DAY);
    expect((await accountOf(t, COMMISSIONER)).leagues[0].deletion?.unemailed).toEqual([
      { email: ANN, reason: "paused" },
      { email: BOB, reason: "paused" },
    ]);
  });

  test("when the email service refuses it, is kept as not sent, and the failure logged", async () => {
    fakeResend(500);
    const logged = silenceConsoleError();
    await deletes(t, COMMISSIONER, leagueId);

    expect((await leagueRow(t, leagueId))?.deletion?.unemailed).toEqual([
      { email: CO_COMMISSIONER, reason: "notSent" },
      { email: ANN, reason: "notSent" },
      { email: BOB, reason: "notSent" },
    ]);
    expect(logged).toHaveBeenCalledTimes(3);
    expect(logged).toHaveBeenCalledWith(
      `The email saying a league will be deleted wasn't sent to ${ANN}:`,
      new Error("Resend refused the email (500): refused"),
    );
  });

  test("once the deletion is undone, is no longer kept", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId });
    await t.mutation(internal.leagues.deletionNotices.recordUnemailed, { leagueId, email: ANN, reason: "paused" });
    expect((await leagueRow(t, leagueId))?.deletion).toBeUndefined();
  });
});
