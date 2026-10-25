import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { SITE_SCORING_VERSIONS_MOST, siteScoringInGameweek, siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { refusals } from "../../../convex/shared/leagueAccess";
import { SEASON_GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { expectRefused, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, eventsIn, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
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
});
