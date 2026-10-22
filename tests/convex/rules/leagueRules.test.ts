import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { refusals } from "../../../convex/shared/leagueAccess";
import { rulesInGameweek } from "../../../convex/rules/leagueRules";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { centreOf, EXAMPLE_SET } from "../../support/convex/scoring.example";
import { expectRefused, holdGameweeks, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import {
  actingAs,
  addManagers,
  adminCreatesLeague,
  COMMISSIONER,
  CO_COMMISSIONER,
  eventsIn,
  MANAGERS,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A league's rules as data (#25): each league holds its own, a new one starts on the admin's
// defaults, a commissioner's change applies from the next gameweek, and an unsound one is refused.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const change = async (leagueId: Id<"leagues">, rules = TOTAL_POINTS, email = COMMISSIONER) =>
  (await actingAs(t, email)).mutation(api.rules.leagueRules.change, { leagueId, rules });
const latest = async (leagueId: Id<"leagues">, email = COMMISSIONER) =>
  (await actingAs(t, email)).query(api.rules.leagueRules.latest, { leagueId });
const defaults = () => t.run(async (ctx) => (await ctx.db.query("defaultLeagueRules").unique())?.rules);
const inGameweek = (leagueId: Id<"leagues">, gameweek: number) =>
  t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));

describe("a new league", () => {
  test("starts on the first rules, from gameweek 1, which become the admin's defaults", async () => {
    const leagueId = await adminCreatesLeague(t);

    expect(await latest(leagueId)).toEqual({ fromGameweek: 1, rules: FIRST_RULES });
    expect(await defaults()).toEqual(FIRST_RULES);
  });

  test("starts on the admin's defaults as they are when it's made, and keeps its own after", async () => {
    const before = await adminCreatesLeague(t, 4, "Before");
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: TOTAL_POINTS });
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
    scoreMatch({ minutes: 90, goals_scored: 1 }, (await inGameweek(leagueId, 1)).scoring, centreOf("defensiveMidfield")).total;
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

  test("is filed for Mail with what changed and from when", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    const commissioner = await actingAs(t, COMMISSIONER);
    await commissioner.mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
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

  test("the odd team out is changed like any other rule, and only to a bye or the league's average", async () => {
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId, rulesWith({ oddTeamOut: "bye" }));
    expect((await latest(leagueId))?.rules.oddTeamOut).toBe("bye");

    const unknown = { ...FIRST_RULES, oddTeamOut: "sitOut" } as unknown as LeagueRules;
    await expect(change(leagueId, unknown)).rejects.toThrow(/sitOut/);
  });

  test("games a gameweek are changed like any other rule, and refused, with the reason, below 1", async () => {
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId, rulesWith({ gamesPerGameweek: 2 }));
    expect((await latest(leagueId))?.rules.gamesPerGameweek).toBe(2);

    await expectRefused(
      change(leagueId, rulesWith({ gamesPerGameweek: 0 })),
      "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 0.",
    );
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
    t.mutation(internal.rules.leagueRules.setDefaults, { rules: unsound }),
    "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not -1.",
  );
  expect(await defaults()).toEqual(FIRST_RULES);
});

test("defaults set before any league is made are the first league's rules", async () => {
  await t.mutation(internal.rules.leagueRules.setDefaults, { rules: TOTAL_POINTS });
  const leagueId = await adminCreatesLeague(t);

  expect((await latest(leagueId))?.rules).toEqual(TOTAL_POINTS);
});
