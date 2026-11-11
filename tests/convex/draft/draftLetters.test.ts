import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { UP_NEXT_EMAIL_OVER_MS } from "../../../convex/draft/draftLetters";
import { draftOf } from "../../../convex/draft/draftRow";
import { draftStartRefusals } from "../../../convex/draft/draftStart";
import { dayOf, EMAILS_PER_DAY } from "../../../convex/outbound/emailLimit";
import { momentIn } from "../../../convex/shared/moments";
import { letterAsRead } from "../../../convex/mail/letterMoments";
import { DAY_MS, SECOND_MS } from "../../../convex/shared/time";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES, holdGameweeks, setPickSeconds as setPickSecondsOf } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment, type SentEmail } from "../../support/convex/signIn.harness";
import { clockRunsTo } from "../../support/convex/test.harness";

// The draft's letters (spec/04, Mail; #1102), Craig's "Up next + draft over" (4 Nov 2026): the
// manager whose pick's clock starts is told he is up next, by email too when the clock is over 10
// minutes (spec/11); the whole league gets a letter when the draft ends and when the commissioner
// pauses it, none when he resumes; and the commissioner gets one when a start date can't start it.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
let sent: SentEmail[];

const player = (code: number): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code, positions: ["CM"] });
const MIDS = [101, 102, 103, 104].map(player);
const [A1, A2, A3, A4] = MIDS.map(({ code }) => code);
const PICK_MS = HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS;
const [ANN, BOB] = MANAGERS;
const UP_NEXT = "You're up next in the draft";

const as = (email: string) => actingAs(t, email);
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const pick = async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
const pause = async () => (await as(COMMISSIONER)).mutation(api.draft.draftPause.pause, { leagueId });
const resume = async () => (await as(COMMISSIONER)).mutation(api.draft.draftPause.resume, { leagueId });
const letters = () =>
  t.run(async (ctx) =>
    (await ctx.db.query("letters").collect()).map((row) => ({ to: row.to, ...letterAsRead(row, undefined), read: row.readAt !== undefined })),
  );
/** The letters filed since `before` of them were. */
const lettersSince = async (before: number) => (await letters()).slice(before);
/** The up-next emails sent, leaving out the harness's sign-in links. */
const upNextEmails = () => sent.filter(({ subject }) => subject === UP_NEXT);
/** The clock moves on `ms`, and every job scheduled by then runs. */
const pass = (ms: number) => clockRunsTo(t, Date.now() + ms);

beforeEach(async () => {
  t = await signInDeployment();
  sent = fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, MIDS);
  });
  await changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null } }));
});

describe("you're up next", () => {
  test("goes to the first pick's manager as the draft starts, unread, with his deadline", async () => {
    const before = (await letters()).length;
    const now = Date.now();
    await start();

    expect(await lettersSince(before)).toEqual([
      {
        to: ANN,
        subject: UP_NEXT,
        body: `Team 1 is on the clock: round 1, pick 1. Make your pick by ${momentIn(now + PICK_MS, undefined)}, or the draft picks for you.`,
        read: false,
      },
    ]);
  });

  test("goes only to the next pick's manager after a pick, its deadline after the 10 seconds' wait", async () => {
    await start();
    const before = (await letters()).length;
    await pick(ANN, A1);
    const at = Date.now();
    // Only once his 10 seconds to undo it are up (Craig, 11 Nov 2026, on #1458).
    await pass(PICK_GAP_MS - 1);
    expect(await lettersSince(before)).toEqual([]);
    await pass(1);

    expect(await lettersSince(before)).toEqual([
      {
        to: BOB,
        subject: UP_NEXT,
        body: `Team 2 is on the clock: round 1, pick 2. Make your pick by ${momentIn(at + PICK_GAP_MS + PICK_MS, undefined)}, or the draft picks for you.`,
        read: false,
      },
    ]);
  });

  test("goes after a pick the draft made when the clock ran out too", async () => {
    await start();
    const before = (await letters()).length;
    await pass(PICK_MS);

    expect((await lettersSince(before)).map(({ to, subject }) => ({ to, subject }))).toEqual([{ to: BOB, subject: UP_NEXT }]);
  });

  test("goes to no one for a team with no manager", async () => {
    await t.run((ctx) => ctx.db.patch("teams", teams[0], { managerEmail: undefined }));
    const before = (await letters()).length;
    await start();

    expect(await lettersSince(before)).toEqual([]);
  });

  // Craig, 11 Nov 2026, on #1485: when the draft picks for him at once there is nothing for him to do.
  test("goes to no one, by letter or email, whose manager chose auto-pick, as his pick is made at once", async () => {
    await setPickSecondsOf(t, leagueId, UP_NEXT_EMAIL_OVER_MS / SECOND_MS + 1);
    await (await as(ANN)).mutation(api.draft.autoPickSwitch.turnOn, { leagueId });
    await start();
    await pass(0);

    expect((await letters()).filter(({ to, subject }) => to === ANN && subject === UP_NEXT)).toEqual([]);
    expect(upNextEmails().filter(({ to }) => to === ANN)).toEqual([]);
  });

  test("goes to no one whose team is on auto-pick past its first pick there", async () => {
    await start();
    await t.run(async (ctx) => {
      const draft = await draftOf(ctx, leagueId);
      await ctx.db.patch("drafts", draft!._id, { timeouts: [{ teamId: teams[1], count: 2, autoPick: "atOnce" }] });
    });
    const before = (await letters()).length;
    await pick(ANN, A1);

    expect(await lettersSince(before)).toEqual([]);
  });
});

describe("the email", () => {
  test("isn't sent for a clock of 10 minutes or less", async () => {
    await setPickSecondsOf(t, leagueId, UP_NEXT_EMAIL_OVER_MS / SECOND_MS);
    await start();
    await pass(0);

    expect(upNextEmails()).toEqual([]);
  });

  test("goes with the letter's words for a clock over 10 minutes", async () => {
    const pickSeconds = UP_NEXT_EMAIL_OVER_MS / SECOND_MS + 1;
    await setPickSecondsOf(t, leagueId, pickSeconds);
    const now = Date.now();
    await start();
    await pass(0);

    expect(upNextEmails()).toMatchObject([
      {
        to: ANN,
        subject: UP_NEXT,
        text: `Team 1 is on the clock: round 1, pick 1. Make your pick by ${momentIn(now + pickSeconds * SECOND_MS, undefined)}, or the draft picks for you.`,
      },
    ]);
  });

  test("isn't sent once the day's emails are gone, and is logged; the letter still goes", async () => {
    await setPickSecondsOf(t, leagueId, UP_NEXT_EMAIL_OVER_MS / SECOND_MS + 1);
    await as(COMMISSIONER);
    await t.run(async (ctx) => {
      const today = await ctx.db.query("emailSends").withIndex("by_day", (q) => q.eq("day", dayOf(Date.now()))).unique();
      if (today === null) await ctx.db.insert("emailSends", { day: dayOf(Date.now()), count: EMAILS_PER_DAY });
      else await ctx.db.patch("emailSends", today._id, { count: EMAILS_PER_DAY });
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await start();
    await pass(0);

    expect(upNextEmails()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${ANN} wasn't emailed that they're up next`));
    expect((await letters()).filter(({ subject }) => subject === UP_NEXT)).toHaveLength(1);
  });
});

describe("the draft over", () => {
  test("files one letter to everyone in the league after the last pick, and no up-next", async () => {
    await start();
    await pick(ANN, A1);
    await pass(PICK_GAP_MS);
    await pick(BOB, A2);
    await pass(PICK_GAP_MS);
    await pick(BOB, A3);
    await pass(PICK_GAP_MS);
    const before = (await letters()).length;
    await pick(ANN, A4);
    await pass(PICK_GAP_MS);

    const over ={ subject: "The draft is over", body: "All 4 picks are made, and every squad is drafted.", read: false };
    expect(await lettersSince(before)).toEqual([COMMISSIONER, ANN, BOB].map((to) => ({ to, ...over })));
  });

  test("ending after the deadline of the gameweek scoring was to start in tells the commissioner it starts in the next (#1097)", async () => {
    // Gameweek 1 has begun and gameweek 2 hasn't.
    await holdGameweeks(t, { next: 2, kicksOffIn: DAY_MS });
    await t.run((ctx) => ctx.db.patch("leagues", leagueId, { scoringStart: 1 }));
    await start();
    for (const [manager, code] of [[ANN, A1], [BOB, A2], [BOB, A3]] as const) {
      await pick(manager, code);
      await pass(PICK_GAP_MS);
    }
    const before = (await letters()).length;
    await pick(ANN, A4);
    await pass(PICK_GAP_MS);

    expect((await lettersSince(before)).filter(({ to }) => to === COMMISSIONER).map(({ subject, body }) => ({ subject, body }))).toEqual([
      { subject: "The draft is over", body: "All 4 picks are made, and every squad is drafted." },
      {
        subject: "Scoring starts in gameweek 2",
        body: "The draft ended after gameweek 1's deadline, so scoring starts in gameweek 2, not 1. Squads and lineups count from gameweek 2's deadline.",
      },
    ]);
  });
});

describe("a pause", () => {
  test("files a letter to everyone in the league, the commissioner's read; a resume files none", async () => {
    await start();
    const before = (await letters()).length;
    await pause();

    const paused = { subject: "The draft is paused", body: `${COMMISSIONER} paused the draft. No pick is made until it resumes.` };
    expect(await lettersSince(before)).toEqual([
      { to: COMMISSIONER, ...paused, read: true },
      { to: ANN, ...paused, read: false },
      { to: BOB, ...paused, read: false },
    ]);

    const afterPause = (await letters()).length;
    await resume();
    expect(await lettersSince(afterPause)).toEqual([]);
  });
});

describe("a start date the draft can't start on", () => {
  test("files the commissioner a letter saying why, and no one else", async () => {
    const startsAt = Date.now() + DAY_MS;
    await (await as(COMMISSIONER)).mutation(api.draft.draftStart.setStart, { leagueId, startsAt });
    await changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { ...rules.squad, size: null } }));
    const before = (await letters()).length;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await pass(DAY_MS);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`draft didn't start at its date, and waits for its commissioner: ${draftStartRefusals.noSquadSize}`));
    expect(await lettersSince(before)).toEqual([
      {
        to: COMMISSIONER,
        subject: "The draft didn't start",
        body: `The draft was set to start on ${momentIn(startsAt, undefined)}, but couldn't. ${draftStartRefusals.noSquadSize} It waits for you to press start or set a new date.`,
        read: false,
      },
    ]);
  });
});
