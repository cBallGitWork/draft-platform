import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { rulesInGameweek } from "../../../convex/rules/rulesHistory";
import type { StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { SITE_SCORING_VERSIONS_MOST, siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { SEASON_GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { expectRefused, holdGameweeks, rulesRevision, HELD_FIRST_RULES, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { ADMIN, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS } from "../../support/convex/leagues.harness";
import { everyArea } from "../../support/convex/scoring.example";
import {
  as,
  draftSavedAt,
  EDITED,
  EDITED_AGAIN,
  fixAs,
  inGameweek,
  kickoffOf,
  names,
  NOTICE,
  patch,
  saveDraftAs,
  siteRevision,
  t,
  TODAY,
  useSiteScoringDeployment,
  versions,
  viewAs,
} from "../../support/convex/siteScoring.harness";

// The site's scoring set and the rules editor's seam (spec/14, Who owns it, and Changes and
// corrections; #30, #354, #355): one set every league plays on, which everyone signed in reads and
// only the admin changes; here, reading it and the admin's fix, which applies at once but never to
// a gameweek already begun. Patches are in siteScoringPatches.test.ts.

useSiteScoringDeployment();

describe("reading it", () => {
  test("before any version, every gameweek plays the first set, and a fix would reach the next not kicked off", async () => {
    await holdGameweeks(t, { next: 9 });

    expect(await viewAs(ADMIN)).toEqual({ part: FIRST_SCORING, revision: null, changesFrom: 9, canEdit: true, versions: [], draft: null });
    for (const gameweek of SEASON_GAMEWEEKS) expect(await inGameweek(gameweek)).toEqual(FIRST_SCORING);
  });

  test("a commissioner, a co-commissioner and a manager read it, and may not change it", async () => {
    const leagueId = await adminCreatesLeague(t);
    await (await as(COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await addManagers(t, leagueId, [MANAGERS[0]]);

    for (const email of [COMMISSIONER, CO_COMMISSIONER, MANAGERS[0]]) {
      expect(await viewAs(email)).toMatchObject({ part: FIRST_SCORING, canEdit: false });
    }
  });

  test("someone signed out can't, nor change it", async () => {
    await expectRefused(t.query(api.scoring.siteScoring.view, { now: Date.now() }), refusals.signedOut);
    await expectRefused(t.mutation(api.scoring.siteScoring.fix, { scoring: EDITED, revision: null }), refusals.signedOut);
    await expectRefused(t.mutation(api.scoring.siteScoring.saveDraft, { scoring: EDITED, revision: null, draftSavedAt: null }), refusals.signedOut);
    await expectRefused(t.mutation(api.scoring.siteScoring.announce, { draftSavedAt: TODAY, takesEffectAt: TODAY + NOTICE }), refusals.signedOut);
    expect(await versions()).toBe(0);
  });
});

describe("a fix", () => {
  test("#355 Done: applies at once, from the next gameweek not kicked off, never to one already begun", async () => {
    await holdGameweeks(t, { next: 9 });

    expect(await fixAs(ADMIN, EDITED)).toBe(9);
    expect(await inGameweek(8)).toEqual(FIRST_SCORING);
    expect(await inGameweek(9)).toEqual(EDITED);
    expect(await viewAs(COMMISSIONER)).toMatchObject({ part: EDITED, versions: [{ name: "26_27.1", kind: "fix", takesEffectAt: TODAY }] });
  });

  test("of a patch already in force reaches the next gameweek, the patch's played ones kept", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, TODAY + NOTICE);
    vi.setSystemTime(kickoffOf(11) + HOUR_MS);

    expect(await fixAs(ADMIN, EDITED_AGAIN)).toBe(12);
    expect(await inGameweek(9)).toEqual(FIRST_SCORING);
    expect(await inGameweek(11)).toEqual(EDITED);
    expect(await inGameweek(12)).toEqual(EDITED_AGAIN);
    expect(await names()).toEqual(["26_27.1", "26_27.2"]);
  });

  test("while a patch waits to take effect is refused, naming it: the patch would undo the fix", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, TODAY + NOTICE);

    await expectRefused(fixAs(ADMIN, EDITED_AGAIN), siteScoringRefusals.fixWhileWaiting("26_27.1", TODAY + NOTICE));
    expect(await inGameweek(10)).toEqual(EDITED);
  });

  test("records no league's event: its letter is the site's (#356, patchAnnouncements.test.ts)", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    const events = await eventsIn(t, leagueId);

    await fixAs(ADMIN, EDITED);
    expect(await eventsIn(t, leagueId)).toEqual(events);
  });

  test("the same set again changes nothing", async () => {
    expect(await fixAs(ADMIN, structuredClone(FIRST_SCORING))).toBe(1);
    expect(await versions()).toBe(0);
  });

  test("made from a version saved over since is refused, saying when that was, and saves nothing", async () => {
    await holdGameweeks(t, { next: 9 });
    await fixAs(ADMIN, EDITED, null);
    const saved = (await siteRevision())!;
    const savedAt = await t.run(async (ctx) => (await ctx.db.get("siteScoring", saved))!._creationTime);

    await expectRefused(fixAs(ADMIN, structuredClone(FIRST_SCORING), null), siteScoringRefusals.changedSince(savedAt));
    expect(await inGameweek(9)).toEqual(EDITED);
  });

  test(`up to ${SITE_SCORING_VERSIONS_MOST} versions are held; one more is refused, and more held throws when read`, async () => {
    const holdVersions = (count: number) =>
      t.run(async (ctx) => {
        for (let index = 0; index < count; index += 1) {
          await ctx.db.insert("siteScoring", { scoring: structuredClone(FIRST_SCORING), kind: "fix", season: 2026, number: index + 1, announcedAt: 0, takesEffectAt: 0 });
        }
      });
    await holdVersions(SITE_SCORING_VERSIONS_MOST);

    await expectRefused(fixAs(ADMIN, EDITED), siteScoringRefusals.tooManyVersions);
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
    await (await as(COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await addManagers(t, leagueId, [MANAGERS[0]]);

    await expectRefused(fixAs(email, EDITED), refusals.notAdmin);
    expect(await versions()).toBe(0);
  });

  test("is refused as part of the league's rules, which no longer hold any scoring", async () => {
    const leagueId = await adminCreatesLeague(t);
    const withScoring = { ...TOTAL_POINTS, scoring: EDITED };

    await expect(
      (await as(COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId, rules: withScoring, revision: await rulesRevision(t, leagueId) }),
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
  test("is refused with the reason, as a fix or a draft, and nothing is saved", async () => {
    await expectRefused(fixAs(ADMIN, scoring), reason);
    await expectRefused(saveDraftAs(ADMIN, scoring), reason);
    expect(await versions()).toBe(0);
    expect(await draftSavedAt()).toBeNull();
  });
});

test("an own stat whose name and short code are its own is sound", async () => {
  await fixAs(ADMIN, scoringWithOwn({}));
  expect(await versions()).toBe(1);
});
