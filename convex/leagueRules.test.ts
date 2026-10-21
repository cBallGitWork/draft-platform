import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { FIRST_RULES } from "./firstRules";
import { refusals } from "./leagueAccess";
import { rulesInGameweek } from "./leagueRules";
import type { LeagueRules } from "./leagueRulesShape";
import { scoreMatch } from "./scoring";
import { EXAMPLE_SET } from "./scoring.example";
import { expectRefused, holdGameweeks, rulesWith, TOTAL_POINTS } from "./leagueRules.harness";
import { HOUR_MS } from "./time";
import {
  actingAs,
  addManagers,
  adminCreatesLeague,
  COMMISSIONER,
  CO_COMMISSIONER,
  eventsIn,
  MANAGERS,
  type TestConvex,
} from "./leagues.harness";
import { fakeResend, resetSignInDeployment, signInDeployment } from "./signIn.harness";

// A league's rules as data (#25): each league holds its own, a new one starts on the admin's
// defaults, a commissioner's change applies from the next gameweek, and an unsound one is refused.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});
afterEach(resetSignInDeployment);

const change = async (leagueId: Id<"leagues">, rules = TOTAL_POINTS, email = COMMISSIONER) =>
  (await actingAs(t, email)).mutation(api.leagueRules.change, { leagueId, rules });
const latest = async (leagueId: Id<"leagues">, email = COMMISSIONER) =>
  (await actingAs(t, email)).query(api.leagueRules.latest, { leagueId });
const defaults = () => t.run(async (ctx) => (await ctx.db.query("defaultLeagueRules").unique())?.rules);
const inGameweek = (leagueId: Id<"leagues">, gameweek: number) =>
  t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));
/** A deadline three hours before the first kickoff, so an hour and a half earlier than FPL's. */
const THREE_HOURS_BEFORE = rulesWith({ deadline: { minutesBeforeFirstKickoff: 180 } });

describe("a new league", () => {
  test("starts on the first rules, from gameweek 1, which become the admin's defaults", async () => {
    const leagueId = await adminCreatesLeague(t);

    expect(await latest(leagueId)).toEqual({ fromGameweek: 1, rules: FIRST_RULES });
    expect(await defaults()).toEqual(FIRST_RULES);
  });

  test("starts on the admin's defaults as they are when it's made, and keeps its own after", async () => {
    const before = await adminCreatesLeague(t, 4, "Before");
    await t.mutation(internal.leagueRules.setDefaults, { rules: TOTAL_POINTS });
    const after = await adminCreatesLeague(t, 4, "After");

    expect((await latest(before))?.rules).toEqual(FIRST_RULES);
    expect((await latest(after))?.rules).toEqual(TOTAL_POINTS);
  });
});

test("two leagues hold different rules side by side, and the same match scores differently", async () => {
  const first = await adminCreatesLeague(t, 4, "First");
  const second = await adminCreatesLeague(t, 4, "Second");
  const priced = rulesWith({ format: "totalPoints", scoring: structuredClone(EXAMPLE_SET) as LeagueRules["scoring"] });
  await change(second, priced);

  expect((await latest(first))?.rules).toEqual(FIRST_RULES);
  expect((await latest(second))?.rules).toEqual(priced);
  const goalIn = async (leagueId: Id<"leagues">) =>
    scoreMatch({ minutes: 90, goals_scored: 1 }, (await inGameweek(leagueId, 1)).scoring, "defensiveMidfield").total;
  expect(await goalIn(first)).toBe(7);
  expect(await goalIn(second)).toBe(8);
});

describe("a commissioner's change", () => {
  test("before gameweek 9's deadline applies from gameweek 9, and gameweek 8 keeps the old rules", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId)).toBe(9);
    expect(await inGameweek(leagueId, 8)).toEqual(FIRST_RULES);
    expect(await inGameweek(leagueId, 9)).toEqual(TOTAL_POINTS);
    expect(await inGameweek(leagueId, 38)).toEqual(TOTAL_POINTS);
  });

  test("to an earlier deadline that has already passed for gameweek 9 waits for gameweek 10", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, THREE_HOURS_BEFORE)).toBe(10);
    expect(await inGameweek(leagueId, 9)).toEqual(FIRST_RULES);
  });

  test("to a later deadline waits for gameweek 10 if gameweek 9 has begun under the old one", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    await t.mutation(internal.leagueRules.setDefaults, { rules: THREE_HOURS_BEFORE });
    const leagueId = await adminCreatesLeague(t);
    const atKickoff = rulesWith({ deadline: { minutesBeforeFirstKickoff: 0 } });

    expect(await change(leagueId, atKickoff)).toBe(10);
    expect((await inGameweek(leagueId, 9)).deadline.minutesBeforeFirstKickoff).toBe(180);
  });

  test("made while another waits for gameweek 10 waits for it too, so the waiting one can't override it", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId, THREE_HOURS_BEFORE);

    expect(await change(leagueId, structuredClone(FIRST_RULES))).toBe(10);
    expect(await inGameweek(leagueId, 9)).toEqual(FIRST_RULES);
    expect(await inGameweek(leagueId, 10)).toEqual(FIRST_RULES);
    expect(await latest(leagueId)).toEqual({ fromGameweek: 10, rules: FIRST_RULES });
  });

  test("is filed for Mail with what changed and from when", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await change(leagueId, rulesWith({ format: "totalPoints", doubleGameweek: "bestMatch" }), CO_COMMISSIONER);

    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({
      by: CO_COMMISSIONER,
      kind: "rulesChanged",
      fromGameweek: 9,
      changed: ["format", "doubleGameweek"],
    });
  });

  test("a second change before the deadline replaces the first, and both are filed", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId);
    await change(leagueId, rulesWith({ tieBreaks: ["headToHead"] }));

    expect(await inGameweek(leagueId, 9)).toEqual(rulesWith({ tieBreaks: ["headToHead"] }));
    expect(await inGameweek(leagueId, 8)).toEqual(FIRST_RULES);
    const filed = (await eventsIn(t, leagueId)).filter((event) => event.kind === "rulesChanged");
    expect(filed.map((event) => event.kind === "rulesChanged" && event.changed)).toEqual([["format"], ["format", "tieBreaks"]]);
  });

  test("the same rules again change nothing and file nothing", async () => {
    const leagueId = await adminCreatesLeague(t);
    const eventsBefore = await eventsIn(t, leagueId);

    expect(await change(leagueId, structuredClone(FIRST_RULES))).toBe(1);
    expect(await eventsIn(t, leagueId)).toEqual(eventsBefore);
  });

  test("an unsound rule is refused with the reason, and nothing is saved", async () => {
    const leagueId = await adminCreatesLeague(t);
    const unsound = rulesWith({ areaLimits: { ...FIRST_RULES.areaLimits, attack: { minimum: 3, maximum: 2 } } });

    await expectRefused(change(leagueId, unsound), "On the pitch, attack's minimum, 3, is above its maximum, 2.");
    expect((await latest(leagueId))?.rules).toEqual(FIRST_RULES);
  });

  test("a rule of the wrong shape is refused before it is read", async () => {
    const leagueId = await adminCreatesLeague(t);
    const wrongShape = { ...FIRST_RULES, format: "knockout" } as unknown as typeof FIRST_RULES;

    await expect(change(leagueId, wrongShape)).rejects.toThrow(/knockout/);
  });

  test("is refused to a manager, who can still read the rules", async () => {
    const leagueId = await adminCreatesLeague(t);
    await addManagers(t, leagueId, [MANAGERS[0]]);

    await expectRefused(change(leagueId, TOTAL_POINTS, MANAGERS[0]), refusals.notRunner);
    expect((await latest(leagueId, MANAGERS[0]))?.rules).toEqual(FIRST_RULES);
  });
});

test("someone outside the league can't read its rules", async () => {
  const leagueId = await adminCreatesLeague(t);
  await expectRefused(latest(leagueId, MANAGERS[1]), refusals.notInLeague);
});

test("an unsound set of defaults is refused with the reason, and the defaults stay", async () => {
  await adminCreatesLeague(t);
  const unsound = rulesWith({ deadline: { minutesBeforeFirstKickoff: -1 } });

  await expectRefused(
    t.mutation(internal.leagueRules.setDefaults, { rules: unsound }),
    "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not -1.",
  );
  expect(await defaults()).toEqual(FIRST_RULES);
});

test("defaults set before any league is made are the first league's rules", async () => {
  await t.mutation(internal.leagueRules.setDefaults, { rules: TOTAL_POINTS });
  const leagueId = await adminCreatesLeague(t);

  expect((await latest(leagueId))?.rules).toEqual(TOTAL_POINTS);
});
