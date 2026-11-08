import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { SECOND_MS } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES, setPickSeconds as setPickSecondsOf } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The pick clock (spec/04, The picks; #1091): each pick runs on the league's pick time, the first
// from the start and each after 10 seconds from the pick before; when a clock runs out the draft
// picks for the team (with nothing listed or ranked, newcomers A to Z: autoPick.test.ts), and a team with no manager is
// picked for at once. No pick files a Mail letter.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const player = (code: number, club = ARSENAL): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: club.code, positions: ["CM"] });
const ARSENAL_MIDS = [101, 102, 103, 104].map((code) => player(code));
const CHELSEA_MIDS = [201, 202].map((code) => player(code, CHELSEA));
const [A1, A2] =ARSENAL_MIDS.map(({ code }) => code);
const [C1] = CHELSEA_MIDS.map(({ code }) => code);
const PICK_MS = HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS;
const [ANN, BOB] = MANAGERS;

const setSquadRules = (squad: Partial<LeagueRules["squad"]>) =>
  changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null, ...squad } }));
const setPickSeconds = (pickSeconds: number) => setPickSecondsOf(t, leagueId, pickSeconds);

const as = (email: string) => actingAs(t, email);
const read = async () => (await as(COMMISSIONER)).query(api.draft.draftStart.ofLeague, { leagueId, now: Date.now() });
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const pick = async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });
const picks = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ pick, teamId, playerCode, at }) => ({ pick, teamId, playerCode, at })));
const letterCount = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).length);
const newLetterSubjects = (after: number) => t.run(async (ctx) => (await ctx.db.query("letters").collect()).slice(after).map(({ subject }) => subject));
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
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [...ARSENAL_MIDS, ...CHELSEA_MIDS]);
  });
  await setSquadRules({});
});

describe("the clock", () => {
  test("starts with the draft and runs for the league's pick time", async () => {
    await setPickSeconds(30);
    const now = Date.now();
    await start();

    expect(await read()).toMatchObject({ onTheClock: { pick: 1, teamId: teams[0] }, clock: { startsAt: now, endsAt: now + 30 * SECOND_MS } });
  });

  test("runs out, and the draft picks the first legal player for the team, filed as its manager's", async () => {
    await start();
    await pass(PICK_MS - 1);
    expect(await picks()).toEqual([]);

    await pass(1);
    const at = Date.now();
    expect(await picks()).toEqual([{ pick: 1, teamId: teams[0], playerCode: A1, at }]);
    expect((await eventsIn(t, leagueId)).filter(({ kind }) => kind === "playerAssigned")).toEqual([
      { by: ANN, kind: "playerAssigned", playerCode: A1, playerName: "Player 101", teamId: teams[0], teamName: "Team 1" },
    ]);
    expect(await read()).toMatchObject({ onTheClock: { pick: 2, teamId: teams[1] }, clock: { startsAt: at + PICK_GAP_MS, endsAt: at + PICK_GAP_MS + PICK_MS } });
  });

  test("starts 10 seconds after a manager's pick, and the clock he beat never fires", async () => {
    await start();
    await pass(PICK_MS / 2);
    await pick(ANN, A2);
    const at = Date.now();

    expect(await read()).toMatchObject({ onTheClock: { pick: 2, teamId: teams[1] }, clock: { startsAt: at + PICK_GAP_MS, endsAt: at + PICK_GAP_MS + PICK_MS } });
    await pass(PICK_GAP_MS + PICK_MS - 1);
    expect((await picks()).map(({ pick }) => pick)).toEqual([1]);
  });

  test("takes the league's pick time as each clock starts, a change reaching the next pick", async () => {
    await start();
    await setPickSeconds(20);
    await pick(ANN, A1);
    const at = Date.now();

    expect(await read()).toMatchObject({ clock: { startsAt: at + PICK_GAP_MS, endsAt: at + PICK_GAP_MS + 20 * SECOND_MS } });
  });

  test("stops once the last pick is made", async () => {
    await start();
    for (let made = 0; made < 4; made++) await pass(PICK_MS + PICK_GAP_MS);

    expect(await read()).toMatchObject({ status: "over", picksMade: 4 });
    expect(await t.run((ctx) => ctx.db.query("drafts").unique())).not.toHaveProperty("clock");
  });
});

describe("the draft's pick", () => {
  test("skips a player the team can't legally take", async () => {
    await setSquadRules({ maxPerClub: 1 });
    await start();
    await pick(ANN, A1);
    await pick(BOB, A2);
    await pass(PICK_GAP_MS + PICK_MS);

    expect((await picks()).map(({ playerCode }) => playerCode)).toEqual([A1, A2, C1]);
  });

  test("is made at once for a team with no manager, filed as the commissioner's, and the next clock waits 10 seconds", async () => {
    await t.run((ctx) => ctx.db.patch("teams", teams[0], { managerEmail: undefined }));
    const now = Date.now();
    await start();
    await pass(0);

    expect(await picks()).toEqual([{ pick: 1, teamId: teams[0], playerCode: A1, at: now }]);
    expect((await eventsIn(t, leagueId)).filter(({ kind }) => kind === "playerAssigned")).toMatchObject([{ by: COMMISSIONER, teamId: teams[0] }]);
    expect(await read()).toMatchObject({ onTheClock: { pick: 2, teamId: teams[1] }, clock: { startsAt: now + PICK_GAP_MS } });
  });

  test("waits for the 10 seconds after the pick before a team with no manager", async () => {
    await t.run((ctx) => ctx.db.patch("teams", teams[1], { managerEmail: undefined }));
    await start();
    await pick(ANN, A2);
    await pass(PICK_GAP_MS - 1);
    expect(await picks()).toHaveLength(1);

    await pass(1);
    expect((await picks()).map(({ teamId, playerCode }) => ({ teamId, playerCode }))).toEqual([
      { teamId: teams[0], playerCode: A2 },
      { teamId: teams[1], playerCode: A1 },
    ]);
  });
});

describe("Mail", () => {
  test("gets no letter for any pick, the manager's or the draft's: only the next manager's up-next (draftLetters.test.ts)", async () => {
    await start();
    const before = await letterCount();
    await pick(ANN, A1);
    await pass(PICK_GAP_MS + PICK_MS);

    expect((await picks()).map(({ playerCode }) => playerCode)).toEqual([A1, A2]);
    expect(await newLetterSubjects(before)).toEqual(["You're up next in the draft", "You're up next in the draft"]);
  });
});

// spec/04, Auto-pick, S04.5 (Craig, 8 Nov 2026, on #1334: "Auto-pick at once"): nobody can pick for
// a team whose manager has gone, so the draft does, without waiting for the clock.
describe("a manager who goes while his pick is on the clock", () => {
  const leave = async (email: string) => (await as(email)).mutation(api.leagues.teams.leave, { leagueId });
  const pickedCodes = async () => (await picks()).map(({ playerCode }) => playerCode);

  test("leaves: the draft picks for his team at once", async () => {
    await start();
    await pass(PICK_MS / 2);
    expect(await picks()).toEqual([]);

    await leave(ANN);
    await pass(0);
    expect(await pickedCodes()).toEqual([A1]);
  });

  test("is removed by the commissioner: the draft picks for his team at once", async () => {
    await start();
    await (await as(COMMISSIONER)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: teams[0] });
    await pass(0);
    expect(await pickedCodes()).toEqual([A1]);
  });

  test("leaves while the draft is paused: the pick waits for the resume, then is made at once", async () => {
    await start();
    await (await as(COMMISSIONER)).mutation(api.draft.draftPause.pause, { leagueId });
    await leave(ANN);
    await pass(PICK_MS);
    expect(await picks()).toEqual([]);

    await (await as(COMMISSIONER)).mutation(api.draft.draftPause.resume, { leagueId });
    await pass(0);
    expect(await pickedCodes()).toEqual([A1]);
  });

  test("leaves while another team is on the clock: that pick still runs its clock", async () => {
    await start();
    await leave(BOB);
    await pass(PICK_MS - 1);
    expect(await picks()).toEqual([]);
    await pass(1);
    expect(await pickedCodes()).toEqual([A1]);
  });
});
