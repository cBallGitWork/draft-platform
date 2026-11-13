import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { adminByline } from "../../../convex/mail/letterWords";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS } from "../../../convex/shared/time";
import { TRANSACTIONS_READ_OF_EACH_KIND } from "../../../convex/squads/teamTransactions";
import { expectRefused } from "../../support/convex/test.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, OUTSIDER, type TestConvex, ANN, BOB } from "../../support/convex/leagues.harness";
import { ARSENAL, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { SAKA, squadMoves } from "../../support/convex/lineupSquad.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// My team's Transactions tab (#366): the manager's team's assignments, moves and releases, newest
// first, from the league's events, which Mail files letters from.

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
    await insertClubs(ctx, [ARSENAL]);
    await ctx.db.insert("players", { code: SAKA, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code });
    await ctx.db.insert("players", { code: RICE, name: "Rice", fullName: "Declan Rice", clubCode: ARSENAL.code });
  });
});

/** `email` runs the league's squads: each change a minute after the last, so their order is plain. */
const squadsAs = (email: string) => squadMoves(t, leagueId, email, { minuteApart: true });
const read = async (email = ANN) => (await actingAs(t, email)).query(api.squads.teamTransactions.ofMyTeam, { leagueId });
const kindsOf = async (email = ANN) => (await read(email)).transactions.map((move) => [move.kind, move.kind === "traded" ? null : move.playerName, move.otherTeamName]);

describe("who may read it", () => {
  test.each([COMMISSIONER, OUTSIDER])("%s, running no team in it, is refused", async (email) => {
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
      ["movedIn", "Saka", teamNumbered(2)],
      ["movedOut", "Saka", teamNumbered(2)],
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

  test("list a trade that went through as one, for each side: what it brought in, what it sent, and the other team (#1491)", async () => {
    // As a trade files them: the trade, then each of its players.
    const picks = [{ round: 3, teamId: bobTeam, teamName: teamNumbered(2) }];
    await t.run(async (ctx) => {
      const filed = (event: Doc<"leagueEvents">["event"]) => ctx.db.insert("leagueEvents", { leagueId, at: Date.now(), by: BOB, event });
      await filed({
        kind: "tradeMade",
        fromTeamId: annTeam,
        fromTeamName: teamNumbered(1),
        toTeamId: bobTeam,
        toTeamName: teamNumbered(2),
        gives: { players: [{ playerCode: SAKA, playerName: "Saka" }], picks: [] },
        gets: { players: [{ playerCode: RICE, playerName: "Rice" }], picks },
      });
      await filed({ kind: "playerTraded", playerCode: SAKA, playerName: "Saka", teamId: bobTeam, teamName: teamNumbered(2), fromTeamId: annTeam, fromTeamName: teamNumbered(1) });
      await filed({ kind: "playerTraded", playerCode: RICE, playerName: "Rice", teamId: annTeam, teamName: teamNumbered(1), fromTeamId: bobTeam, fromTeamName: teamNumbered(2) });
    });

    const saka = { players: [{ playerCode: SAKA, playerName: "Saka" }], picks: [] };
    const riceAndPick = { players: [{ playerCode: RICE, playerName: "Rice" }], picks };
    expect((await read()).transactions).toEqual([{ at: expect.any(Number), kind: "traded", in: riceAndPick, out: saka, otherTeamName: teamNumbered(2), by: BOB, yours: false }]);
    expect((await read(BOB)).transactions).toEqual([{ at: expect.any(Number), kind: "traded", in: saka, out: riceAndPick, otherTeamName: teamNumbered(1), by: BOB, yours: true }]);
  });

  test.each(["playerClaimed", "playerPickedUp"] as const)("list a %s as one with the drop it made, which has no row of its own (#1031)", async (kind) => {
    // As a waiver run or a pickup files them: the drop, then the player joining, at the same
    // instant; then a drop of his own a minute on.
    await t.run(async (ctx) => {
      const at = Date.now();
      const onTeam = { teamId: annTeam, teamName: teamNumbered(1) };
      const filed = (when: number, event: Doc<"leagueEvents">["event"]) => ctx.db.insert("leagueEvents", { leagueId, at: when, by: ANN, event });
      await filed(at, { kind: "playerDropped", playerCode: RICE, playerName: "Rice", ...onTeam, toWaivers: true });
      await filed(at, { kind, playerCode: SAKA, playerName: "Saka", ...onTeam, dropped: { playerCode: RICE, playerName: "Rice", toWaivers: true } });
      await filed(at + MINUTE_MS, { kind: "playerDropped", playerCode: SAKA, playerName: "Saka", ...onTeam, toWaivers: true });
    });

    expect((await read()).transactions).toEqual([
      expect.objectContaining({ kind: "dropped", playerName: "Saka", dropped: null, yours: true }),
      expect.objectContaining({ kind: kind === "playerClaimed" ? "claimed" : "pickedUp", playerName: "Saka", dropped: { playerCode: RICE, playerName: "Rice" }, yours: true }),
    ]);
  });

  test("say when and by whom, the admin by his byline as Mail's letter names him", async () => {
    await (await squadsAs(COMMISSIONER)).assign(SAKA, annTeam);
    await (await squadsAs(ADMIN)).assign(RICE, annTeam);
    const [byAdmin, byCommissioner] = (await read()).transactions;
    expect([byAdmin.by, byCommissioner.by]).toEqual([adminByline, COMMISSIONER]);
    expect([byAdmin.yours, byCommissioner.yours]).toEqual([false, false]);
    expect(byAdmin.at).toBeGreaterThan(byCommissioner.at);
  });
});

describe("what is read", () => {
  /** Files `count` events of `event` in the league, each newer than the last and than any before. */
  const file = (count: number, event: Doc<"leagueEvents">["event"]) =>
    t.run(async (ctx) => {
      const from = Date.now() + MINUTE_MS;
      for (let index = 0; index < count; index += 1) {
        await ctx.db.insert("leagueEvents", { leagueId, at: from + index, by: COMMISSIONER, event });
      }
    });

  test(`only squad moves: ${TRANSACTIONS_READ_OF_EACH_KIND}+ newer events of other kinds don't hide the team's`, async () => {
    await (await squadsAs(COMMISSIONER)).assign(SAKA, annTeam);
    await file(TRANSACTIONS_READ_OF_EACH_KIND + 1, { kind: "gameweekUsed", gameweek: 1, used: true });
    expect(await read()).toEqual({ transactions: [expect.objectContaining({ kind: "assigned", playerName: "Saka" })], cut: false });
  });

  test(`only the team's own (#1544): another team's ${TRANSACTIONS_READ_OF_EACH_KIND}+ newer moves of a kind neither hide the team's nor cut them`, async () => {
    const bobsRelease = { kind: "playerReleased", playerCode: RICE, playerName: "Rice", teamId: bobTeam, teamName: teamNumbered(2) } as const;
    const annsRelease = { ...bobsRelease, teamId: annTeam, teamName: teamNumbered(1) } as const;
    await file(1, annsRelease);
    await file(TRANSACTIONS_READ_OF_EACH_KIND + 1, bobsRelease);
    expect(await read()).toEqual({ transactions: [expect.objectContaining({ kind: "released", playerName: "Rice" })], cut: false });
  });

  test(`the team's latest ${TRANSACTIONS_READ_OF_EACH_KIND} of each kind, and says when a kind has older ones left out`, async () => {
    const annsRelease = { kind: "playerReleased", playerCode: RICE, playerName: "Rice", teamId: annTeam, teamName: teamNumbered(1) } as const;
    await file(TRANSACTIONS_READ_OF_EACH_KIND, annsRelease);
    expect((await read()).cut).toBe(false);
    await file(1, annsRelease);
    const { transactions, cut } = await read();
    expect([transactions.length, cut]).toEqual([TRANSACTIONS_READ_OF_EACH_KIND, true]);
  });

  test("a move is read by both its sides: the team it came from and the one it went to", async () => {
    const moved = { kind: "playerMoved", playerCode: SAKA, playerName: "Saka", teamId: bobTeam, teamName: teamNumbered(2), fromTeamId: annTeam, fromTeamName: teamNumbered(1) } as const;
    await file(1, moved);
    expect(await kindsOf()).toEqual([["movedOut", "Saka", teamNumbered(2)]]);
    expect(await kindsOf(BOB)).toEqual([["movedIn", "Saka", teamNumbered(1)]]);
  });
});
