import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { SECOND_MS } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { draftSteps } from "../../support/convex/draft.harness";
import { addManager, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, OUTSIDER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Auto-pick (spec/04, Auto-pick and The queue and the ranking; #1094): when a clock runs out the
// draft takes the best legal player left in the team's queue, then the admin's ranking, then by
// last season's points (priced rows, #1114: TOP on 231, SECOND on 224, THIRD on 210, at CM),
// newcomers last by name; never from the do-not-draft list unless it holds every legal player. A
// manager can take control back; a team with no manager is auto-picked from the start.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const player = (code: number, name: string, club = ARSENAL): HeldPlayer => ({ code, name, fullName: name, clubCode: club.code, positions: ["CM"] });
const TOP = 118748;
const SECOND = 223340;
const THIRD = 209244;
const ABBOTT = 101;
const ZOLA = 201;
const ARTETA = 105;
const PLAYERS = [
  player(TOP, "Top"),
  player(SECOND, "Second"),
  player(ARTETA, "Arteta"),
  player(THIRD, "Third", CHELSEA),
  player(ZOLA, "Zola", CHELSEA),
  player(ABBOTT, "Abbott", CHELSEA),
  player(102, "Baines", CHELSEA),
  player(103, "Carr", CHELSEA),
  player(104, "Dunne", CHELSEA),
];
const PICK_MS = HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS;
const [ANN, BOB] = MANAGERS;

const setRules = (squad: Partial<LeagueRules["squad"]>, timeouts = 2) =>
  changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: 2 }, minimumByArea: null, maxPerClub: null, ...squad },
    draft: { ...HELD_FIRST_RULES.draft!, timeoutsBeforeAutoPick: timeouts },
  }));
const { as, start, pick: pickNow, pickAndWait: pick, pass } = draftSteps(() => ({ t, leagueId }));
/** `email` picks, and the pick's 10 seconds to undo it pass. */
const takeBack = async (email: string) => (await as(email)).mutation(api.draft.autoPickSwitch.takeControlBack, { leagueId });
const picked = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ playerCode }) => playerCode));
const timeouts = () => t.run(async (ctx) => (await ctx.db.query("drafts").unique())?.timeouts);
const lists = (team: Id<"teams">, queue: number[], doNotDraft: number[] = []) => t.run((ctx) => ctx.db.insert("draftLists", { leagueId, teamId: team, queue, doNotDraft }));
const ranking = (codes: number[]) =>
  t.run((ctx) => ctx.db.insert("draftRanking", { players: codes.map((code, index) => ({ code, rank: index + 1 })), uploadedAt: Date.now() }));

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, PLAYERS);
    for (const [playerCode, points] of [
      [TOP, 231],
      [SECOND, 224],
      [THIRD, 210],
    ])
      await ctx.db.insert("pastSeasonPoints", { season: 2025, playerCode, points: { CM: points } });
  });
  await setRules({});
});

// Two teams snake over two rounds: Ann has picks 1 and 4, Bob 2 and 3.
describe("auto-pick takes", () => {
  test("the best player left in the queue, first", async () => {
    await lists(teams[0], [ZOLA, THIRD]);
    await ranking([TOP]);
    await start();
    await pass(PICK_MS);

    expect(await picked()).toEqual([ZOLA]);
  });

  test("the best in the admin's ranking once the queue is out", async () => {
    await lists(teams[1], [TOP]);
    await ranking([ZOLA, THIRD]);
    await start();
    await pick(ANN, TOP);
    await pass(PICK_GAP_MS + PICK_MS);

    expect(await picked()).toEqual([TOP, ZOLA]);
  });

  test("with no ranking uploaded, the most points last season", async () => {
    await start();
    await pass(PICK_MS);

    expect(await picked()).toEqual([TOP]);
  });

  test("players the ranking leaves out by last season's points, newcomers last by name", async () => {
    await setRules({ size: { minimum: 1, maximum: 4 } });
    await ranking([ZOLA]);
    await start();
    await pass(PICK_MS);
    await pick(BOB, TOP);
    await pick(BOB, SECOND);
    await pass(PICK_GAP_MS + PICK_MS);
    await pass(PICK_GAP_MS + PICK_MS);

    expect(await picked()).toEqual([ZOLA, TOP, SECOND, THIRD, ABBOTT]);
  });

  test("no one on the do-not-draft list", async () => {
    await lists(teams[0], [], [TOP]);
    await start();
    await pass(PICK_MS);

    expect(await picked()).toEqual([SECOND]);
  });

  test("past a drafted player or one the squad rules grey out", async () => {
    await setRules({ maxPerClub: 1 });
    await lists(teams[0], [TOP, ARTETA, ZOLA]);
    await start();
    await pick(ANN, TOP);
    await pass(PICK_GAP_MS + PICK_MS);
    await pick(BOB, THIRD);
    expect(await picked()).toEqual([TOP, SECOND, THIRD]);

    await pass(PICK_GAP_MS + PICK_MS);
    expect(await picked()).toEqual([TOP, SECOND, THIRD, ZOLA]);
  });

  test("the best legal player by the usual order when every one of them is on the do-not-draft list", async () => {
    await setRules({ size: { minimum: 1, maximum: 1 } });
    await lists(
      teams[0],
      [],
      PLAYERS.map(({ code }) => code),
    );
    await start();
    await pass(PICK_MS);

    expect(await picked()).toEqual([TOP]);
  });
});

describe("taking control back", () => {
  test("takes the team off auto-pick and its timeouts back to 0", async () => {
    await setRules({}, 1);
    await start();
    await pass(PICK_MS);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1, autoPick: "fullClock" }]);

    await takeBack(ANN);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 0 }]);
  });

  test("gives his pick on the clock its full time again, not made at once", async () => {
    await setRules({ size: { minimum: 1, maximum: 4 } }, 1);
    await start();
    await pass(PICK_MS);
    await pick(BOB, ZOLA);
    await pick(BOB, ABBOTT);
    await pass(PICK_GAP_MS + PICK_MS);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 2, autoPick: "atOnce" }]);

    await takeBack(ANN);
    await pass(PICK_GAP_MS + PICK_MS - 1);
    expect(await picked()).toHaveLength(4);
    await pass(1);
    expect(await picked()).toHaveLength(5);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1, autoPick: "fullClock" }]);
  });

  test("is refused to a manager who isn't on auto-pick", async () => {
    await start();
    await expect(takeBack(ANN)).rejects.toThrow(pickRefusals.notOnAutoPick);
    await pass(PICK_MS);
    await expect(takeBack(ANN)).rejects.toThrow(pickRefusals.notOnAutoPick);
  });
});

describe("turning auto-pick on himself", () => {
  const turnOn = async (email: string) => (await as(email)).mutation(api.draft.autoPickSwitch.turnOn, { leagueId });
  const board = async (email: string) => (await as(email)).query(api.draft.draftBoard.ofLeague, { leagueId });

  test("before the draft starts: his first pick is made at once, and his count stays 0", async () => {
    await lists(teams[0], [ZOLA]);
    await turnOn(ANN);
    await start();
    await pass(0);

    expect(await picked()).toEqual([ZOLA]);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 0, autoPick: "chosen" }]);
  });

  test("with his pick on the clock: that pick and every later one are made at once, his timeout count as it was", async () => {
    await setRules({ size: { minimum: 1, maximum: 4 } }, 2);
    await start();
    await pass(PICK_MS);
    await pick(BOB, ZOLA);
    await pick(BOB, ABBOTT);
    await pass(PICK_GAP_MS + SECOND_MS);
    expect(await picked()).toHaveLength(3);

    await turnOn(ANN);
    await pass(0);
    expect(await picked()).toHaveLength(4);
    await pass(PICK_GAP_MS);
    expect(await picked()).toHaveLength(5);
    await pick(BOB, 102);
    await pick(BOB, 103);
    await pass(PICK_GAP_MS);
    expect(await picked()).toHaveLength(8);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1, autoPick: "chosen" }]);
  });

  test("in the 10 seconds before his clock starts: his pick waits for it, then is made at once", async () => {
    await start();
    await pick(ANN, TOP);
    await pick(BOB, SECOND);
    await pickNow(BOB, THIRD);
    await turnOn(ANN);
    await pass(PICK_GAP_MS - 1);
    expect(await picked()).toHaveLength(3);
    await pass(1);
    expect(await picked()).toHaveLength(4);
  });

  test("taking control back gives his clock back", async () => {
    await turnOn(ANN);
    await takeBack(ANN);
    await start();
    await pass(PICK_MS - 1);
    expect(await picked()).toEqual([]);
  });

  test("is refused to a manager already on auto-pick, and once the draft is over", async () => {
    await turnOn(ANN);
    await expect(turnOn(ANN)).rejects.toThrow(pickRefusals.onAutoPick);
    await setRules({ size: { minimum: 1, maximum: 1 } });
    await start();
    await pass(0);
    await pick(BOB, SECOND);
    await expect(turnOn(BOB)).rejects.toThrow(pickRefusals.over);
  });

  test("the board marks every pick the draft made 'auto' for the whole league, and tells him he is on it", async () => {
    await setRules({}, 1);
    await start();
    await pass(PICK_MS);
    await pick(BOB, ZOLA);

    expect((await board(BOB)).picks.map(({ auto }) => auto)).toEqual([true, false]);
    expect((await board(ANN)).yourAutoPick).toEqual({ on: true, timeouts: 1, limit: 1 });
    expect((await board(BOB)).yourAutoPick).toEqual({ on: false, timeouts: 0, limit: 1 });
    expect((await board(COMMISSIONER)).yourAutoPick).toBeNull();
  });
});

describe("a team with no manager", () => {
  test("is auto-picked from its first pick, by the same order", async () => {
    await t.run((ctx) => ctx.db.patch("teams", teams[0], { managerEmail: undefined }));
    await lists(teams[0], [ZOLA]);
    await start();
    await pass(0);

    expect(await picked()).toEqual([ZOLA]);
  });

  test("taken over mid-draft starts off auto-pick: his clock runs", async () => {
    await t.run((ctx) => ctx.db.patch("teams", teams[1], { managerEmail: undefined }));
    await setRules({ size: { minimum: 1, maximum: 3 } });
    await start();
    await pickNow(ANN, TOP);
    await pass(PICK_GAP_MS);
    expect(await picked()).toHaveLength(2);

    await t.run((ctx) => ctx.db.patch("teams", teams[1], { managerEmail: BOB }));
    await pass(PICK_GAP_MS + PICK_MS - 1);
    expect(await picked()).toHaveLength(2);
    await pass(1);
    expect(await picked()).toHaveLength(3);
    expect(await timeouts()).toEqual([{ teamId: teams[1], count: 1 }]);
  });

  test("handed on by a manager who was on auto-pick starts off it too, his timeouts gone", async () => {
    await setRules({ size: { minimum: 1, maximum: 3 } });
    await (await as(BOB)).mutation(api.draft.autoPickSwitch.turnOn, { leagueId });
    expect(await timeouts()).toEqual([{ teamId: teams[1], count: 0, autoPick: "chosen" }]);

    await (await as(BOB)).mutation(api.leagues.teams.leave, { leagueId });
    await addManager(t, leagueId, OUTSIDER, teams[1]);

    expect(await timeouts()).toEqual([{ teamId: teams[1], count: 0 }]);
  });
});
