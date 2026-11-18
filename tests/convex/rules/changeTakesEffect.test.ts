import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { changeRules, HELD_FIRST_RULES, holdGameweeks, holdGameweeksPastTheSeason, latestRules, moveFplDeadline, rulesIn, rulesRevision, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { HOUR_MS } from "../../../convex/shared/time";
import { changesFromAt } from "../../../convex/gameweeks/nextGameweek";
import { actingAs, adminCreatesLeague, ANN, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { leagueSettingsOf, teamSquadOf, tradesOf } from "../../support/convex/screenReads.harness";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { squadMaximumOf, withSquadMaximum } from "../../../convex/rules/squadMaximums";
import { FIRST_INSTRUCTIONS } from "../../../convex/lineup/instructions";
import { pairRefusalWords } from "../../../convex/lineup/instructionsWords";
import { FIRST_PRESETS } from "../../../convex/lineup/presets";
import { pickUpRefusals } from "../../../convex/waivers/freeAgents";
import { expectRefused } from "../../support/convex/test.harness";
import { nameOf, passNextDeadline, SQUAD } from "../../support/convex/lineupSquad.harness";
import { ANNS_FIRST_DROP, PALMER, SAKA, tradeLeague, type TradeLeague } from "../../support/convex/trades.harness";
import { NEXT as WAIVERS_NEXT, waiverLeague } from "../../support/convex/waivers.harness";

// Which gameweek a commissioner's change takes effect from when it moves the deadline (#25): the
// next not begun under the old deadline nor the new. A gameweek begins at the league's own
// deadline, never FPL's (Craig, 22 Oct 2026: "ours, we arent fpl so stop copying them"; #138).
// holdGameweeks holds FPL's 90 minutes before each kickoff, as feed data.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const change = (leagueId: Id<"leagues">, rules = TOTAL_POINTS) => changeRules(t, leagueId, rules);
/** A deadline three hours before the first kickoff, so an hour and a half earlier than FPL's. */
const THREE_HOURS_BEFORE = rulesWith({ deadline: { minutesBeforeFirstKickoff: 180 } });
/** A deadline at the first kickoff, so an hour and a half later than FPL's. */
const AT_KICKOFF = rulesWith({ deadline: { minutesBeforeFirstKickoff: 0 } });

describe("a commissioner's change of deadline", () => {
  test("to an earlier deadline that has already passed for gameweek 9 waits for gameweek 10", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, THREE_HOURS_BEFORE)).toBe(10);
    expect(await rulesIn(t, leagueId, 9)).toEqual(HELD_FIRST_RULES);
  });

  test("to a later deadline waits for gameweek 10 if gameweek 9 has begun under the old one", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: THREE_HOURS_BEFORE });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, AT_KICKOFF)).toBe(10);
    expect((await rulesIn(t, leagueId, 9)).deadline.minutesBeforeFirstKickoff).toBe(180);
  });

  test("under a deadline later than FPL's, made after FPL's but before the league's, applies from gameweek 9", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: HOUR_MS });
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: AT_KICKOFF });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, { ...AT_KICKOFF, format: "totalPoints" })).toBe(9);
  });

  test("ignores FPL's deadline moving: gameweek 9 is still to begin when FPL's has passed", async () => {
    await holdGameweeks(t, { next: 9 });
    await moveFplDeadline(t, 9, Date.now() - HOUR_MS);
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId)).toBe(9);
  });

  test("made while another waits for gameweek 10 waits for it too, so the waiting one can't override it", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId, THREE_HOURS_BEFORE);

    expect(await change(leagueId, structuredClone(HELD_FIRST_RULES))).toBe(10);
    expect(await rulesIn(t, leagueId, 9)).toEqual(HELD_FIRST_RULES);
    expect(await rulesIn(t, leagueId, 10)).toEqual(HELD_FIRST_RULES);
    expect(await latestRules(t, leagueId)).toEqual({ fromGameweek: 10, rules: HELD_FIRST_RULES, revision: await rulesRevision(t, leagueId) });
  });
});

test("League settings says a change waits for gameweek 10 once one already waits for it", async () => {
  await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
  const leagueId = await adminCreatesLeague(t);
  await change(leagueId, THREE_HOURS_BEFORE);

  const editor = await leagueSettingsOf(await actingAs(t, COMMISSIONER), leagueId);
  expect(editor?.changesFrom).toBe(10);
});

test("League settings' times take no minute, so a minute passing reads nothing again: only the judging moves on (#2008)", async () => {
  await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
  const leagueId = await adminCreatesLeague(t);

  const { changesFrom } = await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueSettings.settings, { leagueId });
  expect(changesFromAt(changesFrom, Date.now())).toBe(9);
  expect(changesFromAt(changesFrom, Date.now() + 2 * HOUR_MS)).toBe(10);
});

test(`with ${PL_GAMEWEEKS + 1} gameweeks held, League settings and a change still name the next gameweek not begun (#872)`, async () => {
  await holdGameweeks(t, { next: 9 });
  await holdGameweeksPastTheSeason(t, 1);
  const leagueId = await adminCreatesLeague(t);

  const editor = await leagueSettingsOf(await actingAs(t, COMMISSIONER), leagueId);
  expect(editor?.changesFrom).toBe(9);
  expect(await change(leagueId)).toBe(9);
});

// A change saved while a gameweek is under way acts from the next deadline in every read, never in
// the gameweek it was saved in (S03.11). trades.harness.ts's league: gameweek 4 is the latest begun,
// so a change waits for WAIVERS_NEXT; Ann holds the squad of SQUAD.length.
describe("a change saved mid-gameweek acts only from the next deadline (S03.11)", () => {
  let w: TradeLeague;
  beforeEach(async () => {
    w = await tradeLeague();
    await w.t.run((ctx) => recordPassedDeadlines(ctx));
  });

  const OLD_MAXIMUM = squadMaximumOf(HELD_FIRST_RULES);
  /** A squad maximum one under Ann's squad. */
  const SMALLER = withSquadMaximum(HELD_FIRST_RULES, SQUAD.length - 1);
  /** The commissioner saves `rules` now: from the next gameweek. */
  const saveNow = async (rules = SMALLER) => expect(await changeRules(w.t, w.leagueId, rules)).toBe(WAIVERS_NEXT);
  const asAnn = () => actingAs(w.t, ANN);

  test("S03.11 the squads' warnings", async () => {
    const annsWarnings = async () => (await (await asAnn()).query(api.squads.squads.squads, { leagueId: w.leagueId })).find(({ teamId }) => teamId === w.annsTeam)?.warnings;
    const overMaximum = { kind: "overMaximum", players: SQUAD.length, maximum: SQUAD.length - 1 };
    await saveNow();
    expect(await annsWarnings()).not.toContainEqual(overMaximum);

    await passNextDeadline(w.t);
    expect(await annsWarnings()).toContainEqual(overMaximum);
  });

  test("S03.11 My team's squad maximum", async () => {
    // holdGameweeks' away club, which My team's next fixtures name.
    await w.t.run((ctx) => ctx.db.insert("clubs", { code: 2, name: "Chelsea", shortName: "CHE" }));
    await saveNow();
    expect((await teamSquadOf(await asAnn(), w.leagueId)).squadMaximum).toBe(OLD_MAXIMUM);

    await passNextDeadline(w.t);
    expect((await teamSquadOf(await asAnn(), w.leagueId)).squadMaximum).toBe(SQUAD.length - 1);
  });

  test("S03.11 the Trades screen's squad maximum", async () => {
    await saveNow();
    expect((await tradesOf(await asAnn(), w.leagueId)).squadMaximum).toBe(OLD_MAXIMUM);

    await passNextDeadline(w.t);
    expect((await tradesOf(await asAnn(), w.leagueId)).squadMaximum).toBe(SQUAD.length - 1);
  });

  test("S03.11 whether the scouted player's squad is full", async () => {
    const squadFull = async () => (await (await asAnn()).query(api.scouting.yourPlayer.at, { leagueId: w.leagueId, playerCode: SAKA, now: Date.now() }))?.squadFull;
    await saveNow();
    expect(await squadFull()).toBe(false);

    await passNextDeadline(w.t);
    expect(await squadFull()).toBe(true);
  });

  test("S03.11 an offer's squad warnings", async () => {
    const annsOfferWarnings = async () => {
      const { offerId, warnings } = await w.offer(ANN, w.bobsTeam, [ANNS_FIRST_DROP], [SAKA, PALMER]);
      await w.withdraw(ANN, offerId);
      return warnings.find(({ teamId }) => teamId === w.annsTeam)?.warnings;
    };
    await saveNow();
    expect(await annsOfferWarnings()).toEqual([]);

    await passNextDeadline(w.t);
    expect(await annsOfferWarnings()).not.toEqual([]);
  });

  test("S03.11 the instructions a saved plan may hold", async () => {
    // An instruction no preset or classic formation holds, offered on the Christmas tree's one striker.
    const pair = { attacking: "bootItToTheBigMan", defensive: "clearIt" };
    const fewer = FIRST_INSTRUCTIONS.filter(({ key }) => key !== pair.attacking);
    const christmasTree = FIRST_PRESETS.find(({ name }) => name === "4-3-2-1")!.cells;
    const savePlan = async (name: string) =>
      (await asAnn()).mutation(api.lineup.savedPlans.save, { leagueId: w.leagueId, name, slots: [...christmasTree], instructions: pair });
    await saveNow({ ...HELD_FIRST_RULES, instructions: fewer });
    await savePlan("Wide");

    await passNextDeadline(w.t);
    await expectRefused(savePlan("Wide again"), pairRefusalWords({ side: "attacking", key: pair.attacking }, fewer));
  });
});

test("S03.11 a free agent pickup keeps the squad maximum of the gameweek under way until its deadline", async () => {
  const w = await waiverLeague();
  await w.t.run((ctx) => recordPassedDeadlines(ctx));
  expect(await changeRules(w.t, w.leagueId, withSquadMaximum(HELD_FIRST_RULES, SQUAD.length))).toBe(WAIVERS_NEXT);
  await w.runWaivers();
  await w.pickUp(ANN, SAKA);

  await w.gameweekEnds(WAIVERS_NEXT);
  await w.runWaivers();
  await expectRefused(w.pickUp(ANN, PALMER), pickUpRefusals.limits(nameOf(PALMER)));
  expect(await w.squadCodes(w.annsTeam)).not.toContain(PALMER);
});
