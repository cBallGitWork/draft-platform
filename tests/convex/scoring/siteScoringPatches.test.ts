import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { seasonStartYear } from "../../../convex/football/football";
import { rulesInGameweek } from "../../../convex/rules/rulesHistory";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { PATCH_NOTICE_DAYS, siteScoringRefusals, versionName } from "../../../convex/scoring/siteScoring";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { SEASON_GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { expectRefused, holdGameweeks, rulesRevision, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { ADMIN, addManagers, adminCreatesLeague, COMMISSIONER, eventsIn, MANAGERS } from "../../support/convex/leagues.harness";
import { centreOf } from "../../support/convex/scoring.example";
import {
  announceAs,
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

// Patches to the site's scoring set (spec/14, Changes and corrections; #355): saved as a draft,
// which changes nothing, then announced at least a week before the moment it takes effect, a
// gameweek already begun keeping the version it had; and every version's name, 26_27.1, its number
// starting again each season.

useSiteScoringDeployment();

describe("a draft patch", () => {
  test("#355 Done: changes nothing, and only the admin sees it", async () => {
    await holdGameweeks(t, { next: 9 });

    expect(await saveDraftAs(ADMIN, EDITED)).toBe(TODAY);
    for (const gameweek of SEASON_GAMEWEEKS) expect(await inGameweek(gameweek)).toEqual(FIRST_SCORING);
    expect(await versions()).toBe(0);
    expect(await viewAs(ADMIN)).toMatchObject({ part: FIRST_SCORING, revision: null, draft: { part: EDITED, savedAt: TODAY } });
    expect(await viewAs(COMMISSIONER)).toMatchObject({ draft: null });
  });

  test("saved again replaces the draft", async () => {
    await saveDraftAs(ADMIN, EDITED);
    vi.setSystemTime(TODAY + HOUR_MS);
    await saveDraftAs(ADMIN, EDITED_AGAIN);

    expect(await viewAs(ADMIN)).toMatchObject({ draft: { part: EDITED_AGAIN, savedAt: TODAY + HOUR_MS } });
  });

  test("saved over a draft saved since it was opened is refused, saying when that was", async () => {
    await saveDraftAs(ADMIN, EDITED);

    await expectRefused(saveDraftAs(ADMIN, EDITED_AGAIN, null), siteScoringRefusals.draftChangedSince(TODAY, undefined));
    expect(await viewAs(ADMIN)).toMatchObject({ draft: { part: EDITED } });
  });

  test("made from a version announced over since is refused", async () => {
    await fixAs(ADMIN, EDITED);
    const fixedAt = await t.run(async (ctx) => (await ctx.db.query("siteScoring").first())!._creationTime);

    await expectRefused(
      (await as(ADMIN)).mutation(api.scoring.siteScoring.saveDraft, { scoring: EDITED_AGAIN, revision: null, draftSavedAt: null }),
      siteScoringRefusals.changedSince(fixedAt, undefined),
    );
  });

  test.each([
    ["the commissioner", COMMISSIONER],
    ["a manager", MANAGERS[0]],
  ])("from %s is refused", async (_, email) => {
    const leagueId = await adminCreatesLeague(t);
    await addManagers(t, leagueId, [MANAGERS[0]]);

    await expectRefused(saveDraftAs(email, EDITED), refusals.notAdmin);
    expect(await draftSavedAt()).toBeNull();
  });

  test("that would score wrong is refused with the reason", async () => {
    const fractional = { ...structuredClone(EDITED), wholePointsOnly: true, rules: [{ shape: "perAction" as const, stat: "tackles", values: { all: 0.5 } }] };

    await expectRefused(saveDraftAs(ADMIN, fractional), "The scoring set can't be saved: the Tackles rule is worth 0.5, but the set counts whole points only.");
    expect(await draftSavedAt()).toBeNull();
  });
});

describe("announcing a patch", () => {
  test(`#355 Done: under ${PATCH_NOTICE_DAYS} days out is refused, and the draft stays a draft`, async () => {
    await saveDraftAs(ADMIN, EDITED);

    await expectRefused(announceAs(ADMIN, TODAY + NOTICE - 1), siteScoringRefusals.tooSoon(TODAY + NOTICE, undefined));
    expect(await versions()).toBe(0);
    expect(await draftSavedAt()).toBe(TODAY);
  });

  test(`#355 Done: exactly ${PATCH_NOTICE_DAYS} days out takes effect from its deadline, for every league; the gameweek before keeps the first set`, async () => {
    await holdGameweeks(t, { next: 9 });
    const deadline = TODAY + NOTICE;
    expect(deadline).toBeGreaterThan(kickoffOf(9));
    expect(deadline).toBeLessThan(kickoffOf(10));

    expect(await patch(EDITED, deadline)).toEqual({ name: "26_27.1", fromGameweek: 10 });
    expect(await inGameweek(9)).toEqual(FIRST_SCORING);
    expect(await inGameweek(10)).toEqual(EDITED);
    expect(await inGameweek(38)).toEqual(EDITED);
    expect(await draftSavedAt()).toBeNull();
    expect(await viewAs(COMMISSIONER)).toMatchObject({
      part: EDITED,
      revision: await siteRevision(),
      versions: [{ name: "26_27.1", kind: "patch", takesEffectAt: deadline }],
    });
  });

  test("a deadline at a gameweek's first kickoff reaches that gameweek", async () => {
    await holdGameweeks(t, { next: 9 });

    expect(await patch(EDITED, kickoffOf(10))).toMatchObject({ fromGameweek: 10 });
    expect(await inGameweek(10)).toEqual(EDITED);
  });

  test("#355 Done: played gameweeks score by their version, a re-score after the patch lands included", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, TODAY + NOTICE);
    vi.setSystemTime(kickoffOf(12));

    expect(await inGameweek(9)).toEqual(FIRST_SCORING);
    expect(await inGameweek(10)).toEqual(EDITED);
  });

  test("two leagues with their own rules hold no scoring set, so a match is priced by the site's version in force in that gameweek (their tables: twoLeagues.test.ts)", async () => {
    await holdGameweeks(t, { next: 9 });
    const first = await adminCreatesLeague(t, 4, "First");
    const second = await adminCreatesLeague(t, 4, "Second");
    await (await as(COMMISSIONER)).mutation(api.rules.leagueRules.change, { leagueId: second, rules: TOTAL_POINTS, revision: await rulesRevision(t, second) });
    await patch(EDITED, TODAY + NOTICE);
    const assistIn = (gameweek: number) => async (leagueId: Id<"leagues">) => {
      expect(await t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek))).not.toHaveProperty("scoring");
      return scoreMatch({ minutes: 90, assists: 1 }, await inGameweek(gameweek), centreOf("midfield")).total;
    };

    expect(await Promise.all([first, second].map(assistIn(9)))).toEqual([2 + 3, 2 + 3]);
    expect(await Promise.all([first, second].map(assistIn(10)))).toEqual([2 + 4, 2 + 4]);
  });

  test("records no league's event: its letter is the site's (#356, patchAnnouncements.test.ts)", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    const events = await eventsIn(t, leagueId);

    await patch(EDITED, TODAY + NOTICE);
    expect(await eventsIn(t, leagueId)).toEqual(events);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY])("at %s is refused, as no moment", async (takesEffectAt) => {
    await saveDraftAs(ADMIN, EDITED);

    await expectRefused(announceAs(ADMIN, takesEffectAt), siteScoringRefusals.notAMoment);
    expect(await versions()).toBe(0);
  });

  test("with no draft is refused", async () => {
    await expectRefused(announceAs(ADMIN, TODAY + NOTICE, TODAY), siteScoringRefusals.noDraft);
  });

  test("of a draft saved over since it was opened is refused", async () => {
    await saveDraftAs(ADMIN, EDITED);
    vi.setSystemTime(TODAY + HOUR_MS);
    await saveDraftAs(ADMIN, EDITED_AGAIN);

    await expectRefused(announceAs(ADMIN, TODAY + 2 * NOTICE, TODAY), siteScoringRefusals.draftChangedSince(TODAY + HOUR_MS, undefined));
    expect(await versions()).toBe(0);
  });

  test("of a draft made before a version announced since is refused, naming it", async () => {
    await saveDraftAs(ADMIN, EDITED_AGAIN);
    await fixAs(ADMIN, EDITED);

    await expectRefused(announceAs(ADMIN, TODAY + NOTICE), siteScoringRefusals.draftOvertaken("26_27.1"));
    expect(await versions()).toBe(1);
  });

  test("of a draft that changes nothing is refused", async () => {
    await saveDraftAs(ADMIN, structuredClone(FIRST_SCORING));

    await expectRefused(announceAs(ADMIN, TODAY + NOTICE), siteScoringRefusals.draftUnchanged);
  });

  test("to take effect before a patch already announced is refused", async () => {
    await patch(EDITED, TODAY + 2 * NOTICE);
    await saveDraftAs(ADMIN, EDITED_AGAIN);

    await expectRefused(announceAs(ADMIN, TODAY + NOTICE), siteScoringRefusals.beforeWaiting("26_27.1", TODAY + 2 * NOTICE, undefined));
    expect(await announceAs(ADMIN, TODAY + 3 * NOTICE)).toMatchObject({ name: "26_27.2" });
  });

  test("from anyone but the admin is refused", async () => {
    await adminCreatesLeague(t);
    await saveDraftAs(ADMIN, EDITED);

    await expectRefused(announceAs(COMMISSIONER, TODAY + NOTICE), refusals.notAdmin);
    expect(await versions()).toBe(0);
  });
});

describe("names", () => {
  test("#355 Done: the number goes up within a season and starts again at 1 in the next", async () => {
    await fixAs(ADMIN, EDITED);
    await patch(EDITED_AGAIN, TODAY + NOTICE);
    vi.setSystemTime(TODAY + 2 * NOTICE);
    await fixAs(ADMIN, EDITED);
    await patch(EDITED_AGAIN, Date.parse("2027-07-01T00:00:00Z"));

    expect(await names()).toEqual(["26_27.1", "26_27.2", "26_27.3", "27_28.1"]);
  });

  test("a version is named for the season it takes effect in, not the one it is announced in", async () => {
    vi.setSystemTime(Date.parse("2027-06-20T12:00:00Z"));

    expect(await patch(EDITED, Date.parse("2027-06-30T23:59:59Z"))).toMatchObject({ name: "26_27.1" });
    await saveDraftAs(ADMIN, EDITED_AGAIN);
    expect(await announceAs(ADMIN, Date.parse("2027-07-01T00:00:00Z"))).toMatchObject({ name: "27_28.1" });
  });

  test("a season runs from 1 July to 30 June, and its name's years are two digits each", () => {
    expect(seasonStartYear(Date.parse("2027-06-30T23:59:59.999Z"))).toBe(2026);
    expect(seasonStartYear(Date.parse("2027-07-01T00:00:00Z"))).toBe(2027);
    expect(versionName({ season: 2026, number: 1 })).toBe("26_27.1");
    expect(versionName({ season: 2099, number: 12 })).toBe("99_00.12");
    expect(versionName({ season: 2105, number: 3 })).toBe("05_06.3");
  });
});
