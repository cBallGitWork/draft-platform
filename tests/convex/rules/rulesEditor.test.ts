import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { rulesInGameweek, rulesRefusals } from "../../../convex/rules/leagueRules";
import { expectRefused, holdGameweeks, rulesRevision, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { refusals } from "../../../convex/shared/leagueAccess";

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const change = async (leagueId: Id<"leagues">, rules = TOTAL_POINTS) =>
  (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules, revision: await rulesRevision(t, leagueId) });
const latest = async (leagueId: Id<"leagues">) => (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId });
const inGameweek = (leagueId: Id<"leagues">, gameweek: number) => t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));

// The rules editor's seam (#30): the scoring set and the gameweek a change would take effect from,
// and a change of the scoring alone, saved as any change is.
describe("the rules editor", () => {
  type Scoring = LeagueRules["scoring"];
  type Rule = Scoring["rules"][number];
  const scoringOf = async (leagueId: Id<"leagues">, email = COMMISSIONER) =>
    (await actingAs(t, email)).query(api.rules.leagueRules.scoring, { leagueId, now: Date.now() });
  const changeScoring = async (leagueId: Id<"leagues">, scoring: Scoring, email = COMMISSIONER) =>
    (await actingAs(t, email)).mutation(api.rules.leagueRules.changeScoring, { leagueId, scoring, revision: await rulesRevision(t, leagueId) });
  /** The first scoring set with assists paying 4 and one more category, tackles at 1. */
  const EDITED: Scoring = {
    ...structuredClone(FIRST_RULES.scoring),
    rules: [
      ...FIRST_RULES.scoring.rules.map((rule): Rule => (rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: 4 } } : structuredClone(rule))),
      { shape: "perAction", stat: "tackles", values: { all: 1 } },
    ],
  };
  const rulesLetters = (leagueId: Id<"leagues">) =>
    t.run(async (ctx) =>
      (await ctx.db.query("letters").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).collect()).filter(
        (letter) => letter.to === COMMISSIONER && letter.subject.startsWith("The league's rules change"),
      ),
    );

  test("reads the latest scoring set and the next gameweek a change would take effect from", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);

    expect(await scoringOf(leagueId)).toEqual({ part: FIRST_RULES.scoring, revision: await rulesRevision(t, leagueId), changesFrom: 9 });
  });

  test("#30 Done: an edit saves, applies from the next gameweek only, and files one letter", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);

    expect(await changeScoring(leagueId, EDITED)).toBe(9);
    expect((await inGameweek(leagueId, 8)).scoring).toEqual(FIRST_RULES.scoring);
    expect((await inGameweek(leagueId, 9)).scoring).toEqual(EDITED);
    const letters = await rulesLetters(leagueId);
    expect(letters).toHaveLength(1);
    expect(letters[0].body).toBe(
      `${COMMISSIONER} changed the league's scoring, from gameweek 9. The scoring changed for Assists and Tackles.`,
    );
  });

  test("files the categories removed and whole points switched on", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    const whole: Scoring = { ...structuredClone(FIRST_RULES.scoring), rules: FIRST_RULES.scoring.rules.filter((rule) => rule.stat !== "own_goals"), wholePointsOnly: true };
    await changeScoring(leagueId, whole);

    expect((await eventsIn(t, leagueId)).at(-1)).toEqual({
      by: COMMISSIONER,
      kind: "rulesChanged",
      fromGameweek: 9,
      changed: ["scoring"],
      categories: ["Own goals"],
      wholePointsOnly: true,
    });
  });

  test("changes the scoring alone, keeping a change to the rest made meanwhile", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId, TOTAL_POINTS);
    await changeScoring(leagueId, EDITED);

    expect(await inGameweek(leagueId, 9)).toEqual({ ...TOTAL_POINTS, scoring: EDITED });
  });

  test("the same scoring again changes nothing and files nothing", async () => {
    const leagueId = await adminCreatesLeague(t);
    const eventsBefore = await eventsIn(t, leagueId);

    expect(await changeScoring(leagueId, structuredClone(FIRST_RULES.scoring))).toBe(1);
    expect(await eventsIn(t, leagueId)).toEqual(eventsBefore);
  });

  test("an unsound scoring set is refused with the reason, naming the category, and nothing is saved", async () => {
    const leagueId = await adminCreatesLeague(t);
    const fractional: Scoring = { ...structuredClone(EDITED), wholePointsOnly: true, rules: [{ shape: "perAction", stat: "tackles", values: { all: 0.5 } }] };

    await expectRefused(
      changeScoring(leagueId, fractional),
      "The scoring set can't be saved: the Tackles rule pays 0.5, but the league counts whole points only.",
    );
    expect((await latest(leagueId))?.rules).toEqual(FIRST_RULES);
  });

  test.each([
    ["the co-commissioner", CO_COMMISSIONER],
    ["the admin", ADMIN],
  ])("%s may read and change it as the commissioner may", async (_, email) => {
    const leagueId = await adminCreatesLeague(t);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });

    expect((await scoringOf(leagueId, email))?.part).toEqual(FIRST_RULES.scoring);
    await changeScoring(leagueId, EDITED, email);
    expect((await latest(leagueId))?.rules.scoring).toEqual(EDITED);
  });

  test("a manager may neither read it nor change it", async () => {
    const leagueId = await adminCreatesLeague(t);
    await addManagers(t, leagueId, [MANAGERS[0]]);

    await expectRefused(scoringOf(leagueId, MANAGERS[0]), refusals.notRunner);
    await expectRefused(changeScoring(leagueId, EDITED, MANAGERS[0]), refusals.notRunner);
    expect((await latest(leagueId))?.rules).toEqual(FIRST_RULES);
  });

  test("a league made before leagues held rules has none to read, and its scoring can't be changed", async () => {
    const leagueId = await adminCreatesLeague(t);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.delete("leagueRules", row._id);
    });

    expect(await scoringOf(leagueId)).toBeNull();
    await expectRefused(changeScoring(leagueId, EDITED), rulesRefusals.noRules);
  });
});
