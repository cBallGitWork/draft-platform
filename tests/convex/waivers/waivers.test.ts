import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS } from "../../../convex/shared/time";
import { dropRefusals } from "../../../convex/waivers/waivers";
import { WAIVER_MS } from "../../../convex/waivers/waiverLimits";
import { playerLeaves } from "../../support/convex/draftLists.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, eventsIn, TEST_LEAGUE_TEAMS, type TestConvex } from "../../support/convex/leagues.harness";
import { holdPlayers, nameOf, passNextDeadline, SQUAD, squadMoves } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, BOB, NEXT, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// A manager's drop and a player's waiver state (#1197, spec/08 Waivers and free agency): a drop
// goes on waivers for at least 24 hours; a free agent picked up and dropped before the next
// deadline goes straight back to the free agents; no drop from the deadline until the gameweek's
// last match is over; a player new to the Premier League once the draft is over goes on waivers,
// as do those nobody drafts when the league says so; each drop files a Mail letter.

const DROPPED = SQUAD[SQUAD.length - 1];
/** A player the test holds itself, past waiverLeague's Saka, Palmer and Rice (9001 to 9003). */
const FREE_AGENT = 9004;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
let bobsTeam: Id<"teams">;

let w: WaiverLeague;
const lastEvent = async () => (await eventsIn(t, leagueId)).at(-1);

beforeEach(async () => {
  w = await waiverLeague();
  ({ t, leagueId, annsTeam, bobsTeam } = w);
});

describe("a drop", () => {
  test("puts the player on waivers for 24 hours, out of the squad, and tells the league in Mail", async () => {
    const at = Date.now();
    await w.drop(ANN, DROPPED);

    expect(await w.stateOf(DROPPED)).toEqual({ kind: "onWaivers", claimableFrom: at + WAIVER_MS });
    expect(WAIVER_MS).toBe(DAY_MS);
    expect(await lastEvent()).toMatchObject({ kind: "playerDropped", playerCode: DROPPED, teamId: annsTeam, toWaivers: true, by: ANN });
    expect(await w.lettersTo(BOB)).toContainEqual({
      subject: `Team 1 dropped ${nameOf(DROPPED)}`,
      body: `${ANN} dropped ${nameOf(DROPPED)} from Team 1. He is on waivers for at least 24 hours.`,
    });
    const squad = await t.run((ctx) => ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", annsTeam)).collect());
    expect(squad.map(({ playerCode }) => playerCode)).not.toContain(DROPPED);
  });

  test("is refused for a player in another team's squad, or in none", async () => {
    await expectRefused(w.drop(BOB, DROPPED), dropRefusals.notYours(nameOf(DROPPED)));
    await holdPlayers(t, [FREE_AGENT]);
    await expectRefused(w.drop(ANN, FREE_AGENT), dropRefusals.notYours(nameOf(FREE_AGENT)));
  });
});

describe("the churn rule", () => {
  /** FREE_AGENT on Bob's team as a free agent pickup makes him, now. */
  const pickedUp = async () => {
    await holdPlayers(t, [FREE_AGENT]);
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: bobsTeam, playerCode: FREE_AGENT, pickedUpAt: Date.now() }));
  };

  test("a free agent picked up and dropped before the next deadline goes straight back to the free agents", async () => {
    await pickedUp();
    await w.drop(BOB, FREE_AGENT);

    expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "freeAgent" });
    expect(await lastEvent()).toMatchObject({ kind: "playerDropped", playerCode: FREE_AGENT, toWaivers: false });
  });

  test("covers only the team that picked him up: moved by the commissioner, his new team's drop sends him to waivers (#1479, S08.6)", async () => {
    await pickedUp();
    await (await squadMoves(t, leagueId, COMMISSIONER)).move(FREE_AGENT, annsTeam);
    await w.drop(ANN, FREE_AGENT);

    expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() + WAIVER_MS });
  });

  test("once he has been in the squad for a deadline, a drop sends him to waivers", async () => {
    await pickedUp();
    await passNextDeadline(t);
    await w.matchIs(NEXT, "fullTime");
    await w.drop(BOB, FREE_AGENT);

    expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() + WAIVER_MS });
  });
});

describe("the lock", () => {
  test("refuses a drop from the deadline until the gameweek's last match is over", async () => {
    await passNextDeadline(t);
    await expectRefused(w.drop(ANN, DROPPED), dropRefusals.locked, "before the match");
    await w.matchIs(NEXT, "live");
    await expectRefused(w.drop(ANN, DROPPED), dropRefusals.locked, "during it");

    await w.matchIs(NEXT, "fullTime");
    await w.drop(ANN, DROPPED);
    expect((await w.stateOf(DROPPED)).kind).toBe("onWaivers");
  });
});

describe("players no team holds", () => {
  test("a player who never joined a team is a free agent; one on a team says which", async () => {
    await holdPlayers(t, [FREE_AGENT]);
    expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "freeAgent" });
    expect(await w.stateOf(DROPPED)).toEqual({ kind: "owned", teamId: annsTeam, teamName: teamNumbered(1) });
  });

  test("a player new to the Premier League once the draft is over goes on waivers for the next run", async () => {
    const otherLeague = await adminCreatesLeague(t, TEST_LEAGUE_TEAMS, "Still to draft");
    await t.mutation(internal.football.footballSync.upsertPlayers, { rows: [{ code: FREE_AGENT, name: "New", fullName: "New Man", clubCode: 1 }] });

    expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() });
    const elsewhere = await t.run((ctx) =>
      ctx.db.query("waiverPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", otherLeague).eq("playerCode", FREE_AGENT)).unique(),
    );
    expect(elsewhere).toBeNull();
  });

  describe("a player coming back to the Premier League (#1489, S08.8)", () => {
    const row = (code: number) => ({ code, name: "Back", fullName: "Back Again", clubCode: 1 });
    /** The feed stops sending the player, then sends him again. */
    const leavesAndComesBack = async (code: number) => {
      await t.run(async (ctx) => {
        const held = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique();
        if (held === null) throw new Error(`player ${code} isn't held`);
        await ctx.db.patch("players", held._id, { droppedAt: Date.now() - DAY_MS });
      });
      await t.mutation(internal.football.footballSync.upsertPlayers, { rows: [row(code)] });
    };

    test("goes on waivers for the next run, like a first-time arrival", async () => {
      await holdPlayers(t, [FREE_AGENT]);
      await leavesAndComesBack(FREE_AGENT);

      expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "onWaivers", claimableFrom: Date.now() });
    });

    test("stays with a team still holding him", async () => {
      await leavesAndComesBack(DROPPED);

      expect(await w.stateOf(DROPPED)).toEqual({ kind: "owned", teamId: annsTeam, teamName: teamNumbered(1) });
    });

    test("keeps a later waiver time he already has", async () => {
      await w.drop(ANN, DROPPED);
      const before = await w.stateOf(DROPPED);
      await leavesAndComesBack(DROPPED);

      expect(await w.stateOf(DROPPED)).toEqual(before);
    });

    test("sent again with no gap stays a free agent", async () => {
      await holdPlayers(t, [FREE_AGENT]);
      await t.mutation(internal.football.footballSync.upsertPlayers, { rows: [row(FREE_AGENT)] });

      expect(await w.stateOf(FREE_AGENT)).toEqual({ kind: "freeAgent" });
    });
  });

  test("a dropped player assigned to a team again is off waivers", async () => {
    await w.drop(ANN, DROPPED);
    const commissioner = await squadMoves(t, leagueId, COMMISSIONER);
    await commissioner.assign(DROPPED, bobsTeam);
    await commissioner.release(DROPPED);

    expect(await w.stateOf(DROPPED)).toEqual({ kind: "freeAgent" });
  });
});

describe("the player card's action (#1200)", () => {
  const actionOn = async (email: string, playerCode: number, now = Date.now()) =>
    (await actingAs(t, email)).query(api.waivers.waivers.cardActionOn, { leagueId, playerCode, now });
  const annsSquad = () => [...SQUAD].map((playerCode) => ({ playerCode, playerName: nameOf(playerCode) })).sort((one, other) => one.playerName.localeCompare(other.playerName));

  test("is a drop for the manager's own player, and nothing for another team's", async () => {
    expect(await actionOn(ANN, DROPPED)).toEqual({ kind: "drop" });
    expect(await actionOn(BOB, DROPPED)).toEqual({ kind: "none" });
  });

  test("is a pickup for a free agent, with the manager's squad by name to name who goes", async () => {
    await holdPlayers(t, [FREE_AGENT]);
    expect(await actionOn(ANN, FREE_AGENT)).toEqual({ kind: "pickUp", squad: annsSquad() });
    expect(await actionOn(BOB, FREE_AGENT)).toEqual({ kind: "pickUp", squad: [] });
  });

  test("is nothing for an unowned player who has left the Premier League: he is no free agent (#1469)", async () => {
    await holdPlayers(t, [FREE_AGENT]);
    await playerLeaves(t, FREE_AGENT);
    expect(await actionOn(ANN, FREE_AGENT)).toEqual({ kind: "none" });
  });

  test("is a claim for a player on waivers, saying the run that can first take him", async () => {
    await w.drop(ANN, DROPPED);
    const action = await actionOn(BOB, DROPPED);
    const { claimableFrom } = (await w.stateOf(DROPPED)) as { claimableFrom: number };
    expect(action).toEqual({ kind: "claim", firstRun: expect.objectContaining({ at: expect.any(Number) }), squad: [] });
    const firstRunAt = (action as { firstRun: { at: number } }).firstRun.at;
    expect(firstRunAt).toBeGreaterThanOrEqual(claimableFrom);
    expect(firstRunAt).toBeLessThan(claimableFrom + 7 * DAY_MS);
    // Once that run has gone by without taking him, the card names the next (#1467).
    const later = (await actionOn(BOB, DROPPED, firstRunAt + 1)) as { firstRun: { at: number } };
    expect(later.firstRun.at).toBeGreaterThan(firstRunAt);
  });

  test("is nothing for the commissioner, who runs no team", async () => {
    await holdPlayers(t, [FREE_AGENT]);
    expect(await actionOn(COMMISSIONER, FREE_AGENT)).toEqual({ kind: "none" });
  });
});
