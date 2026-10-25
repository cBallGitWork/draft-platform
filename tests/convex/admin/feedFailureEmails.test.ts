import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FAILURE_EMAIL_GAP_MS, emailsNow } from "../../../convex/admin/feedFailureEmails";
import { EMAILS_PER_DAY } from "../../../convex/outbound/emailLimit";
import { FEED_NAMES, FEEDS, type Feed } from "../../../convex/shared/feedSchedule";
import { PRODUCT_NAME } from "../../../convex/shared/product";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { ADMIN, fakeResend, sentToday, setSentToday, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { silenceConsoleError, type TestConvex } from "../../support/convex/test.harness";

// The email the admin gets when a feed or sync fails, at most once a day for each feed (#319,
// spec/15). Each run is recorded through its feed's own mutation, as the syncs and the tick do.

const ERROR = "https://fantasy.premierleague.com/api/bootstrap-static/ answered 503";
const MATCH_ERROR = "match 1 has no team sheet";

/** The subject of the email saying `feed` failed. */
const subjectOf = (feed: Feed) => `${PRODUCT_NAME}: ${FEED_NAMES[feed].name} failed`;

let t: TestConvex;
let sent: SentEmail[];
let now: number;
beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  now = Date.now();
});

/** A live-stats tick at `ranAt`: a success, failed whole, or with one failed match. */
async function tick(ranAt: number, ran: "ok" | "failed" | "matchFailed" = "failed") {
  const outcome =
    ran === "failed"
      ? { ok: false as const, error: ERROR }
      : { ok: true as const, matches: ran === "ok" ? [] : [{ fixtureCode: 1, ok: false as const, error: MATCH_ERROR }] };
  await t.mutation(internal.stats.liveStats.recordTick, { ranAt, outcome });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** A football sync at `ranAt` that failed. */
async function footballFails(ranAt: number) {
  await t.mutation(internal.football.footballSync.record, { trigger: "cron", ranAt, outcome: { ok: false, error: ERROR } });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("a feed that fails", () => {
  test("emails the admin which feed, when, and why, counting against the day's emails", async () => {
    await tick(now);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(ADMIN);
    expect(sent[0].subject).toBe(subjectOf("liveStats"));
    // 09:00 UTC on 20 Oct 2026 is 10:00 in London.
    expect(sent[0].text).toContain(`${FEED_NAMES.liveStats.name}, from ${FEED_NAMES.liveStats.source}, failed in the run on Tuesday 20 October at 10:00 BST:`);
    expect(sent[0].text).toContain(ERROR);
    expect(await sentToday(t)).toBe(1);
  });

  test("with one failed match emails too, as the feeds page counts it failing", async () => {
    await tick(now, "matchFailed");
    expect(sent.map((email) => email.text.includes(MATCH_ERROR))).toEqual([true]);
  });

  test("emails from every feed's own record of its run", async () => {
    const failed = { ok: false as const, error: ERROR };
    await t.mutation(internal.football.footballSync.record, { trigger: "manual", ranAt: now, outcome: failed });
    await t.mutation(internal.positions.positionsSync.record, { trigger: "manual", ranAt: now, outcome: failed });
    await t.mutation(internal.stats.matchStats.record, { trigger: "manual", ranAt: now, outcome: failed });
    await t.mutation(internal.stats.liveStats.recordTick, { ranAt: now, outcome: failed });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent.map((email) => email.subject)).toEqual(FEEDS.map(subjectOf));
  });

  test("emails nothing when the run succeeds", async () => {
    await tick(now, "ok");
    expect(sent).toEqual([]);
    expect(await sentToday(t)).toBe(0);
  });
});

describe("at most once a day for each feed", () => {
  test("a second failure the same day emails nothing", async () => {
    await tick(now);
    await tick(now + HOUR_MS);
    await tick(now + DAY_MS - 1);
    expect(sent).toHaveLength(1);
  });

  test("a failure the next day emails again", async () => {
    await tick(now);
    await tick(now + DAY_MS);
    expect(sent).toHaveLength(2);
  });

  test("each feed counts on its own", async () => {
    await tick(now);
    await footballFails(now + HOUR_MS);
    await footballFails(now + 2 * HOUR_MS);
    expect(sent.map((email) => email.subject)).toEqual([subjectOf("liveStats"), subjectOf("football")]);
  });

  test("a day is the gap since the last email, to the millisecond", () => {
    expect(emailsNow(null, now)).toBe(true);
    expect(emailsNow(now, now + FAILURE_EMAIL_GAP_MS - 1)).toBe(false);
    expect(emailsNow(now, now + FAILURE_EMAIL_GAP_MS)).toBe(true);
  });
});

describe("a failure that can't be emailed", () => {
  test("once the day's emails are gone, isn't sent, is logged, and the next failure tries again", async () => {
    await setSentToday(t, EMAILS_PER_DAY);
    const logged = silenceConsoleError();
    await tick(now);

    expect(sent).toEqual([]);
    expect(await sentToday(t)).toBe(EMAILS_PER_DAY);
    expect(logged).toHaveBeenCalledWith(`liveStats failed, but the day's emails are all gone, so the admin wasn't emailed: ${ERROR}`);

    await setSentToday(t, 0);
    await tick(now + HOUR_MS);
    expect(sent).toHaveLength(1);
  });

  test("when the email service refuses it, is logged, and still counts as the day's email for that feed", async () => {
    fakeResend(500);
    const logged = silenceConsoleError();
    await tick(now);
    expect(logged).toHaveBeenCalledWith("The email saying liveStats failed wasn't sent to the admin:", new Error("Resend refused the email (500): refused"));

    sent = fakeResend();
    await tick(now + HOUR_MS);
    expect(sent).toEqual([]);
  });
});
