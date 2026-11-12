import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { squadNumberRefusals } from "../../../convex/squads/squadNumbers";
import { deletes } from "../../support/convex/leagueDeletion.harness";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { COMMISSIONER, actingAs, addManagers, adminCreatesLeague, type TestConvex, ANN, BOB, EVE } from "../../support/convex/leagues.harness";
import { ARSENAL, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { SAKA } from "../../support/convex/lineupSquad.harness";

// Squad numbers (#13, spec/05 Squad numbers; Craig, 26 Oct 2026): a manager numbers his own
// players, 1 to 99, two alike if he likes, and a player who moves starts afresh.

const RICE = 1002;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
let bobsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  // A season to come, so the pitch has a gameweek to set (#1618).
  await holdGameweeks(t, { next: 1 });
  [annsTeam, bobsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    for (const [code, name] of [[SAKA, "Saka"], [RICE, "Rice"]] as const) await ctx.db.insert("players", { code, name, fullName: name, clubCode: ARSENAL.code });
  });
  const commissioner = await actingAs(t, COMMISSIONER);
  for (const playerCode of [SAKA, RICE]) await commissioner.mutation(api.squads.squads.assign, { leagueId, playerCode, teamId: annsTeam });
});

const setAs = async (email: string, playerCode: number, number: number | null) =>
  (await actingAs(t, email)).mutation(api.squads.squadNumbers.set, { leagueId, playerCode, number });
const numberOf = (playerCode: number) =>
  t.run(async (ctx) =>
    (await ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode)).unique())?.number ?? null,
  );

describe("a manager numbers his players", () => {
  test("#13 Done: his number holds, and his Squad tab and the pitch both read it", async () => {
    await setAs(ANN, SAKA, 7);
    const ann = await actingAs(t, ANN);
    const squad = await ann.query(api.squads.teamSquad.ofMyTeam, { leagueId, now: Date.now() });
    expect(squad.players.map(({ code, number }) => [code, number])).toEqual(expect.arrayContaining([[SAKA, 7], [RICE, null]]));
    const tactics = await ann.query(api.lineup.tactics.ofMyTeam, { leagueId, now: Date.now() });
    expect(tactics.kind === "open" && tactics.squad.find((each) => each.playerCode === SAKA)?.number).toBe(7);
  });

  test("two of his players may wear the same number, and null takes one away", async () => {
    await setAs(ANN, SAKA, 7);
    await setAs(ANN, RICE, 7);
    expect([await numberOf(SAKA), await numberOf(RICE)]).toEqual([7, 7]);
    await setAs(ANN, SAKA, null);
    expect(await numberOf(SAKA)).toBeNull();
  });

  test("any whole number from 1 to 99, and nothing else", async () => {
    await setAs(ANN, SAKA, 1);
    await setAs(ANN, SAKA, 99);
    for (const number of [0, 100, 7.5, -3, Number.NaN]) await expectRefused(setAs(ANN, SAKA, number), squadNumberRefusals.outOfRange);
    expect(await numberOf(SAKA)).toBe(99);
  });
});

describe("only his own", () => {
  test("another manager can't number his players, and someone with no team can't number any", async () => {
    await expectRefused(setAs(BOB, SAKA, 9), squadNumberRefusals.notInSquad);
    await expectRefused(setAs(EVE, SAKA, 9), refusals.runsNoTeam);
    await expectRefused(setAs(COMMISSIONER, SAKA, 9), refusals.runsNoTeam);
    expect(await numberOf(SAKA)).toBeNull();
  });

  test("nothing is numbered in a league being deleted", async () => {
    await deletes(t, COMMISSIONER, leagueId);
    await expectRefused(setAs(ANN, SAKA, 9), refusals.beingDeleted);
    expect(await numberOf(SAKA)).toBeNull();
  });

  test("a free agent is no one's to number", async () => {
    await t.run((ctx) => ctx.db.insert("players", { code: 3000, name: "Free", fullName: "Free", clubCode: ARSENAL.code }));
    await expectRefused(setAs(ANN, 3000, 9), squadNumberRefusals.notInSquad);
  });
});

describe("a player who moves starts afresh (Craig, 26 Oct 2026)", () => {
  test("moved to another team, he wears none of his old team's", async () => {
    await setAs(ANN, SAKA, 7);
    await (await actingAs(t, COMMISSIONER)).mutation(api.squads.squads.move, { leagueId, playerCode: SAKA, teamId: bobsTeam });
    expect(await numberOf(SAKA)).toBeNull();
  });

  test("released and assigned again, he wears none of his old team's", async () => {
    await setAs(ANN, SAKA, 7);
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.squads.squads.release, { leagueId, playerCode: SAKA });
    await commissioner.mutation(api.squads.squads.assign, { leagueId, playerCode: SAKA, teamId: annsTeam });
    expect(await numberOf(SAKA)).toBeNull();
  });
});

describe("his shirt wears his club's number until his manager gives one (Craig, 5 Nov 2026)", () => {
  const clubLists = (numbers: { code: number; number: number | null }[]) =>
    t.mutation(internal.positions.positionsSync.recordClubNumbers, { numbers });
  /** A player's shirt on Ann's Squad tab, checked against her pitch, which always agrees. */
  const shirtOf = async (playerCode: number) => {
    const ann = await actingAs(t, ANN);
    const squad = await ann.query(api.squads.teamSquad.ofMyTeam, { leagueId, now: Date.now() });
    const tactics = await ann.query(api.lineup.tactics.ofMyTeam, { leagueId, now: Date.now() });
    const onSquadTab = squad.players.find((each) => each.code === playerCode)?.number;
    expect(tactics.kind === "open" && tactics.squad.find((each) => each.playerCode === playerCode)?.number).toBe(onSquadTab);
    return onSquadTab;
  };

  test("#13 Done: a new team shows real club numbers, and his manager's change shows instead", async () => {
    await clubLists([{ code: SAKA, number: 7 }]);
    expect(await shirtOf(SAKA)).toBe(7);
    await setAs(ANN, SAKA, 10);
    expect(await shirtOf(SAKA)).toBe(10);
  });

  test("an emptied number goes back to his club's", async () => {
    await clubLists([{ code: SAKA, number: 7 }]);
    await setAs(ANN, SAKA, 10);
    await setAs(ANN, SAKA, null);
    expect(await shirtOf(SAKA)).toBe(7);
  });

  test("his club changing his number, or a move to another club, changes an untouched one and keeps his manager's", async () => {
    await clubLists([{ code: SAKA, number: 32 }, { code: RICE, number: 41 }]);
    await setAs(ANN, RICE, 4);
    expect(await clubLists([{ code: SAKA, number: 9 }, { code: RICE, number: 20 }])).toBe(2);
    expect([await shirtOf(SAKA), await shirtOf(RICE)]).toEqual([9, 4]);
  });

  test("a signing his club hasn't numbered is blank, then fills in by itself", async () => {
    expect(await shirtOf(SAKA)).toBeNull();
    await clubLists([{ code: SAKA, number: null }]);
    expect(await shirtOf(SAKA)).toBeNull();
    await clubLists([{ code: SAKA, number: 7 }]);
    expect(await shirtOf(SAKA)).toBe(7);
    // A number his club takes away leaves him blank again.
    await clubLists([{ code: SAKA, number: null }]);
    expect(await shirtOf(SAKA)).toBeNull();
  });

  test("a club number already held changes nothing", async () => {
    await clubLists([{ code: SAKA, number: 7 }]);
    expect(await clubLists([{ code: SAKA, number: 7 }, { code: RICE, number: null }])).toBe(0);
  });
});
