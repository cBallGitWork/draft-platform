import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { adminByline } from "../../../convex/mail/letterWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS } from "../../../convex/shared/time";
import { EVENTS_SEARCHED } from "../../../convex/squads/teamTransactions";
import { expectRefused } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// My team's Transactions tab (#366): the manager's team's assignments, moves and releases, newest
// first, from the league's events, which Mail files letters from.

const [ANN, BOB] = MANAGERS;
const STRANGER = "stranger@example.com";
const SAKA = 1001;
const RICE = 1002;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annTeam: Id<"teams">;
let bobTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  [annTeam, bobTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await ctx.db.insert("clubs", { code: 3, name: "Arsenal", shortName: "ARS" });
    await ctx.db.insert("players", { code: SAKA, name: "Saka", fullName: "Bukayo Saka", clubCode: 3 });
    await ctx.db.insert("players", { code: RICE, name: "Rice", fullName: "Declan Rice", clubCode: 3 });
  });
});

/** `email` runs the league's squads: each change a minute after the last, so their order is plain. */
const squadsAs = async (email: string) => {
  const person = await actingAs(t, email);
  const later = () => vi.setSystemTime(Date.now() + MINUTE_MS);
  return {
    assign: async (playerCode: number, teamId: Id<"teams">) => (later(), person.mutation(api.squads.squads.assign, { leagueId, playerCode, teamId })),
    move: async (playerCode: number, teamId: Id<"teams">) => (later(), person.mutation(api.squads.squads.move, { leagueId, playerCode, teamId })),
    release: async (playerCode: number) => (later(), person.mutation(api.squads.squads.release, { leagueId, playerCode })),
  };
};
const read = async (email = ANN) => (await actingAs(t, email)).query(api.squads.teamTransactions.ofMyTeam, { leagueId });
const kindsOf = async (email = ANN) => (await read(email)).transactions.map(({ kind, playerName, otherTeamName }) => [kind, playerName, otherTeamName]);

describe("who may read it", () => {
  test.each([COMMISSIONER, STRANGER])("%s, running no team in it, is refused", async (email) => {
    await expectRefused(read(email), refusals.runsNoTeam);
  });
});

describe("the transactions", () => {
  test("list each kind that touches the team, newest first", async () => {
    const commissioner = await squadsAs(COMMISSIONER);
    await commissioner.assign(SAKA, annTeam);
    await commissioner.move(SAKA, bobTeam);
    await commissioner.move(SAKA, annTeam);
    await commissioner.release(SAKA);

    expect(await kindsOf()).toEqual([
      ["released", "Saka", null],
      ["movedIn", "Saka", "Team 2"],
      ["movedOut", "Saka", "Team 2"],
      ["assigned", "Saka", null],
    ]);
  });

  test("leave out another team's, and every event that isn't a transaction", async () => {
    const commissioner = await squadsAs(COMMISSIONER);
    await commissioner.assign(RICE, bobTeam);
    await commissioner.release(RICE);
    expect(await kindsOf()).toEqual([]);
    expect(await kindsOf(BOB)).toEqual([
      ["released", "Rice", null],
      ["assigned", "Rice", null],
    ]);
  });

  test("say when and by whom, the admin by his byline as Mail's letter names him", async () => {
    await (await squadsAs(COMMISSIONER)).assign(SAKA, annTeam);
    await (await squadsAs(ADMIN)).assign(RICE, annTeam);
    const [byAdmin, byCommissioner] = (await read()).transactions;
    expect([byAdmin.by, byCommissioner.by]).toEqual([adminByline, COMMISSIONER]);
    expect(byAdmin.at).toBeGreaterThan(byCommissioner.at);
  });
});

test(`searches the league's latest ${EVENTS_SEARCHED} events, and says when older ones are left out`, async () => {
  await (await squadsAs(COMMISSIONER)).assign(SAKA, annTeam);
  expect((await read()).cut).toBe(false);
  await t.run(async (ctx) => {
    for (let index = 0; index < EVENTS_SEARCHED; index += 1) {
      await ctx.db.insert("leagueEvents", { leagueId, at: Date.now() + MINUTE_MS + index, by: COMMISSIONER, event: { kind: "gameweekUsed", gameweek: 1, used: true } });
    }
  });
  expect(await read()).toEqual({ transactions: [], cut: true });
});
