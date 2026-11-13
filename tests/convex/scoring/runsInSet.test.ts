import { describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_RUNS } from "../../../convex/scoring/draftedRoleRuns";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { validateScoringSet } from "../../../convex/scoring/scoringSet";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { EDITED, holdSiteScoring, inGameweek, lettersCount, NOTICE, patch, t, TODAY, useSiteScoringDeployment, versions } from "../../support/convex/siteScoring.harness";

// Each role's run is held in the site's scoring set, beside the roles' scoring, so an announced
// patch can change it (spec/05 Runs, `S05.8`; Craig, 7 Nov 2026, on #886: "Yes change role arrow
// allowed").

const withRuns = (runs: unknown) => ({ ...FIRST_SCORING, runs });

// S05.8
describe("a set's runs", () => {
  test("the first runs are sound, and a set may hold none", () => {
    expect(() => validateScoringSet(withRuns(FIRST_RUNS))).not.toThrow();
    expect(() => validateScoringSet(withRuns([]))).not.toThrow();
  });

  test.each([
    ["not a list", { role: "stopper" }, "a scoring set's runs must be a list"],
    ["no role", [{ role: "", path: [{ forward: 9, across: 0 }] }], "a run names no role"],
    [
      "one role twice",
      [
        { role: "stopper", path: [{ forward: 9, across: 0 }] },
        { role: "stopper", path: [{ forward: 12, across: 0 }] },
      ],
      'the role "stopper" has two runs',
    ],
    ["no point", [{ role: "stopper", path: [] }], `the role "stopper"'s run goes through no point`],
    ["a point that isn't a number", [{ role: "stopper", path: [{ forward: "9", across: 0 }] }], `the role "stopper"'s run goes forward "9", not a number`],
  ])("%s is refused, with the reason", (_what, runs, reason) => {
    expect(() => validateScoringSet(withRuns(runs))).toThrow(reason);
  });
});

// S05.8
describe("the first runs go into the site's set (addFirstRuns)", () => {
  useSiteScoringDeployment();
  const addFirstRuns = () => t.mutation(internal.scoring.firstRolesVersion.addFirstRuns, {});

  test("from the next gameweek not begun, the set as it stands kept, with no letter, and only once", async () => {
    await holdGameweeks(t, { next: 9 });
    await t.run((ctx) => holdSiteScoring(ctx, { scoring: EDITED, kind: "fix", at: TODAY - 1 }));

    expect(await addFirstRuns()).toEqual({ name: "26_27.2", fromGameweek: 9 });
    expect((await inGameweek(8)).runs).toBeUndefined();
    expect(await inGameweek(9)).toEqual({ ...EDITED, runs: FIRST_RUNS });
    expect(await lettersCount(t)).toBe(0);
    expect(await addFirstRuns()).toBeNull();
    expect(await versions()).toBe(2);
  });

  test("a run a patch has changed is kept, and only the runs the set lacks are added", async () => {
    await holdGameweeks(t, { next: 9 });
    const changed = { role: "stopper", path: [{ forward: 12, across: 0 }] };
    await t.run((ctx) => holdSiteScoring(ctx, { scoring: { ...EDITED, runs: [changed] }, kind: "fix", at: TODAY - 1 }));

    await addFirstRuns();
    const runs = (await inGameweek(9)).runs ?? [];
    expect(runs.find(({ role }) => role === "stopper")).toEqual(changed);
    expect(runs).toHaveLength(FIRST_RUNS.length);
  });

  test("while a patch made without them waits to take effect, they aren't added, so it can't drop them", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, TODAY + NOTICE);

    await expect(addFirstRuns()).rejects.toThrow(/waits to take effect/);
    expect(await versions()).toBe(1);
  });
});
