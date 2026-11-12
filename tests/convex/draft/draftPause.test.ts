import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { pauseRefusals } from "../../../convex/draft/draftPause";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SECOND_MS } from "../../../convex/shared/time";
import { draftSteps, FIRST_PICK_MS, midfielder } from "../../support/convex/draft.harness";
import { ARSENAL, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { addManagers, adminCreatesLeague, COMMISSIONER, lettersTo, type TestConvex, ANN, BOB } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Pausing and resuming the draft (spec/04, The commissioner; #1135): a pause keeps the time left,
// the 10 seconds before the next clock freeze too, a paused clock never fires, and a pick time
// changed during the pause restarts the pick on the clock on the full new time when it resumes.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const MIDS = [101, 102, 103, 104].map((code) => midfielder(code));
const [A1] = MIDS.map(({ code }) => code);

const { as, read, start, pause, resume, pick, pass, setPickSeconds, setSquadSize } = draftSteps(() => ({ t, leagueId }));
const pickCount = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).length);

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, MIDS);
  });
  await setSquadSize(2);
});

describe("a pause", () => {
  test("freezes the time left, and the paused clock never fires", async () => {
    const startedAt = Date.now();
    await start();
    await pass(FIRST_PICK_MS - 30 * SECOND_MS);
    const pausedAt = Date.now();
    await pause();
    await pass(FIRST_PICK_MS * 100);

    expect(await pickCount()).toBe(0);
    expect(await read()).toMatchObject({ onTheClock: { pick: 1 }, clock: { startsAt: startedAt, endsAt: startedAt + FIRST_PICK_MS, pausedAt } });
  });

  test("refuses the manager's pick until the draft resumes", async () => {
    await start();
    await pause();

    await expectRefused(pick(ANN, A1), pickRefusals.paused);
    await resume();
    await pick(ANN, A1);
    expect(await pickCount()).toBe(1);
  });

  test("can be made only by someone who runs the league", async () => {
    await start();

    await expectRefused(pause(ANN), refusals.notRunner);
    await pause();
    await expectRefused(resume(ANN), refusals.notRunner);
  });

  test("is refused before the draft starts, twice over, and once it is over", async () => {
    await expectRefused(pause(), pauseRefusals.notStarted);
    await start();
    await expectRefused(resume(), pauseRefusals.notPaused);
    await pause();
    await expectRefused(pause(), pauseRefusals.alreadyPaused);
    await resume();
    for (let made = 0; made < 4; made++) await pass(FIRST_PICK_MS + PICK_GAP_MS);
    await pass(PICK_GAP_MS);
    await expectRefused(pause(), pauseRefusals.over);
  });
});

describe("resuming", () => {
  test("gives the pick on the clock back the time it had left, however long the pause", async () => {
    await start();
    await pass(FIRST_PICK_MS - 30 * SECOND_MS);
    await pause();
    await pass(60 * 60 * SECOND_MS);
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ clock: { endsAt: resumedAt + 30 * SECOND_MS } });
    expect(await read()).not.toHaveProperty("clock.pausedAt");
    await pass(30 * SECOND_MS - 1);
    expect(await pickCount()).toBe(0);
    await pass(1);
    expect(await pickCount()).toBe(1);
  });

  test("can pause and resume again, with no cap", async () => {
    await start();
    for (let pauses = 0; pauses < 5; pauses++) {
      await pass(10 * SECOND_MS);
      await pause();
      await pass(60 * SECOND_MS);
      await resume();
    }

    expect(await read()).toMatchObject({ clock: { endsAt: Date.now() + FIRST_PICK_MS - 50 * SECOND_MS } });
  });

  test("keeps what is left of the 10 seconds before the next clock", async () => {
    await start();
    await pick(ANN, A1);
    await pass(4 * SECOND_MS);
    await pause();
    await pass(60 * SECOND_MS);
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ onTheClock: { pick: 2, teamId: teams[1] }, clock: { startsAt: resumedAt + 6 * SECOND_MS, endsAt: resumedAt + 6 * SECOND_MS + FIRST_PICK_MS } });
  });

  test("restarts the pick on the clock on the full new pick time, if it changed during the pause", async () => {
    await setPickSeconds(90);
    await start();
    await pass(60 * SECOND_MS);
    await pause();
    await setPickSeconds(60);
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ clock: { startsAt: resumedAt, endsAt: resumedAt + 60 * SECOND_MS } });
    await pass(60 * SECOND_MS - 1);
    expect(await pickCount()).toBe(0);
    await pass(1);
    expect(await pickCount()).toBe(1);
  });

  test("on a new pick time still waits out the 10 seconds before the next clock", async () => {
    await start();
    await pick(ANN, A1);
    await pass(4 * SECOND_MS);
    await pause();
    await setPickSeconds(20);
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ clock: { startsAt: resumedAt + 6 * SECOND_MS, endsAt: resumedAt + 6 * SECOND_MS + 20 * SECOND_MS } });
  });

  test("for a team with no manager picks for it once the 10 seconds are up", async () => {
    await t.run((ctx) => ctx.db.patch("teams", teams[1], { managerEmail: undefined }));
    await start();
    await pick(ANN, A1);
    await pause();
    await pass(60 * SECOND_MS);
    expect(await pickCount()).toBe(1);

    await resume();
    await pass(PICK_GAP_MS);
    expect(await pickCount()).toBe(2);
  });
});

// Deleting the league pauses its live draft, and an undo leaves it paused for the commissioner to
// resume (Craig, 11 Nov 2026, on #1486: "Accept all").
describe("when its league is deleted", () => {
  const deleteLeague = async () => (await as(COMMISSIONER)).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId });
  const undo = async () => (await as(COMMISSIONER)).mutation(api.leagues.leagueDeletion.undo, { leagueId });
  const lettersCountTo = async (email: string) => (await lettersTo(t, email)).length;

  test("the draft pauses, keeps its time left, picks nothing and tells no manager", async () => {
    const startedAt = Date.now();
    await start();
    await pass(FIRST_PICK_MS - 30 * SECOND_MS);
    const [annLetters, bobLetters] = [await lettersCountTo(ANN), await lettersCountTo(BOB)];
    await deleteLeague();
    await pass(FIRST_PICK_MS * 100);

    expect(await pickCount()).toBe(0);
    await undo();
    expect(await read()).toMatchObject({ onTheClock: { pick: 1 }, clock: { startsAt: startedAt, endsAt: startedAt + FIRST_PICK_MS } });
    expect(await read()).toHaveProperty("clock.pausedAt");
    expect([await lettersCountTo(ANN), await lettersCountTo(BOB)]).toEqual([annLetters, bobLetters]);
  });

  test("an undo leaves it paused until the commissioner resumes, on the time it had left", async () => {
    await start();
    await pass(FIRST_PICK_MS - 30 * SECOND_MS);
    await deleteLeague();
    await undo();
    await pass(FIRST_PICK_MS * 10);
    expect(await pickCount()).toBe(0);

    await resume();
    await pass(30 * SECOND_MS);
    expect(await pickCount()).toBe(1);
  });

  test("a draft already paused stays paused as it was", async () => {
    await start();
    await pause();
    const before = await read();
    await deleteLeague();
    await undo();

    expect(await read()).toEqual(before);
  });

  test("a draft not yet started, or over, is left alone", async () => {
    await deleteLeague();
    await undo();
    await start();
    for (let made = 0; made < 4; made++) await pass(FIRST_PICK_MS + PICK_GAP_MS);
    await pass(PICK_GAP_MS);
    await deleteLeague();
    await undo();

    expect(await pickCount()).toBe(4);
    expect(await read()).not.toHaveProperty("clock.pausedAt");
  });
});
