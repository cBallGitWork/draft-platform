import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { leagueDeadlines } from "../../../convex/gameweeks/leagueDeadlines";
import { pickUpRefusals } from "../../../convex/waivers/freeAgents";
import { WAIVER_MS } from "../../../convex/waivers/waiverLimits";
import { changeRules, HELD_FIRST_RULES, rulesWith, setUsed } from "../../support/convex/leagueRules.harness";
import { actingAs, eventsIn } from "../../support/convex/leagues.harness";
import { nameOf, passNextDeadline, SQUAD } from "../../support/convex/lineupSquad.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ANN, ANNS_FIRST_DROP, BOB, CAT, NEXT, PALMER, RICE, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// A free agent pickup (#1199, spec/08 Waivers and free agency): first come first served, from the
// first waiver run after a gameweek until the next deadline; with a full squad the manager names
// who goes, and both happen at once; one breaking the squad's limits is refused; none in the lock;
// the league gets a Mail letter for each.

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

const pickUp = async (email: string, playerCode: number, dropCode: number | null = null) =>
  (await actingAs(w.t, email)).mutation(api.waivers.freeAgents.pickUp, { leagueId: w.leagueId, playerCode, dropCode });

/** The waiver cron's check, and what it starts now: never a later timer, so the clock stays put. */
const cronRuns = async () => {
  await w.t.mutation(internal.waivers.waiverRun.runDue, {});
  vi.advanceTimersByTime(0);
  await w.t.finishInProgressScheduledFunctions();
};

/** Gameweek NEXT's deadline, once it has passed. */
const nextDeadlineWas = () => w.t.run(async (ctx) => (await leagueDeadlines(ctx, w.leagueId)).get(NEXT));

/** Ann's squad at the league's maximum, so a pickup needs a drop. */
const annsSquadFull = () => changeRules(w.t, w.leagueId, rulesWith({ squad: { ...HELD_FIRST_RULES.squad, size: { minimum: 11, maximum: SQUAD.length } } }));

describe("in the window", () => {
  beforeEach(async () => {
    await w.runWaivers();
  });

  test("a manager picks up a free agent, and the league gets a letter", async () => {
    await pickUp(BOB, SAKA);

    expect(await w.stateOf(SAKA)).toEqual({ kind: "owned", teamId: w.bobsTeam, teamName: "Team 2" });
    expect((await eventsIn(w.t, w.leagueId)).at(-1)).toMatchObject({ kind: "playerPickedUp", playerCode: SAKA, teamId: w.bobsTeam, dropped: null, by: BOB });
    expect(await w.lettersTo(CAT)).toContainEqual({
      subject: `Team 2 picked up ${nameOf(SAKA)}`,
      body: `${BOB} picked up ${nameOf(SAKA)} for Team 2 as a free agent.`,
    });
    const { transactions } = await (await actingAs(w.t, BOB)).query(api.squads.teamTransactions.ofMyTeam, { leagueId: w.leagueId });
    expect(transactions).toContainEqual(expect.objectContaining({ kind: "pickedUp", playerCode: SAKA }));
  });

  test("two managers picking up the same free agent: the first wins", async () => {
    await pickUp(BOB, SAKA);
    await expectRefused(pickUp(CAT, SAKA), pickUpRefusals.notFreeAgent(nameOf(SAKA)));
    expect(await w.squadCodes(w.catsTeam)).not.toContain(SAKA);
  });

  test("with a full squad he names who goes, and both happen at once", async () => {
    await annsSquadFull();
    await pickUp(ANN, SAKA, ANNS_FIRST_DROP);

    const squad = await w.squadCodes(w.annsTeam);
    expect(squad).toContain(SAKA);
    expect(squad).not.toContain(ANNS_FIRST_DROP);
    expect(await w.stateOf(ANNS_FIRST_DROP)).toMatchObject({ kind: "onWaivers", claimableFrom: Date.now() + WAIVER_MS });
    expect((await eventsIn(w.t, w.leagueId)).slice(-2)).toMatchObject([
      { kind: "playerDropped", playerCode: ANNS_FIRST_DROP, teamId: w.annsTeam, toWaivers: true },
      { kind: "playerPickedUp", playerCode: SAKA, dropped: { playerCode: ANNS_FIRST_DROP, toWaivers: true } },
    ]);
    expect(await w.lettersTo(BOB)).toContainEqual({
      subject: `Team 1 picked up ${nameOf(SAKA)}`,
      body: `${ANN} picked up ${nameOf(SAKA)} for Team 1 as a free agent. ${nameOf(ANNS_FIRST_DROP)} went for him, onto waivers for at least 24 hours.`,
    });
  });

  test("a pickup that would break the squad's limits is refused", async () => {
    await annsSquadFull();
    await expectRefused(pickUp(ANN, SAKA), pickUpRefusals.limits(nameOf(SAKA)));
    expect(await w.squadCodes(w.annsTeam)).not.toContain(SAKA);
  });

  test("a free agent picked up and dropped before the next deadline is a free agent again (the churn rule)", async () => {
    await pickUp(BOB, SAKA);
    await (await actingAs(w.t, BOB)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: SAKA });
    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
  });

  test("a player on waivers or on a team, or a drop not his own, is refused", async () => {
    await w.onWaivers([PALMER]);
    await expectRefused(pickUp(BOB, PALMER), pickUpRefusals.notFreeAgent(nameOf(PALMER)), "on waivers");
    await expectRefused(pickUp(BOB, ANNS_FIRST_DROP), pickUpRefusals.notFreeAgent(nameOf(ANNS_FIRST_DROP)), "on a team");
    await expectRefused(pickUp(BOB, SAKA, ANNS_FIRST_DROP), pickUpRefusals.dropNotYours(nameOf(ANNS_FIRST_DROP)), "another's drop");
  });
});

describe("outside the window", () => {
  test("before the first waiver run after a gameweek, there are no free agents to pick up", async () => {
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.notOpen);
  });

  test("a pickup in the lock is refused, and the window waits for the next run after it", async () => {
    await w.runWaivers();
    await passNextDeadline(w.t);
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.locked, "before the match");
    await w.matchIs(NEXT, "live");
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.locked, "during it");

    await w.matchIs(NEXT, "fullTime");
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.notOpen, "after the last match, before the run");
    await w.runWaivers();
    await pickUp(BOB, SAKA);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
  });

  test("a free agent nobody picks up goes back on waivers at the deadline, and the next run hands him out by the waiver order (#1478, S08.13)", async () => {
    await w.runWaivers();
    expect(await w.stateOf(SAKA)).toEqual({ kind: "freeAgent" });
    await passNextDeadline(w.t);
    await cronRuns();
    expect(await w.stateOf(SAKA)).toEqual({ kind: "onWaivers", claimableFrom: await nextDeadlineWas() });
    expect(await w.stateOf(RICE)).toMatchObject({ kind: "onWaivers" });

    await w.matchIs(NEXT, "fullTime");
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.notOpen);
    // Cat is first in the order, everyone level on the table and its reverse draft order putting her top.
    await w.claim(BOB, SAKA);
    await w.claim(CAT, SAKA);
    await w.runWaivers();
    expect(await w.squadCodes(w.catsTeam)).toContain(SAKA);
    expect(await w.squadCodes(w.bobsTeam)).not.toContain(SAKA);

    // Rice, claimed by nobody, is a free agent again through the window, never put back twice.
    await cronRuns();
    expect(await w.stateOf(RICE)).toEqual({ kind: "freeAgent" });
    await pickUp(BOB, RICE);
    expect(await w.squadCodes(w.bobsTeam)).toContain(RICE);
  });

  test("a player dropped onto waivers before the deadline keeps his own time on them (#1478, S08.13)", async () => {
    await w.runWaivers();
    await (await actingAs(w.t, ANN)).mutation(api.waivers.waivers.drop, { leagueId: w.leagueId, playerCode: ANNS_FIRST_DROP });
    const claimableFrom = Date.now() + WAIVER_MS;
    await passNextDeadline(w.t);
    await cronRuns();
    expect(await w.stateOf(ANNS_FIRST_DROP)).toEqual({ kind: "onWaivers", claimableFrom });
  });

  test("a pickup through a gameweek the league doesn't play is refused until its last match is over (spec/13)", async () => {
    await setUsed(w.t, w.leagueId, NEXT, false);
    await w.runWaivers();
    await passNextDeadline(w.t);
    await w.matchIs(NEXT, "live");
    await expectRefused(pickUp(BOB, SAKA), pickUpRefusals.locked);

    await w.matchIs(NEXT, "fullTime");
    await w.runWaivers();
    await pickUp(BOB, SAKA);
    expect(await w.squadCodes(w.bobsTeam)).toContain(SAKA);
  });
});
