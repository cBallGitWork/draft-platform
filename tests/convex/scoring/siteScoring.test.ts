import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { rulesInGameweek } from "../../../convex/rules/leagueRules";
import type { StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { SITE_SCORING_VERSIONS_MOST, siteScoringInGameweek, siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SEASON_GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { expectRefused, holdGameweeks, rulesRevision, HELD_FIRST_RULES, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { centreOf, everyArea } from "../../support/convex/scoring.example";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The site's scoring set and the rules editor's seam (spec/14, Who owns it; #30, #354): one set
// every league plays on, which everyone signed in reads and only the admin changes, from the first
// gameweek none of whose matches has kicked off, a played gameweek keeping the set it had.

type Rule = StoredScoringSet["rules"][number];

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const viewAs = async (email: string) => (await actingAs(t, email)).query(api.scoring.siteScoring.view, { now: Date.now() });
/** The site's latest version, as a screen that loaded it now would carry it to a save. */
const siteRevision = () => t.run(async (ctx) => (await ctx.db.query("siteScoring").withIndex("by_fromGameweek").collect()).at(-1)?._id ?? null);
const changeAs = async (email: string, scoring: StoredScoringSet, revision?: Id<"siteScoring"> | null) =>
  (await actingAs(t, email)).mutation(api.scoring.siteScoring.change, { scoring, revision: revision === undefined ? await siteRevision() : revision });
const inGameweek = (gameweek: number) => t.run((ctx) => siteScoringInGameweek(ctx, gameweek));
const versions = () => t.run(async (ctx) => (await ctx.db.query("siteScoring").collect()).length);

/** The first scoring set with assists paying 4 and one more category, tackles at 1. */
const EDITED: StoredScoringSet = {
  ...structuredClone(FIRST_SCORING),
  rules: [
    ...FIRST_SCORING.rules.map((rule): Rule => (rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: 4 } } : structuredClone(rule))),
    { shape: "perAction", stat: "tackles", values: { all: 1 } },
  ],
};

describe("reading it", () => {
  test("before any save, every gameweek plays the first set, and a change would take effect from the next not kicked off", async () => {
    await holdGameweeks(t, { next: 9 });

    expect(await viewAs(ADMIN)).toEqual({ part: FIRST_SCORING, revision: null, changesFrom: 9, canEdit: true });
    for (const gameweek of SEASON_GAMEWEEKS) expect(await inGameweek(gameweek)).toEqual(FIRST_SCORING);
  });

  test("a commissioner, a co-commissioner and a manager read it, and may not change it", async () => {
    const leagueId = await adminCreatesLeague(t);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await addManagers(t, leagueId, [MANAGERS[0]]);

    for (const email of [COMMISSIONER, CO_COMMISSIONER, MANAGERS[0]]) {
      expect(await viewAs(email)).toMatchObject({ part: FIRST_SCORING, canEdit: false });
    }
  });

  test("someone signed out can't, nor change it", async () => {
    await expectRefused(t.query(api.scoring.siteScoring.view, { now: Date.now() }), refusals.signedOut);
    await expectRefused(t.mutation(api.scoring.siteScoring.change, { scoring: EDITED, revision: null }), refusals.signedOut);
    expect(await versions()).toBe(0);
  });
});

describe("the admin's change", () => {
  test("#354 Done: saves, for every league, from the next gameweek not kicked off; gameweek 8 keeps the first set", async () => {
    await holdGameweeks(t, { next: 9 });

    expect(await changeAs(ADMIN, EDITED)).toBe(9);
    expect(await inGameweek(8)).toEqual(FIRST_SCORING);
    expect(await inGameweek(9)).toEqual(EDITED);
    expect(await inGameweek(38)).toEqual(EDITED);
    expect(await viewAs(COMMISSIONER)).toMatchObject({ part: EDITED, revision: await siteRevision() });
  });

  test("#354 Done: two leagues with their own rules score the same match the same, by the set in force in that gameweek", async () => {
    await holdGameweeks(t, { next: 9 });
    const first = await adminCreatesLeague(t, 4, "First");
    const second = await adminCreatesLeague(t, 4, "Second");
    await (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId: second, rules: TOTAL_POINTS, revision: await rulesRevision(t, second) });
    await changeAs(ADMIN, EDITED);
    const assistIn = (gameweek: number) => async (leagueId: Id<"leagues">) => {
      expect(await t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek))).not.toHaveProperty("scoring");
      return scoreMatch({ minutes: 90, assists: 1 }, await inGameweek(gameweek), centreOf("midfield")).total;
    };

    expect(await Promise.all([first, second].map(assistIn(8)))).toEqual([2 + 3, 2 + 3]);
    expect(await Promise.all([first, second].map(assistIn(9)))).toEqual([2 + 4, 2 + 4]);
  });

  test("waits for a change already waiting for a later gameweek, so it can't be overridden by it", async () => {
    await holdGameweeks(t, { next: 9 });
    await t.run(async (ctx) => {
      await ctx.db.insert("siteScoring", { fromGameweek: 12, scoring: structuredClone(FIRST_SCORING) });
    });

    expect(await viewAs(ADMIN)).toMatchObject({ changesFrom: 12 });
    expect(await changeAs(ADMIN, EDITED)).toBe(12);
    expect(await inGameweek(12)).toEqual(EDITED);
  });

  test("the same set again changes nothing", async () => {
    expect(await changeAs(ADMIN, structuredClone(FIRST_SCORING))).toBe(1);
    expect(await versions()).toBe(0);
  });

  test("files no letter in any league: patches will announce it (#355)", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    const events = await eventsIn(t, leagueId);

    await changeAs(ADMIN, EDITED);
    expect(await eventsIn(t, leagueId)).toEqual(events);
  });

  test("made from a version saved over since is refused, saying when that was, and saves nothing", async () => {
    await holdGameweeks(t, { next: 9 });
    await changeAs(ADMIN, EDITED, null);
    const saved = (await siteRevision())!;
    const savedAt = await t.run(async (ctx) => (await ctx.db.get("siteScoring", saved))!._creationTime);

    await expectRefused(changeAs(ADMIN, structuredClone(FIRST_SCORING), null), siteScoringRefusals.changedSince(savedAt));
    expect(await inGameweek(9)).toEqual(EDITED);
  });

  test(`up to ${SITE_SCORING_VERSIONS_MOST} versions are held; one more is refused, and more held throws when read`, async () => {
    const holdVersions = (count: number) =>
      t.run(async (ctx) => {
        for (let index = 0; index < count; index += 1) await ctx.db.insert("siteScoring", { fromGameweek: 1, scoring: structuredClone(FIRST_SCORING) });
      });
    await holdVersions(SITE_SCORING_VERSIONS_MOST);

    await expectRefused(changeAs(ADMIN, EDITED), siteScoringRefusals.tooManyVersions);
    await holdVersions(1);
    await expect(inGameweek(1)).rejects.toThrow(`more than ${SITE_SCORING_VERSIONS_MOST} scoring versions`);
  });
});

describe("a commissioner's edit to the scoring (#354 Done)", () => {
  test.each([
    ["the commissioner", COMMISSIONER],
    ["the co-commissioner", CO_COMMISSIONER],
    ["a manager", MANAGERS[0]],
  ])("from %s is refused, and nothing is saved", async (_, email) => {
    const leagueId = await adminCreatesLeague(t);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await addManagers(t, leagueId, [MANAGERS[0]]);

    await expectRefused(changeAs(email, EDITED), refusals.notAdmin);
    expect(await versions()).toBe(0);
  });

  test("is refused as part of the league's rules, which no longer hold any scoring", async () => {
    const leagueId = await adminCreatesLeague(t);
    const withScoring = { ...TOTAL_POINTS, scoring: EDITED };

    await expect(
      (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: withScoring, revision: await rulesRevision(t, leagueId) }),
    ).rejects.toThrow(/scoring/);
    expect(await t.run((ctx) => rulesInGameweek(ctx, leagueId, 1))).toEqual(HELD_FIRST_RULES);
  });
});

const ONE_PER_3 = { every: 3, points: 1 };

/** A scoring set of one own stat, tackles won, named as `change` says. */
const scoringWithOwn = (change: Partial<{ name: string; shortCode: string }>): StoredScoringSet => ({
  rules: [{ shape: "perAction", stat: "own_tackles", values: { all: 1 } }],
  wholePointsOnly: false,
  ownStats: [{ stat: "own_tackles", name: "Tackles won", shortCode: "TW+", parts: [{ stat: "won_tackle", weight: 1 }], ...change }],
});

// Moved here from the league rules' check when the scoring became the site's (#354).
describe.each<[string, StoredScoringSet, string]>([
  [
    "a set whose whole points only meets a fractional value, naming the category",
    { ...structuredClone(EDITED), wholePointsOnly: true, rules: [{ shape: "perAction", stat: "tackles", values: { all: 0.5 } }] },
    "The scoring set can't be saved: the Tackles rule pays 0.5, but the set counts whole points only.",
  ],
  [
    "a set missing an area's value",
    { rules: [{ shape: "perCount", stat: "saves", values: { byArea: { ...everyArea(ONE_PER_3), attack: { every: 0, points: 1 } } } }], wholePointsOnly: false },
    "The scoring set can't be saved: the Saves rule in attack pays for every 0 actions; it must be more than 0.",
  ],
  [
    "a rule on a stat that doesn't exist, which would pay every player 0 in it (#135)",
    { rules: [{ shape: "perAction", stat: "goals_scroed", values: { all: 5 } }], wholePointsOnly: false },
    `The scoring set can't be saved: rule 1 of the scoring set scores "goals_scroed", which is neither a catalogue stat nor one of the set's own stats.`,
  ],
  [
    "an own stat named as a catalogue stat is, case and spaces aside",
    scoringWithOwn({ name: " won  TACKLE" }),
    'The scoring set can\'t be saved: the own stat own_tackles has the name " won  TACKLE", which the catalogue\'s Won tackle has.',
  ],
  [
    "an own stat with a catalogue stat's short code, case and spaces aside",
    scoringWithOwn({ shortCode: "a s" }),
    'The scoring set can\'t be saved: the own stat own_tackles has the short code "a s", which the catalogue\'s Assists has.',
  ],
])("%s", (_name, scoring, reason) => {
  test("is refused with the reason, and nothing is saved", async () => {
    await expectRefused(changeAs(ADMIN, scoring), reason);
    expect(await versions()).toBe(0);
  });
});

test("an own stat whose name and short code are its own is sound", async () => {
  await changeAs(ADMIN, scoringWithOwn({}));
  expect(await versions()).toBe(1);
});
