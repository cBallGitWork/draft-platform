import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { commissionerRefusals } from "../../../convex/draft/draftCommissioner";
import { pickTimeRefusals } from "../../../convex/draft/draftPickTime";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SECOND_MS } from "../../../convex/shared/time";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, changeRules, HELD_FIRST_RULES, rulesWith } from "../../support/convex/leagueRules.harness";
import { actingAs, addManager, addManagers, adminCreatesLeague, COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The commissioner running the draft (spec/04, The commissioner; #1095): he undoes the last pick,
// again and again, the pick put back on a full clock; he picks for any team on the clock; while
// paused he changes the pick time; and before the start he says "I'll pick for this one" for a
// team with no manager.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const player = (code: number): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code, positions: ["CM"] });
const MIDS = [101, 102, 103, 104, 105, 106].map(player);
const [P1, P2, P3] = MIDS.map(({ code }) => code);
const PICK_SECONDS = 30;
const PICK_MS = PICK_SECONDS * SECOND_MS;
const [ANN, BOB, CAT] = MANAGERS;

const as = (email: string) => actingAs(t, email);
const read = async () => (await as(COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId, now: Date.now() });
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const pause = async () => (await as(COMMISSIONER)).mutation(api.draft.draftPause.pause, { leagueId });
const resume = async () => (await as(COMMISSIONER)).mutation(api.draft.draftPause.resume, { leagueId });
const pick = async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
const pickFor = async (playerCode: number, email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftPicks.pickFor, { leagueId, playerCode });
const undo = async (email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftCommissioner.undoPick, { leagueId });
const setPickTime = async (pickSeconds: number, email = COMMISSIONER) =>
  (await as(email)).mutation(api.draft.draftCommissioner.setPickTime, { leagueId, pickSeconds });
const mark = async (teamId: Id<"teams">, marked = true, email = COMMISSIONER) =>
  (await as(email)).mutation(api.draft.draftCommissioner.markForCommissioner, { leagueId, teamId, marked });
const picked = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ pick, teamId, playerCode }) => ({ pick, teamId, playerCode })));
const squad = (teamId: Id<"teams">) =>
  t.run(async (ctx) => (await ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", teamId)).collect()).map(({ playerCode }) => playerCode));
const timeouts = () => t.run(async (ctx) => (await ctx.db.query("drafts").unique())?.timeouts ?? null);
const isMarked = (teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.get("teams", teamId))?.commissionerPicks === true);
/** The squad holds 11, enough for the rules a League settings save checks. */
const elevenRounds = () =>
  changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 11, maximum: 11 }, minimumByArea: null, maxPerClub: null } }));
const subjects = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).map(({ subject }) => subject));
const leaveTeam = (teamId: Id<"teams">) => t.run((ctx) => ctx.db.patch("teams", teamId, { managerEmail: undefined }));
/** The clock moves on `ms`, and every pick scheduled by then is made. */
async function pass(ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, MIDS);
  });
  await changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: 3 }, minimumByArea: null, maxPerClub: null },
    draft: { ...HELD_FIRST_RULES.draft!, pickSeconds: PICK_SECONDS, timeoutsBeforeAutoPick: 1 },
  }));
});

// Two teams snake: Ann has picks 1, 4 and 5; Bob 2, 3 and 6.
describe("the commissioner's undo", () => {
  test("takes the player off the squad and puts the pick back on a full clock, at once", async () => {
    await start();
    await pick(ANN, P1);
    await pass(3 * SECOND_MS);
    await undo();
    const undoneAt = Date.now();

    expect(await picked()).toEqual([]);
    expect(await squad(teams[0])).toEqual([]);
    expect(await read()).toMatchObject({ picksMade: 0, onTheClock: { pick: 1, teamId: teams[0] }, clock: { startsAt: undoneAt, endsAt: undoneAt + PICK_MS } });
    await pick(ANN, P1);
    expect(await squad(teams[0])).toEqual([P1]);
  });

  test("goes further back each time it is pressed", async () => {
    await start();
    await pick(ANN, P1);
    await pass(PICK_GAP_MS);
    await pick(BOB, P2);
    await undo();
    await undo();

    expect(await picked()).toEqual([]);
    expect(await read()).toMatchObject({ onTheClock: { pick: 1, teamId: teams[0] } });
    expect(await eventsIn(t, leagueId)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "playerReleased", playerCode: P2, by: COMMISSIONER })]));
  });

  test("gives the pick put back the pick time now, the new one if he changed it", async () => {
    await elevenRounds();
    await start();
    await pick(ANN, P1);
    await pause();
    await setPickTime(60);
    await undo();
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ onTheClock: { pick: 1 }, clock: { startsAt: resumedAt, endsAt: resumedAt + 60 * SECOND_MS } });
  });

  test("works while paused, the draft staying paused until he resumes", async () => {
    await start();
    await pick(ANN, P1);
    await pause();
    await undo();
    await pass(PICK_MS * 10);

    expect(await picked()).toEqual([]);
    expect(await read()).toHaveProperty("clock.pausedAt");
    await resume();
    await pass(PICK_MS);
    expect(await picked()).toHaveLength(1);
  });

  test("for a team the draft picks for at once waits the full clock", async () => {
    await leaveTeam(teams[1]);
    await start();
    await pick(ANN, P1);
    await pass(PICK_GAP_MS);
    expect(await picked()).toHaveLength(2);

    await undo();
    await pass(PICK_MS - 1);
    expect(await picked()).toHaveLength(1);
    await pickFor(P3);
    expect(await squad(teams[1])).toEqual([P3]);
  });

  test("of a timed-out pick takes the timeout off, and auto-pick if it put him there", async () => {
    await start();
    await pass(PICK_MS);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1, autoPick: "fullClock" }]);

    await undo();
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 0 }]);
  });

  test("tells the whole league", async () => {
    await start();
    await pick(ANN, P1);
    await undo();

    expect(await subjects()).toContain("Pick 1 was undone");
  });

  test("is refused to anyone who doesn't run the league, with no pick made and once the draft is over", async () => {
    await expect(undo()).rejects.toThrow(commissionerRefusals.notStarted);
    await start();
    await expect(undo()).rejects.toThrow(commissionerRefusals.noPick);
    await pick(ANN, P1);
    await expect(undo(ANN)).rejects.toThrow(refusals.notRunner);
    for (let made = 1; made < 6; made++) await pass(PICK_GAP_MS + PICK_MS);
    expect(await picked()).toHaveLength(6);
    await expect(undo()).rejects.toThrow(commissionerRefusals.over);
  });
});

describe("the commissioner's pick for a team", () => {
  test("makes the pick for a team with a manager, filed as his and no timeout", async () => {
    await start();
    await pickFor(P1);

    expect(await squad(teams[0])).toEqual([P1]);
    expect(await timeouts()).toBeNull();
    expect(await eventsIn(t, leagueId)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "playerAssigned", playerCode: P1, by: COMMISSIONER })]));
    expect(await subjects()).toContain(`Player ${P1} was picked for ${(await read())?.order?.[0]?.name}`);
    expect(await read()).toMatchObject({ onTheClock: { pick: 2, teamId: teams[1] } });
  });

  test("while paused keeps the draft paused, the next clock waiting for the resume", async () => {
    await start();
    await pause();
    await pickFor(P1);
    await pass(PICK_MS * 10);

    expect(await picked()).toHaveLength(1);
    expect(await read()).toMatchObject({ onTheClock: { pick: 2 } });
    expect(await read()).toHaveProperty("clock.pausedAt");
    await resume();
    const resumedAt = Date.now();
    expect(await read()).toMatchObject({ clock: { startsAt: resumedAt + PICK_GAP_MS } });
  });

  test("is refused to anyone who doesn't run the league", async () => {
    await start();
    await expect(pickFor(P1, ANN)).rejects.toThrow(refusals.notRunner);
  });
});

describe("the pick time", () => {
  test("changes only while the draft is paused, reaching it on resume and League settings too", async () => {
    await elevenRounds();
    await start();
    await expect(setPickTime(60)).rejects.toThrow(pickTimeRefusals.notPaused);
    await pause();
    await setPickTime(60);
    await resume();
    const resumedAt = Date.now();

    expect(await read()).toMatchObject({ clock: { startsAt: resumedAt, endsAt: resumedAt + 60 * SECOND_MS } });
    const latest = await (await as(COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId });
    expect(latest?.rules.draft?.pickSeconds).toBe(60);
  });

  test("can't be changed from League settings while the draft runs unpaused", async () => {
    await start();
    const draft = { ...HELD_FIRST_RULES.draft!, pickSeconds: 60 };
    await expect(changeRules(t, leagueId, rulesWith({ draft }))).rejects.toThrow(pickTimeRefusals.running);
  });

  test("is refused outside the league's limits, and to anyone who doesn't run the league", async () => {
    await elevenRounds();
    await start();
    await pause();
    await expect(setPickTime(5)).rejects.toThrow();
    await expect(setPickTime(60, ANN)).rejects.toThrow(refusals.notRunner);
  });
});

describe("I'll pick for this one", () => {
  test("runs the clock for a team with no manager, and when it runs out the draft picks with no timeout", async () => {
    await leaveTeam(teams[1]);
    await mark(teams[1]);
    await start();
    await pick(ANN, P1);
    await pass(PICK_GAP_MS);
    expect(await picked()).toHaveLength(1);

    await pickFor(P2);
    expect(await squad(teams[1])).toEqual([P2]);
    await pass(PICK_GAP_MS + PICK_MS);
    expect(await picked()).toHaveLength(3);
    expect(await timeouts()).toBeNull();
  });

  test("can be taken back before the start, and comes off when a manager joins", async () => {
    await leaveTeam(teams[1]);
    await mark(teams[1]);
    await mark(teams[1], false);
    expect(await isMarked(teams[1])).toBe(false);

    await mark(teams[1]);
    expect(await isMarked(teams[1])).toBe(true);
    await addManager(t, leagueId, CAT, teams[1]);
    expect(await isMarked(teams[1])).toBe(false);
  });

  test("is refused for a team with a manager, once the draft has started, and to anyone who doesn't run the league", async () => {
    await expect(mark(teams[0])).rejects.toThrow(commissionerRefusals.hasManager(""));
    await leaveTeam(teams[1]);
    await expect(mark(teams[1], true, ANN)).rejects.toThrow(refusals.notRunner);
    await start();
    await expect(mark(teams[1])).rejects.toThrow(commissionerRefusals.draftStarted);
  });
});
