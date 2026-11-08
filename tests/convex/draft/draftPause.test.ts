import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { pauseRefusals } from "../../../convex/draft/draftPause";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SECOND_MS } from "../../../convex/shared/time";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES, setPickSeconds as setPickSecondsOf } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { elapse } from "../../support/convex/test.harness";

// Pausing and resuming the draft (spec/04, The commissioner; #1135): a pause keeps the time left,
// the 10 seconds before the next clock freeze too, a paused clock never fires, and a pick time
// changed during the pause restarts the pick on the clock on the full new time when it resumes.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const player = (code: number): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code, positions: ["CM"] });
const MIDS = [101, 102, 103, 104].map(player);
const [A1] = MIDS.map(({ code }) => code);
const PICK_MS = HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS;
const [ANN, BOB] = MANAGERS;

const setPickSeconds = (pickSeconds: number) => setPickSecondsOf(t, leagueId, pickSeconds);

const as = (email: string) => actingAs(t, email);
const read = async () => (await as(COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId, now: Date.now() });
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const pause = async (email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftPause.pause, { leagueId });
const resume = async (email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftPause.resume, { leagueId });
const pick = async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
const pickCount = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).length);
/** The clock moves on `ms`, and every pick scheduled by then is made. */
const pass = (ms: number) => elapse(t, ms);

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, MIDS);
  });
  await changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null } }));
});

describe("a pause", () => {
  test("freezes the time left, and the paused clock never fires", async () => {
    const startedAt = Date.now();
    await start();
    await pass(PICK_MS - 30 * SECOND_MS);
    const pausedAt = Date.now();
    await pause();
    await pass(PICK_MS * 100);

    expect(await pickCount()).toBe(0);
    expect(await read()).toMatchObject({ onTheClock: { pick: 1 }, clock: { startsAt: startedAt, endsAt: startedAt + PICK_MS, pausedAt } });
  });

  test("refuses the manager's pick until the draft resumes", async () => {
    await start();
    await pause();

    await expect(pick(ANN, A1)).rejects.toThrow(pickRefusals.paused);
    await resume();
    await pick(ANN, A1);
    expect(await pickCount()).toBe(1);
  });

  test("can be made only by someone who runs the league", async () => {
    await start();

    await expect(pause(ANN)).rejects.toThrow(refusals.notRunner);
    await pause();
    await expect(resume(ANN)).rejects.toThrow(refusals.notRunner);
  });

  test("is refused before the draft starts, twice over, and once it is over", async () => {
    await expect(pause()).rejects.toThrow(pauseRefusals.notStarted);
    await start();
    await expect(resume()).rejects.toThrow(pauseRefusals.notPaused);
    await pause();
    await expect(pause()).rejects.toThrow(pauseRefusals.alreadyPaused);
    await resume();
    for (let made = 0; made < 4; made++) await pass(PICK_MS + PICK_GAP_MS);
    await expect(pause()).rejects.toThrow(pauseRefusals.over);
  });
});

describe("resuming", () => {
  test("gives the pick on the clock back the time it had left, however long the pause", async () => {
    await start();
    await pass(PICK_MS - 30 * SECOND_MS);
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

    expect(await read()).toMatchObject({ clock: { endsAt: Date.now() + PICK_MS - 50 * SECOND_MS } });
  });

  test("keeps what is left of the 10 seconds before the next clock", async () => {
    await start();
    await pick(ANN, A1);
    await pass(4 * SECOND_MS);
    await pause();
    await pass(60 * SECOND_MS);
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ onTheClock: { pick: 2, teamId: teams[1] }, clock: { startsAt: resumedAt + 6 * SECOND_MS, endsAt: resumedAt + 6 * SECOND_MS + PICK_MS } });
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
