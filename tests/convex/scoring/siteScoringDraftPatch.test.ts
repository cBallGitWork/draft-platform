import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ADMIN, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS } from "../../support/convex/leagues.harness";
import {
  announceAs,
  as,
  draftSavedAt,
  EDITED,
  fixAs,
  inGameweek,
  kickoffOf,
  NOTICE,
  patch,
  saveDraftAs,
  t,
  TODAY,
  useSiteScoringDeployment,
  versions,
  viewAs,
} from "../../support/convex/siteScoring.harness";

// The rules editor's patches (Craig, 6 Nov 2026, on #368): a fix carried into the draft patch, the
// gameweeks a patch can take effect from, a row for every version, and an announced patch
// withdrawn back to a draft.

useSiteScoringDeployment();

type Rule = StoredScoringSet["rules"][number];
const withAssists = (set: StoredScoringSet, points: number): StoredScoringSet => ({
  ...structuredClone(set),
  rules: set.rules.map((rule): Rule => (rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: points } } : structuredClone(rule))),
});
const withPenaltiesSaved = (set: StoredScoringSet, points: number): StoredScoringSet => ({
  ...structuredClone(set),
  rules: set.rules.map((rule): Rule => (rule.stat === "penalties_saved" ? { shape: "perAction", stat: "penalties_saved", values: { all: points } } : structuredClone(rule))),
});
const withdrawAs = async (email: string, versionId: Id<"siteScoring">) => (await as(email)).mutation(api.scoring.siteScoring.withdraw, { versionId });
const latestId = async () => (await viewAs(ADMIN)).versions.at(-1)!.id;
const subjects = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).map((row) => [row.to, row.subject] as const));

describe("a fix while a draft patch is saved", () => {
  test("goes into the draft too, where the draft doesn't change that value", async () => {
    await holdGameweeks(t, { next: 9 });
    await saveDraftAs(ADMIN, withPenaltiesSaved(FIRST_SCORING, 6));

    await fixAs(ADMIN, withAssists(FIRST_SCORING, 4));

    expect((await viewAs(ADMIN)).draft).toEqual({ part: withPenaltiesSaved(withAssists(FIRST_SCORING, 4), 6), savedAt: TODAY });
  });

  test("leaves a value the draft changes as the draft has it", async () => {
    await holdGameweeks(t, { next: 9 });
    await saveDraftAs(ADMIN, withAssists(FIRST_SCORING, 5));

    await fixAs(ADMIN, withAssists(FIRST_SCORING, 4));

    expect((await viewAs(ADMIN)).draft?.part).toEqual(withAssists(FIRST_SCORING, 5));
  });

  test("leaves the draft made from the fix, so it can still be announced", async () => {
    await holdGameweeks(t, { next: 9 });
    await saveDraftAs(ADMIN, withPenaltiesSaved(FIRST_SCORING, 6));
    await fixAs(ADMIN, withAssists(FIRST_SCORING, 4));

    expect(await announceAs(ADMIN, TODAY + NOTICE)).toMatchObject({ name: "26_27.2" });
    expect(await inGameweek(10)).toEqual(withPenaltiesSaved(withAssists(FIRST_SCORING, 4), 6));
  });

  test("with no draft saved makes none", async () => {
    await fixAs(ADMIN, EDITED);

    expect(await draftSavedAt()).toBeNull();
  });
});

describe("the gameweeks a patch can take effect from", () => {
  test(`are those kicking off at least 7 days away, each at its first kickoff`, async () => {
    // Gameweek 9 kicks off in 6 days, 10 in 13.
    await holdGameweeks(t, { next: 9 });

    const offered = (await viewAs(ADMIN)).patchGameweeks;
    expect(offered[0]).toEqual({ gameweek: 10, takesEffectAt: kickoffOf(10) });
    expect(offered.map((each) => each.gameweek)).toEqual(Array.from({ length: 29 }, (_, index) => 10 + index));
  });

  test("a gameweek offered is one announce takes, from that gameweek", async () => {
    await holdGameweeks(t, { next: 9 });
    const [first] = (await viewAs(ADMIN)).patchGameweeks;

    expect(await patch(EDITED, first.takesEffectAt)).toEqual({ name: "26_27.1", fromGameweek: 10 });
    expect(await inGameweek(9)).toEqual(FIRST_SCORING);
    expect(await inGameweek(10)).toEqual(EDITED);
  });

  test("never one before a patch already announced", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, kickoffOf(12));

    expect((await viewAs(ADMIN)).patchGameweeks[0]).toEqual({ gameweek: 12, takesEffectAt: kickoffOf(12) });
  });

  test("are the admin's alone", async () => {
    await holdGameweeks(t, { next: 9 });

    expect((await viewAs(COMMISSIONER)).patchGameweeks).toEqual([]);
  });
});

test("every version has a row: its name, patch or fix, announced on, and the gameweek it takes effect from", async () => {
  await holdGameweeks(t, { next: 9 });
  await fixAs(ADMIN, EDITED);
  vi.setSystemTime(TODAY + HOUR_MS);
  await patch(withAssists(EDITED, 5), kickoffOf(11));

  expect((await viewAs(COMMISSIONER)).versions).toEqual([
    { id: expect.any(String), name: "26_27.1", kind: "fix", announcedAt: TODAY, takesEffectAt: TODAY, fromGameweek: 9 },
    { id: expect.any(String), name: "26_27.2", kind: "patch", announcedAt: TODAY + HOUR_MS, takesEffectAt: kickoffOf(11), fromGameweek: 11 },
  ]);
});

describe("withdrawing an announced patch", () => {
  test("puts it back as the draft, the scoring as it was, its banner gone", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, kickoffOf(10));
    vi.setSystemTime(TODAY + DAY_MS);

    expect(await withdrawAs(ADMIN, await latestId())).toBe(TODAY + DAY_MS);

    expect(await versions()).toBe(0);
    expect(await inGameweek(10)).toEqual(FIRST_SCORING);
    expect(await viewAs(ADMIN)).toMatchObject({ part: FIRST_SCORING, revision: null, draft: { part: EDITED, savedAt: TODAY + DAY_MS } });
    expect(await (await as(COMMISSIONER)).query(api.scoring.patchNotes.banner, { now: Date.now() })).toBeNull();
  });

  test("tells every manager by a Mail letter", async () => {
    await holdGameweeks(t, { next: 9 });
    const leagueId = await adminCreatesLeague(t);
    await addManagers(t, leagueId, MANAGERS.slice(0, 2));
    await patch(EDITED, kickoffOf(10));
    const before = (await subjects()).length;

    await withdrawAs(ADMIN, await latestId());

    const filed = (await subjects()).slice(before);
    expect(filed.map(([to]) => to).sort()).toEqual([COMMISSIONER, ...MANAGERS.slice(0, 2)].sort());
    expect(new Set(filed.map(([, subject]) => subject))).toEqual(new Set(["Scoring patch 26_27.1 withdrawn"]));
  });

  test("announced again, it needs a fresh 7 days, and takes the same name", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, kickoffOf(10));
    vi.setSystemTime(TODAY + 2 * DAY_MS);
    await withdrawAs(ADMIN, await latestId());

    // A week after the first announcement, but not after the second.
    await expectRefused(announceAs(ADMIN, TODAY + 8 * DAY_MS), siteScoringRefusals.tooSoon(TODAY + 2 * DAY_MS + NOTICE, undefined));
    expect(await announceAs(ADMIN, kickoffOf(11))).toEqual({ name: "26_27.1", fromGameweek: 11 });
  });

  test("keeps a draft already made from it, which holds it, so it can be announced", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, kickoffOf(10));
    await saveDraftAs(ADMIN, withAssists(EDITED, 5));

    await withdrawAs(ADMIN, await latestId());

    expect((await viewAs(ADMIN)).draft?.part).toEqual(withAssists(EDITED, 5));
    expect(await announceAs(ADMIN, kickoffOf(10))).toMatchObject({ name: "26_27.1" });
  });

  test("of a fix, or a patch already in effect, is refused", async () => {
    await holdGameweeks(t, { next: 9 });
    await fixAs(ADMIN, EDITED);
    await expectRefused(withdrawAs(ADMIN, await latestId()), siteScoringRefusals.notWaiting);

    await patch(withAssists(EDITED, 5), kickoffOf(10));
    vi.setSystemTime(kickoffOf(10));
    await expectRefused(withdrawAs(ADMIN, await latestId()), siteScoringRefusals.notWaiting);
    expect(await versions()).toBe(2);
  });

  test("from anyone but the admin is refused", async () => {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, kickoffOf(10));

    await expectRefused(withdrawAs(COMMISSIONER, await latestId()), refusals.notAdmin);
    expect(await versions()).toBe(1);
  });
});
