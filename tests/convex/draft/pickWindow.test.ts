import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import { DRAFT_OVER_SUBJECT as OVER, UP_NEXT_SUBJECT as UP_NEXT } from "../../../convex/mail/draftLetterWords";
import { SECOND_MS } from "../../../convex/shared/time";
import { draftSteps, FIRST_PICK_MS, midfielder } from "../../support/convex/draft.harness";
import { ARSENAL, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { addManagers, adminCreatesLeague, COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The 10 seconds after a pick (spec/04, The draft room; #1458): a manager can undo his own pick in
// them, getting back the time his clock had left, telling no one, and a pause freezes them (Craig,
// 4 and 11 Nov 2026). Nobody picks until they are up, the next manager hears he is up next only
// then, and the draft ends only after its last pick's 10 seconds, so its last pick can be undone.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const MIDS = [101, 102, 103, 104, 105].map((code) => midfielder(code));
const [A1, A2, A3, A4, A5] = MIDS.map(({ code }) => code);
const [ANN, BOB] = MANAGERS;

const { as, read, start, pick, pause, resume, pass, setSquadSize } = draftSteps(() => ({ t, leagueId }));
const undo = async (email: string) => (await as(email)).mutation(api.draft.pickWindow.undoMyPick, { leagueId });
const commissionerUndo = async () => (await as(COMMISSIONER)).mutation(api.draft.draftCommissioner.undoPick, { leagueId });
const pickFor = async (teamId: Id<"teams">, playerCode: number) => (await as(COMMISSIONER)).mutation(api.draft.draftPicks.pickFor, { leagueId, teamId, playerCode });
const picked = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ playerCode }) => playerCode));
const squadOf = (teamId: Id<"teams">) =>
  t.run(async (ctx) => (await ctx.db.query("squadPlayers").collect()).filter((row) => row.teamId === teamId).map(({ playerCode }) => playerCode));
const subjectsSince = async (before: number) => (await t.run((ctx) => ctx.db.query("letters").collect())).slice(before).map(({ to, subject }) => ({ to, subject }));
const letterCount = async () => (await t.run((ctx) => ctx.db.query("letters").collect())).length;

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, MIDS);
  });
  // Two rounds: Ann has picks 1 and 4, Bob 2 and 3.
  await setSquadSize(2);
});

describe("a manager's undo of his own pick", () => {
  test("frees the player and puts his pick back on the clock at once, with the time it had left", async () => {
    await start();
    await pass(FIRST_PICK_MS / 4);
    await pick(ANN, A1);
    await pass(PICK_GAP_MS - 1);
    await undo(ANN);
    const now = Date.now();

    expect(await picked()).toEqual([]);
    expect(await squadOf(teams[0])).toEqual([]);
    expect(await read()).toMatchObject({ onTheClock: { pick: 1, teamId: teams[0] }, clock: { startsAt: now, endsAt: now + (FIRST_PICK_MS * 3) / 4 } });
    expect((await eventsIn(t, leagueId)).filter(({ kind }) => kind === "playerReleased")).toMatchObject([{ by: ANN, playerCode: A1, teamId: teams[0] }]);
    // He picks again, and the draft runs on.
    await pick(ANN, A2);
    expect(await picked()).toEqual([A2]);
  });

  test("tells no one, and the next manager hears he is up next only once the 10 seconds are up", async () => {
    await start();
    const before = await letterCount();
    await pick(ANN, A1);
    await undo(ANN);
    expect(await subjectsSince(before)).toEqual([]);

    await pick(ANN, A1);
    await pass(PICK_GAP_MS - 1);
    expect(await subjectsSince(before)).toEqual([]);
    await pass(1);
    expect(await subjectsSince(before)).toEqual([{ to: BOB, subject: UP_NEXT }]);
  });

  test("is offered on the draft room to the team whose manager made the last pick himself, and to no one after the draft's pick", async () => {
    await start();
    expect(await read()).toMatchObject({ status: "live", ownPickBy: null });
    await pick(ANN, A1);
    expect(await read()).toMatchObject({ status: "live", ownPickBy: teams[0], clock: { startsAt: Date.now() + PICK_GAP_MS } });
    // Bob's clock runs out, and the draft picks for him.
    await pass(PICK_GAP_MS + FIRST_PICK_MS);
    expect(await read()).toMatchObject({ status: "live", picksMade: 2, ownPickBy: null });
  });

  test("is refused before the start, once the 10 seconds are up, and for a pick he didn't make himself", async () => {
    await expectRefused(undo(ANN), pickRefusals.notStarted);
    await start();
    await expectRefused(undo(ANN), pickRefusals.noOwnPick);
    await pick(ANN, A1);
    await expectRefused(undo(BOB), pickRefusals.noOwnPick);
    await pass(PICK_GAP_MS);
    await expectRefused(undo(ANN), pickRefusals.undoOver);

    // Bob's clock runs out: the draft's pick is no undo of his.
    await pass(FIRST_PICK_MS);
    expect(await picked()).toHaveLength(2);
    await expectRefused(undo(BOB), pickRefusals.noOwnPick);
    // Nor is the commissioner's pick for him.
    await pass(PICK_GAP_MS);
    await pickFor(teams[1], A4);
    await expectRefused(undo(BOB), pickRefusals.noOwnPick);
  });
});

describe("while a pick can be undone", () => {
  test("nobody picks: the next manager and the commissioner wait out the 10 seconds", async () => {
    await start();
    await pick(ANN, A1);
    await expectRefused(pick(BOB, A2), pickRefusals.undoing);
    await expectRefused(pickFor(teams[1], A2), pickRefusals.undoing);

    await pass(PICK_GAP_MS);
    await pick(BOB, A2);
    expect(await picked()).toEqual([A1, A2]);
  });

  test("a pause freezes the 10 seconds, and his undo while paused leaves the draft paused, his clock on the time it had left from the resume", async () => {
    await start();
    await pass(FIRST_PICK_MS / 2);
    await pick(ANN, A1);
    await pass(5 * SECOND_MS);
    await pause();
    await pass(FIRST_PICK_MS * 10);
    // The pause stopped the 10 seconds 5 into them: nothing ran out or was told.
    expect(await picked()).toEqual([A1]);

    await undo(ANN);
    expect(await read()).toMatchObject({ onTheClock: { pick: 1, teamId: teams[0] }, clock: { pausedAt: Date.now() } });
    await pass(FIRST_PICK_MS);
    expect(await picked()).toEqual([]);

    await resume();
    const now = Date.now();
    expect(await read()).toMatchObject({ onTheClock: { pick: 1 }, clock: { startsAt: now, endsAt: now + FIRST_PICK_MS / 2 } });
  });

  test("his 10 seconds left at the pause run on from the resume, then the next clock starts", async () => {
    await start();
    await pick(ANN, A1);
    await pass(4 * SECOND_MS);
    await pause();
    await pass(FIRST_PICK_MS);
    await resume();

    await pass(PICK_GAP_MS - 4 * SECOND_MS - 1);
    await undo(ANN);
    expect(await picked()).toEqual([]);
    await pick(ANN, A1);
    await pass(PICK_GAP_MS);
    await expectRefused(undo(ANN), pickRefusals.undoOver);
  });
});

describe("the last pick", () => {
  /** Ann, Bob and Bob make the first three picks, each waiting out its 10 seconds. */
  const firstThree = async () => {
    await start();
    for (const [email, code] of [[ANN, A1], [BOB, A2], [BOB, A3]] as const) {
      await pick(email, code);
      await pass(PICK_GAP_MS);
    }
  };

  test("keeps the draft open for its 10 seconds, so its manager can undo it, and only then ends it", async () => {
    await firstThree();
    const before = await letterCount();
    await pick(ANN, A4);
    await pass(PICK_GAP_MS - 1);
    expect(await subjectsSince(before)).toEqual([]);

    await undo(ANN);
    expect(await read()).toMatchObject({ status: "live", picksMade: 3, onTheClock: { pick: 4, teamId: teams[0] } });
    await pick(ANN, A5);
    await pass(PICK_GAP_MS - 1);
    expect(await read()).not.toMatchObject({ status: "over" });
    await pass(1);

    expect(await read()).toMatchObject({ status: "over", picksMade: 4 });
    expect((await subjectsSince(before)).filter(({ subject }) => subject === OVER)).toHaveLength(3);
    expect(await squadOf(teams[0])).toEqual([A1, A5]);
  });

  test("can be undone by the commissioner in its 10 seconds, an auto-pick too, but not once the draft has ended", async () => {
    await firstThree();
    await pass(FIRST_PICK_MS);
    expect(await picked()).toHaveLength(4);

    await commissionerUndo();
    expect(await read()).toMatchObject({ status: "live", picksMade: 3, onTheClock: { pick: 4, teamId: teams[0] } });
    await pick(ANN, A4);
    await pass(PICK_GAP_MS);
    await expect(commissionerUndo()).rejects.toThrow("The draft is over.");
  });

  test("reads as ending in its 10 seconds, offering its manager's undo to his team", async () => {
    await firstThree();
    await pick(ANN, A4);
    expect(await read()).toMatchObject({ status: "ending", ownPickBy: teams[0], endsAt: Date.now() + PICK_GAP_MS });
  });

  test("refuses another pick in its 10 seconds, as every pick is made", async () => {
    await firstThree();
    await pick(ANN, A4);
    await expectRefused(pickFor(teams[0], A5), pickRefusals.allPicked);
  });
});
