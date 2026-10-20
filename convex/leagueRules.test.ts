import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { FIRST_RULES } from "./firstRules";
import { refusals } from "./leagueAccess";
import { rulesInGameweek } from "./leagueRules";
import { holdGameweeks, rulesWith, TOTAL_POINTS } from "./leagueRules.harness";
import {
  ADMIN,
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
const inGameweek = (leagueId: Id<"leagues">, gameweek: number) =>
  t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));

describe("a new league", () => {
  test("starts on the first rules, from gameweek 1, which become the admin's defaults", async () => {
    const leagueId = await adminCreatesLeague(t);

    expect(await latest(leagueId)).toEqual({ fromGameweek: 1, rules: FIRST_RULES });
    expect(await (await actingAs(t, ADMIN)).query(api.leagueRules.defaults, {})).toEqual(FIRST_RULES);
  });

  test("starts on the admin's defaults as they are when it's made, and keeps its own after", async () => {
    const before = await adminCreatesLeague(t, 4, "Before");
    const admin = await actingAs(t, ADMIN);
    await admin.mutation(api.leagueRules.setDefaults, { rules: TOTAL_POINTS });
    const after = await adminCreatesLeague(t, 4, "After");

    expect((await latest(before))?.rules).toEqual(FIRST_RULES);
    expect((await latest(after))?.rules).toEqual(TOTAL_POINTS);
  });
});

test("two leagues hold different rules side by side", async () => {
  const first = await adminCreatesLeague(t, 4, "First");
  const second = await adminCreatesLeague(t, 4, "Second");
  await change(second);

  expect((await latest(first))?.rules.format).toBe("headToHead");
  expect((await latest(second))?.rules.format).toBe("totalPoints");
});

describe("a commissioner's change", () => {
  test("before gameweek 9's deadline applies from gameweek 9, and gameweek 8 keeps the old rules", async () => {
    await holdGameweeks(t, { lockedThrough: 8 });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId)).toBe(9);
    expect(await inGameweek(leagueId, 8)).toEqual(FIRST_RULES);
    expect(await inGameweek(leagueId, 9)).toEqual(TOTAL_POINTS);
    expect(await inGameweek(leagueId, 38)).toEqual(TOTAL_POINTS);
  });

  test("is filed for Mail with what changed and from when", async () => {
    await holdGameweeks(t, { lockedThrough: 8 });
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
    await holdGameweeks(t, { lockedThrough: 8 });
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

    await expect(change(leagueId, unsound)).rejects.toThrow("On the pitch, attack's minimum, 3, is above its maximum, 2.");
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

    await expect(change(leagueId, TOTAL_POINTS, MANAGERS[0])).rejects.toThrow(refusals.notRunner);
    expect((await latest(leagueId, MANAGERS[0]))?.rules).toEqual(FIRST_RULES);
  });
});

test("someone outside the league can't read its rules", async () => {
  const leagueId = await adminCreatesLeague(t);
  await expect(latest(leagueId, MANAGERS[1])).rejects.toThrow(refusals.notInLeague);
});

test("only the admin sets the defaults, and an unsound set is refused with the reason", async () => {
  await adminCreatesLeague(t);
  const commissioner = await actingAs(t, COMMISSIONER);
  await expect(commissioner.mutation(api.leagueRules.setDefaults, { rules: TOTAL_POINTS })).rejects.toThrow(refusals.notAdmin);

  const admin = await actingAs(t, ADMIN);
  const unsound = rulesWith({ deadline: { minutesBeforeFirstKickoff: -1 } });
  await expect(admin.mutation(api.leagueRules.setDefaults, { rules: unsound })).rejects.toThrow(
    "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not -1.",
  );
  expect(await admin.query(api.leagueRules.defaults, {})).toEqual(FIRST_RULES);
});

