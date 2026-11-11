import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { claimFailedLetter } from "../../../convex/mail/waiverLetterWords";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { WAIVER_MS } from "../../../convex/waivers/waiverLimits";
import { latestRunAt } from "../../../convex/waivers/waiverTimes";
import { changeRules, HELD_FIRST_RULES, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { playerLeaves } from "../../support/convex/draftLists.harness";
import type { Id } from "../../../convex/_generated/dataModel";
import { actingAs, ADMIN, eventsIn } from "../../support/convex/leagues.harness";
import { nameOf, SQUAD } from "../../support/convex/lineupSquad.harness";
import { ANN, ANNS_FIRST_DROP, ANNS_SECOND_DROP, BOB, CAT, NEXT, PALMER, RICE, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// The waiver run (#1198, spec/08 Waivers and free agency): at the league's run times it takes
// every player whose 24 hours are up in the waiver order, a winner going to the bottom; a claim
// breaking the squad's limits is refused; a player nobody claims is a free agent after; the league
// gets a letter for each claim that succeeds, and a failed one goes only to its manager, saying why.

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

describe("a run", () => {
  test("takes only players whose 24 hours are up; one nobody claims is a free agent straight after", async () => {
    await w.onWaivers([SAKA]);
    await w.onWaivers([PALMER], Date.now() + WAIVER_MS);
    await w.claim(BOB, PALMER);
    await w.runWaivers();

    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "onWaivers" });
    expect(await w.pending(BOB)).toHaveLength(1);
  });

  test("runs once for each run time", async () => {
    vi.setSystemTime(Date.now() + MINUTE_MS);
    const at = Date.now();
    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at });
    await w.onWaivers([PALMER], at);
    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at });
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "onWaivers" });
  });

  test("a claim that would break the squad's limits is refused", async () => {
    await changeRules(w.t, w.leagueId, rulesWith({ squad: { ...HELD_FIRST_RULES.squad, size: { minimum: 11, maximum: SQUAD.length } } }));
    await w.onWaivers([SAKA, PALMER]);
    await w.claim(ANN, SAKA);
    await w.claim(ANN, PALMER, ANNS_FIRST_DROP);
    await w.runWaivers();

    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.annsTeam });
    expect(await w.lettersTo(ANN)).toContainEqual(claimFailedLetter({ playerName: nameOf(SAKA), dropName: null, why: "limits" }));
  });

  test("a claim for a player who has left the Premier League since fails, saying so", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await playerLeaves(w.t, SAKA);
    await w.runWaivers();

    expect(await w.squadCodes(w.bobsTeam)).not.toContain(SAKA);
    const gone = claimFailedLetter({ playerName: nameOf(SAKA), dropName: null, why: "playerGone" });
    expect(await w.lettersTo(BOB)).toContainEqual(gone);
    expect(gone.body).toContain(`${nameOf(SAKA)} has left the Premier League, so he couldn't join your squad.`);
  });
});

describe("the letters", () => {
  test("the league gets one for each claim that succeeds; a failed one goes only to its manager, saying why", async () => {
    await w.onWaivers([SAKA, PALMER]);
    await w.claim(ANN, SAKA);
    await w.claim(ANN, PALMER, ANNS_FIRST_DROP);
    await w.claim(BOB, SAKA);
    // Ann drops the player she named before the run.
    await (await actingAs(w.t, ANN)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: ANNS_FIRST_DROP });
    await w.runWaivers();

    const won = { subject: `Team 2 claimed ${nameOf(SAKA)}`, body: `Team 2 claimed ${nameOf(SAKA)} off waivers, ${BOB}'s claim.` };
    expect(await w.lettersTo(CAT)).toContainEqual(won);
    expect(await w.lettersTo(ANN)).toContainEqual(won);
    const ahead = claimFailedLetter({ playerName: nameOf(SAKA), dropName: null, why: "ahead" });
    const dropGone = claimFailedLetter({ playerName: nameOf(PALMER), dropName: nameOf(ANNS_FIRST_DROP), why: "dropGone" });
    expect(await w.lettersTo(ANN)).toEqual(expect.arrayContaining([ahead, dropGone]));
    expect(await w.lettersTo(CAT)).not.toContainEqual(ahead);
    expect(ahead.body).toBe(`Another team was ahead of you in the waiver order for ${nameOf(SAKA)}. Your claim is gone; nobody joined or left your squad for it.`);
    expect(dropGone.body).toContain(`${nameOf(ANNS_FIRST_DROP)} was no longer in your squad to drop.`);
  });

  const assignSaka = async (teamId: Id<"teams">) =>
    (await actingAs(w.t, ADMIN)).mutation(api.squads.squads.assign, { leagueId: w.leagueId, playerCode: SAKA, teamId });

  test("a claim for a player his own earlier claim won goes quietly, with no letter (#1465, S08.5)", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.claim(ANN, SAKA, ANNS_SECOND_DROP);
    await w.runWaivers();

    const squad = await w.squadCodes(w.annsTeam);
    expect(squad).toEqual(expect.arrayContaining([SAKA, ANNS_SECOND_DROP]));
    expect(squad).not.toContain(ANNS_FIRST_DROP);
    expect(await w.pending(ANN)).toEqual([]);
    expect((await w.lettersTo(ANN)).map(({ body }) => body).join(" ")).not.toContain("ahead of you");
  });

  test("a claim for a player the commissioner has put in his squad goes quietly, with no letter (#1465)", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await assignSaka(w.bobsTeam);
    await w.runWaivers();

    expect(await w.pending(BOB)).toEqual([]);
    expect(await w.lettersTo(BOB)).not.toContainEqual(claimFailedLetter({ playerName: nameOf(SAKA), dropName: null, why: "ahead" }));
  });

  test("a claim for a player the commissioner has put in another team's squad still fails as another team's", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    await assignSaka(w.catsTeam);
    await w.runWaivers();

    expect(await w.lettersTo(BOB)).toContainEqual(claimFailedLetter({ playerName: nameOf(SAKA), dropName: null, why: "ahead" }));
  });

  test("a claim with a drop names who went, and files both as squad moves", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    await w.runWaivers();

    expect(await w.lettersTo(BOB)).toContainEqual({
      subject: `Team 1 claimed ${nameOf(SAKA)}`,
      body: `Team 1 claimed ${nameOf(SAKA)} off waivers, ${ANN}'s claim. ${nameOf(ANNS_FIRST_DROP)} went for him, onto waivers for at least 24 hours.`,
    });
    expect((await eventsIn(w.t, w.leagueId)).slice(-2)).toMatchObject([
      { kind: "playerDropped", playerCode: ANNS_FIRST_DROP, teamId: w.annsTeam, toWaivers: true },
      { kind: "playerClaimed", playerCode: SAKA, teamId: w.annsTeam, by: ANN },
    ]);
    const { transactions } = await (await actingAs(w.t, ANN)).query(api.squads.teamTransactions.ofMyTeam, { leagueId: w.leagueId });
    // The team's tab lists the claim as one row, naming who went under Out (#1031).
    expect(transactions).toContainEqual(expect.objectContaining({ kind: "claimed", playerCode: SAKA, dropped: expect.objectContaining({ playerCode: ANNS_FIRST_DROP }) }));
    expect(transactions.some((move) => move.kind === "dropped")).toBe(false);
  });
});

describe("reverse table order", () => {
  /** Total points, gameweek NEXT over with Ann on 30, Cat on 40, Bob on 50 and the fourth team on
   *  60: Ann is bottom, though the reverse of the draft order would put Bob first. */
  beforeEach(async () => {
    await changeRules(w.t, w.leagueId, TOTAL_POINTS);
    await w.gameweekEnds(NEXT);
    const points = new Map([
      [w.annsTeam, 30],
      [w.catsTeam, 40],
      [w.bobsTeam, 50],
    ]);
    await w.t.run(async (ctx) => {
      for (const teamId of w.teams) {
        await ctx.db.insert("finalScores", { leagueId: w.leagueId, gameweek: NEXT, teamId, points: points.get(teamId) ?? 60, fixtureCodes: [NEXT], storedAt: Date.now() });
      }
    });
  });

  test("the bottom of the table first, two teams claiming the same player; a winner goes to the bottom for the rest of the run", async () => {
    await w.onWaivers([SAKA, PALMER]);
    for (const email of [BOB, ANN]) {
      await w.claim(email, SAKA);
      await w.claim(email, PALMER);
    }
    await w.runWaivers();

    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.annsTeam });
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
  });

  test("a winner stays at the bottom until the next gameweek ends", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA);
    await w.runWaivers();

    await w.onWaivers([PALMER]);
    await w.claim(ANN, PALMER);
    await w.claim(CAT, PALMER);
    await w.runWaivers();
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.catsTeam });

    await w.gameweekEnds(NEXT + 1);
    await w.onWaivers([RICE]);
    await w.claim(CAT, RICE);
    await w.claim(ANN, RICE);
    await w.runWaivers();
    expect(await w.stateOf(RICE)).toMatchObject({ kind: "owned", teamId: w.annsTeam });
  });
});

describe("rotating", () => {
  test("starts from the reverse of the draft order, two teams claiming the same player, and whoever last won stays at the bottom across gameweeks", async () => {
    await changeRules(w.t, w.leagueId, rulesWith({ waivers: { ...HELD_FIRST_RULES.waivers, order: "rotating" } }));
    await w.onWaivers([SAKA]);
    await w.claim(ANN, SAKA);
    await w.claim(BOB, SAKA);
    await w.runWaivers();
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });

    await w.gameweekEnds(NEXT);
    await w.onWaivers([PALMER]);
    await w.claim(BOB, PALMER);
    await w.claim(ANN, PALMER);
    await w.runWaivers();
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "owned", teamId: w.annsTeam });
  });
});

describe("the cron", () => {
  test("runs each league's waivers at its run time, once", async () => {
    await w.onWaivers([SAKA]);
    await w.claim(BOB, SAKA);
    // The league's next run time, within the week, and two minutes past it, with the gameweeks
    // around it over, so it falls outside the lock.
    const runTime = latestRunAt(FIRST_RULES.waivers.runs, Date.now() + WEEK_MS)!;
    for (const gameweek of [NEXT, NEXT + 1]) await w.matchIs(gameweek, "fullTime");
    vi.setSystemTime(runTime + 2 * MINUTE_MS);
    const ranAt = () => w.t.run(async (ctx) => (await ctx.db.query("waiverOrders").unique())?.ranAt);
    const runDue = async () => {
      await w.t.mutation(internal.waivers.waiverRun.runDue, {});
      await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    };

    await runDue();
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
    expect(await ranAt()).toBe(runTime);

    await w.onWaivers([PALMER], runTime);
    await runDue();
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "onWaivers" });
  });
});

describe("a run the cron starts late", () => {
  test("takes players by its run time: one whose 24 hours end after it waits for the next run", async () => {
    const at = Date.now() + MINUTE_MS;
    await w.onWaivers([SAKA], at);
    await w.onWaivers([PALMER], at + MINUTE_MS);
    await w.claim(BOB, PALMER);
    vi.setSystemTime(at + 4 * MINUTE_MS);
    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at });

    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
    expect(await w.stateOf(PALMER)).toMatchObject({ kind: "onWaivers" });
    expect(await w.pending(BOB)).toHaveLength(1);
  });

  test("a claim's drop starts its 24 hours at the run's time, so the next day's run can take him (#1481)", async () => {
    const at = Date.now() + MINUTE_MS;
    await w.onWaivers([SAKA], at);
    await w.claim(ANN, SAKA, ANNS_FIRST_DROP);
    vi.setSystemTime(at + 3 * MINUTE_MS);
    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at });
    expect(await w.stateOf(SAKA)).toMatchObject({ kind: "owned", teamId: w.annsTeam });

    const next = at + WAIVER_MS;
    await w.claim(BOB, ANNS_FIRST_DROP);
    vi.setSystemTime(next + MINUTE_MS);
    await w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at: next });
    expect(await w.stateOf(ANNS_FIRST_DROP)).toMatchObject({ kind: "owned", teamId: w.bobsTeam });
  });
});
