import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { checkOwnStatsAgainstCatalogue } from "../../../convex/scoring/ownStats";
import { siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { expectRefused } from "../../support/convex/test.harness";
import { ADMIN } from "../../support/convex/leagues.harness";
import { TACKLES_AND_CLEARANCES } from "../../support/convex/scoring.example";
import { draftSavedAt, EDITED, fixAs, saveDraftAs, useSiteScoringDeployment, versions } from "../../support/convex/siteScoring.harness";

// Saving the site's scoring refuses an unsound set with the reason, and only that (#354): a
// bug in the check is the bug it is, never shown to the admin as a reason. Each case below is one
// of scoringSet.ts's, ruleChecks.ts's and ownStats.ts's reasons a set that passes Convex's shape
// check can still meet; the rest, and these, are swept in scoringSet.test.ts.

// The check as it is, but a test can make it throw what a bug would.
vi.mock("../../../convex/scoring/ownStats", async (actual) => {
  const own = await actual<typeof import("../../../convex/scoring/ownStats")>();
  return { ...own, checkOwnStatsAgainstCatalogue: vi.fn(own.checkOwnStatsAgainstCatalogue) };
});

useSiteScoringDeployment();

type Rule = StoredScoringSet["rules"][number];
const setOf = (...rules: Rule[]): StoredScoringSet => ({ rules, wholePointsOnly: false });
const tackles = (rule: Partial<Extract<Rule, { shape: "perAction" }>> = {}): Rule => ({ shape: "perAction", stat: "tackles", values: { all: 1 }, ...rule });
const tackling = { parts: [{ stat: "tackles", weight: 1 }], bars: [1] };
const anchor = (parts: { stat: string; weight: number }[]) => ({ role: "anchor", bonus: { parts, bars: [1] }, cost: tackling });
const roles = (roles: StoredScoringSet["roles"]): StoredScoringSet => ({ ...setOf(), roles });
type StoredOwnStat = NonNullable<StoredScoringSet["ownStats"]>[number];
const ownWith = (...ownStats: Partial<StoredOwnStat>[]): StoredScoringSet => ({
  ...setOf(),
  ownStats: ownStats.map((change) => ({ ...TACKLES_AND_CLEARANCES, parts: [...TACKLES_AND_CLEARANCES.parts], ...change })),
});
const T_C = TACKLES_AND_CLEARANCES.stat;
const minutesBands = (bands: { atLeast: number; points: number }[]): Rule => ({ shape: "bands", stat: "minutes", stack: false, values: { all: bands } });

describe.each<[StoredScoringSet, string]>([
  [roles([{ role: "", bonus: tackling, cost: tackling }]), "a role's scoring names no role"],
  [roles([anchor(tackling.parts), anchor(tackling.parts)]), 'the role "anchor" is scored twice'],
  [roles([anchor([{ stat: "goals_scroed", weight: 1 }])]), `the role "anchor"'s bonus adds "goals_scroed", which is neither a catalogue stat nor one of the set's own stats`],
  [roles([anchor([{ stat: "tackles", weight: 1 }, { stat: "tackles", weight: 1 }])]), `the role "anchor"'s bonus adds Tackles twice`],
  [setOf(tackles({ stat: "" })), "rule 1 of the scoring set names no stat"],
  [
    setOf(
      minutesBands([
        { atLeast: 60, points: 1 },
        { atLeast: 60, points: 2 },
      ]),
    ),
    "the Minutes rule has two bands at one threshold",
  ],
  [setOf(tackles({ limit: { all: { max: 1, min: 2 } } })), "the Tackles rule's points limit is worth at least 2, more than its most, 1"],
  [setOf(tackles({ minMinutes: { all: -1 } })), "the Tackles rule's minimum minutes is -1; it can't be less than 0"],
  [setOf(tackles({ values: { all: 0.25 } })), "the Tackles rule is worth 0.25; points are kept in tenths"],
  [ownWith({ stat: "" }), "own stat 1 has no key"],
  [ownWith({ stat: "tackles" }), `the own stat tackles has a key that doesn't start with "league:"`],
  [ownWith({}, {}), `the own stat ${T_C} is made twice`],
  [ownWith({ name: " " }), `the own stat ${T_C} has no name`],
  [ownWith({}, { stat: "league:other" }), 'the own stat league:other has the name "Tackles and clearances", which another own stat has'],
  [ownWith({ parts: [] }), `the own stat ${T_C} adds up no stats`],
  [ownWith({ parts: [{ stat: "goals_scroed", weight: 1 }] }), `the own stat ${T_C} adds "goals_scroed", which isn't a catalogue stat`],
])("unsound set %#", (scoring, reason) => {
  test("is refused with the reason, as a fix or a draft, and nothing is saved", async () => {
    await expectRefused(fixAs(ADMIN, scoring), siteScoringRefusals.unsound(reason));
    await expectRefused(saveDraftAs(ADMIN, scoring), siteScoringRefusals.unsound(reason));
    expect(await versions()).toBe(0);
    expect(await draftSavedAt()).toBeNull();
  });
});

test("a bug in the check is thrown as itself, never refused as a reason, and nothing is saved", async () => {
  const BUG = "Cannot read properties of undefined (reading 'name')";
  vi.mocked(checkOwnStatsAgainstCatalogue).mockImplementationOnce(() => {
    throw new TypeError(BUG);
  });

  const error = await fixAs(ADMIN, EDITED).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).not.toBeInstanceOf(ConvexError);
  expect((error as Error).message).toContain(BUG);
  expect(await versions()).toBe(0);
});
