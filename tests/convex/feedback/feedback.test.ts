import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { feedbackRefusals } from "../../../convex/feedback/feedback";
import { FEEDBACK_MAX, FEEDBACK_SHOWN } from "../../../convex/feedback/feedbackLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS } from "../../../convex/shared/time";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, type TestConvex } from "../../support/convex/leagues.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Feedback to the admin (#357; spec/12 The frame, spec/15 The admin): anyone signed in sends a
// message, stored with who sent it and when; the admin alone reads the list, newest first.

const [ANN, BOB] = MANAGERS;
const SENT_AT = Date.parse("2026-10-24T20:00:00Z");

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  vi.setSystemTime(SENT_AT);
});

const send = async (email: string, message: string) => (await actingAs(t, email)).mutation(api.feedback.feedback.send, { message });
const list = async (email: string) => (await actingAs(t, email)).query(api.feedback.feedback.list, {});
/** Stores messages numbered `first` to `last` from Ann straight into the table, a minute apart. */
const storeMessages = (first: number, last: number) =>
  t.run(async (ctx) => {
    for (let number = first; number <= last; number++) {
      await ctx.db.insert("feedback", { from: ANN, at: SENT_AT + number * MINUTE_MS, message: `Message ${number}` });
    }
  });
/** Every stored message, as [from, message]. */
const stored = () => t.run(async (ctx) => (await ctx.db.query("feedback").collect()).map((row) => [row.from, row.message]));

describe("sending", () => {
  test("#357 Done: a manager sends, and the admin sees it with who sent it and when", async () => {
    await send(ANN, "The table looks wrong.");
    const { entries, more } = await list(ADMIN);
    expect(entries.map(({ from, at, message }) => ({ from, at, message }))).toEqual([
      { from: ANN, at: SENT_AT, message: "The table looks wrong." },
    ]);
    expect(more).toBe(false);
  });

  test("what's sent is trimmed, and its lines kept", async () => {
    await send(ANN, "  First line.\nSecond line.\n\n ");
    expect(await stored()).toEqual([[ANN, "First line.\nSecond line."]]);
  });

  test("#357 Done: a blank message is refused, and nothing is stored", async () => {
    await expectRefused(send(ANN, ""), feedbackRefusals.blank);
    await expectRefused(send(ANN, " \n\t "), feedbackRefusals.blank);
    expect(await stored()).toEqual([]);
  });

  test(`up to ${FEEDBACK_MAX} characters is sent; one more is refused`, async () => {
    await send(ANN, "a".repeat(FEEDBACK_MAX));
    await expectRefused(send(ANN, "a".repeat(FEEDBACK_MAX + 1)), feedbackRefusals.tooLong);
    expect(await stored()).toHaveLength(1);
  });

  test("the limit counts characters, not UTF-16 units, so an emoji of two units is one", async () => {
    await send(ANN, "🙂".repeat(FEEDBACK_MAX));
    expect(await stored()).toHaveLength(1);
  });

  test("someone signed out can't send", async () => {
    await expectRefused(t.mutation(api.feedback.feedback.send, { message: "Hello" }), refusals.signedOut);
  });

  test("a commissioner, and someone in no league, can send too: the link is on every signed-in frame", async () => {
    await send(COMMISSIONER, "From the commissioner.");
    await send(BOB, "From someone in no league.");
    expect(await stored()).toEqual([
      [COMMISSIONER, "From the commissioner."],
      [BOB, "From someone in no league."],
    ]);
  });
});

describe("the admin's list", () => {
  test("#357 Done: a non-admin can't read it", async () => {
    await send(ANN, "Private to the admin.");
    await expectRefused(list(ANN), refusals.notAdmin);
    await expectRefused(list(COMMISSIONER), refusals.notAdmin);
    await expectRefused(t.query(api.feedback.feedback.list, {}), refusals.signedOut);
  });

  test("newest first", async () => {
    await send(ANN, "First.");
    vi.advanceTimersByTime(MINUTE_MS);
    await send(BOB, "Second.");
    expect((await list(ADMIN)).entries.map((entry) => entry.message)).toEqual(["Second.", "First."]);
  });

  test(`past ${FEEDBACK_SHOWN}, it lists the newest and says more came, never a silent cut`, async () => {
    await storeMessages(0, FEEDBACK_SHOWN);
    const { entries, more } = await list(ADMIN);
    expect(entries).toHaveLength(FEEDBACK_SHOWN);
    expect(entries[0].message).toBe(`Message ${FEEDBACK_SHOWN}`);
    expect(entries.at(-1)?.message).toBe("Message 1");
    expect(more).toBe(true);
  });

  test(`at exactly ${FEEDBACK_SHOWN}, nothing more is said`, async () => {
    await storeMessages(1, FEEDBACK_SHOWN);
    expect((await list(ADMIN)).more).toBe(false);
  });
});
