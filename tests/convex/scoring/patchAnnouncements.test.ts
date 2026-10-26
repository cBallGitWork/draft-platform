import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LEAGUES_WRITTEN_TO_MOST } from "../../../convex/mail/letters";
import { patchBannerRefusals } from "../../../convex/scoring/patchNotes";
import { siteScoringRefusals } from "../../../convex/scoring/siteScoring";
import { momentIn } from "../../../convex/shared/londonTime";
import { PRODUCT_NAME } from "../../../convex/shared/product";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS } from "../../../convex/shared/time";
import { expectRefused, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { ADMIN, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS } from "../../support/convex/leagues.harness";
import {
  announceAs,
  as,
  EDITED,
  EDITED_AGAIN,
  fixAs,
  NOTICE,
  patch,
  saveDraftAs,
  t,
  TODAY,
  useSiteScoringDeployment,
} from "../../support/convex/siteScoring.harness";

// Announcing a version of the site's scoring (spec/14, Changes and corrections; #356): one Mail
// letter to every manager, a patch or a fix alike; a banner from a patch's announcement until it
// takes effect, which each person can dismiss; and the patch notes, every version's changes worked
// out from the stored versions.

useSiteScoringDeployment();

const [ANN, BOB, CAT] = MANAGERS;
const STRANGER = "nobody@example.com";

/** Every letter filed, as [to, subject], in the order filed. */
const everyLetter = () => t.run(async (ctx) => (await ctx.db.query("letters").collect()).map((row) => [row.to, row.subject] as const));
const lettersTo = async (email: string) => (await as(email)).query(api.mail.mail.letters, {});
const bannerAt = async (email: string, now: number) => (await as(email)).query(api.scoring.patchNotes.banner, { now });
const dismissAs = async (email: string, versionId: Id<"siteScoring">) =>
  (await as(email)).mutation(api.scoring.patchNotes.dismissBanner, { versionId });
const notesAs = async (email: string) => (await as(email)).query(api.scoring.patchNotes.notes, {});

/** Two leagues COMMISSIONER runs: Ann and Bob in the first, Ann and Cat in the second. */
async function twoLeagues() {
  await holdGameweeks(t, { next: 9 });
  const first = await adminCreatesLeague(t);
  await addManagers(t, first, [ANN, BOB]);
  const second = await adminCreatesLeague(t, 4, "Mini beta");
  await addManagers(t, second, [ANN, CAT]);
}

describe("the letter", () => {
  test("#356 Done: a patch files one letter to each person in any league, once each, and to nobody else", async () => {
    await twoLeagues();
    const before = (await everyLetter()).length;

    await patch(EDITED, TODAY + NOTICE);
    const filed = (await everyLetter()).slice(before);

    expect(filed.map(([to]) => to).sort()).toEqual([ANN, BOB, CAT, COMMISSIONER].sort());
    expect(await lettersTo(STRANGER)).toEqual([]);
    expect(await lettersTo(ADMIN)).toEqual([]);
  });

  test("#356 Done: it names the version, when it takes effect, the gameweek, and each change, from the site", async () => {
    await twoLeagues();

    await patch(EDITED, TODAY + NOTICE);
    const [letter] = await lettersTo(ANN);

    expect(letter).toMatchObject({
      leagueName: PRODUCT_NAME,
      from: null,
      read: false,
      subject: `Scoring patch 26_27.1 takes effect on ${momentIn(TODAY + NOTICE, undefined)}`,
    });
    expect(letter.body).toContain(`It takes effect on ${momentIn(TODAY + NOTICE, undefined)}, from gameweek 10.`);
    expect(letter.body).toContain("- Assists: 3 → 4\n- Tackles: newly scored, 1 per action");
  });

  test("a fix files a letter too, as a fix: spec/14 has it announced as one", async () => {
    await twoLeagues();

    await fixAs(ADMIN, EDITED);
    const [letter] = await lettersTo(BOB);

    expect(letter.subject).toBe("Scoring fix 26_27.1");
    expect(letter.body).toContain("fixed a mistake in the scoring every league plays on: version 26_27.1, in force from gameweek 9.");
    expect(letter.body).toContain("- Assists: 3 → 4");
  });

  test("each change is told against the version before it, not the first set", async () => {
    await twoLeagues();
    await fixAs(ADMIN, EDITED);

    await fixAs(ADMIN, EDITED_AGAIN);
    const [latest] = await lettersTo(CAT);

    expect(latest.body).toMatch(/What changes:\n- Tackles: 1 → 2$/);
  });

  test("the admin's own copy, when he is in a league, is filed read: he did it", async () => {
    await twoLeagues();
    await addManagers(t, (await t.run((ctx) => ctx.db.query("leagues").first()))!._id, [ADMIN]);

    await fixAs(ADMIN, EDITED);

    expect((await lettersTo(ADMIN))[0]).toMatchObject({ subject: "Scoring fix 26_27.1", read: true });
  });

  test("a refused announcement files nothing", async () => {
    await twoLeagues();
    await saveDraftAs(ADMIN, EDITED);
    const before = await everyLetter();

    await expectRefused(announceAs(ADMIN, TODAY + MINUTE_MS), siteScoringRefusals.tooSoon(TODAY + NOTICE, undefined));
    expect(await everyLetter()).toEqual(before);
  });

  test(`past ${LEAGUES_WRITTEN_TO_MOST} leagues it throws, and the patch with it, never reaching only some`, async () => {
    await holdGameweeks(t, { next: 9 });
    await t.run(async (ctx) => {
      for (let league = 0; league <= LEAGUES_WRITTEN_TO_MOST; league += 1) {
        await ctx.db.insert("leagues", { name: `League ${league}`, maxTeams: 4, commissionerEmail: COMMISSIONER });
      }
    });

    await expect(fixAs(ADMIN, EDITED)).rejects.toThrow(`More than ${LEAGUES_WRITTEN_TO_MOST} leagues`);
    expect(await everyLetter()).toEqual([]);
    expect(await notesAs(ADMIN)).toEqual([]);
  });
});

describe("the banner", () => {
  async function announced() {
    await holdGameweeks(t, { next: 9 });
    await patch(EDITED, TODAY + NOTICE);
    return (await t.run((ctx) => ctx.db.query("siteScoring").first()))!._id;
  }

  test("#356 Done: shows from the announcement until the patch takes effect", async () => {
    expect(await bannerAt(ANN, TODAY)).toBeNull();
    const versionId = await announced();

    expect(await bannerAt(ANN, TODAY)).toEqual({ versionId, name: "26_27.1", takesEffectAt: TODAY + NOTICE });
    expect(await bannerAt(ANN, TODAY + NOTICE - MINUTE_MS)).toMatchObject({ name: "26_27.1" });
    expect(await bannerAt(ANN, TODAY + NOTICE)).toBeNull();
  });

  test("#356 Done: dismissed, it is gone for that person alone, and stays gone", async () => {
    const versionId = await announced();

    await dismissAs(ANN, versionId);
    await dismissAs(ANN, versionId);

    expect(await bannerAt(ANN, TODAY)).toBeNull();
    expect(await bannerAt(BOB, TODAY)).toMatchObject({ name: "26_27.1" });
    expect(await t.run(async (ctx) => (await ctx.db.query("patchBannerDismissals").collect()).length)).toBe(1);
  });

  test("with two patches waiting, dismissing the sooner shows the later", async () => {
    await announced();
    vi.setSystemTime(TODAY + MINUTE_MS);
    await patch(EDITED_AGAIN, TODAY + 2 * NOTICE);
    const [sooner] = await t.run((ctx) => ctx.db.query("siteScoring").withIndex("by_takesEffectAt").collect());

    expect(await bannerAt(ANN, TODAY + MINUTE_MS)).toMatchObject({ name: "26_27.1" });
    await dismissAs(ANN, sooner._id);
    expect(await bannerAt(ANN, TODAY + MINUTE_MS)).toMatchObject({ name: "26_27.2" });
  });

  test("a fix shows none: it takes effect as it is made", async () => {
    await holdGameweeks(t, { next: 9 });
    await fixAs(ADMIN, EDITED);

    expect(await bannerAt(ANN, TODAY)).toBeNull();
  });

  test("signed out, there is none, and dismissing is refused", async () => {
    const versionId = await announced();

    expect(await t.query(api.scoring.patchNotes.banner, { now: TODAY })).toBeNull();
    await expectRefused(t.mutation(api.scoring.patchNotes.dismissBanner, { versionId }), refusals.signedOut);
  });

  test("dismissing a version that doesn't exist is refused", async () => {
    const versionId = await announced();
    await t.run((ctx) => ctx.db.delete("siteScoring", versionId));

    await expectRefused(dismissAs(ANN, versionId), patchBannerRefusals.noPatch);
  });
});

describe("the patch notes", () => {
  test("#356 Done: list every version, newest first, each with what it changed from the one before", async () => {
    await holdGameweeks(t, { next: 9 });
    await fixAs(ADMIN, EDITED);
    vi.setSystemTime(TODAY + MINUTE_MS);
    await patch(EDITED_AGAIN, TODAY + MINUTE_MS + NOTICE);

    expect(await notesAs(ANN)).toEqual([
      { name: "26_27.2", kind: "patch", announcedAt: TODAY + MINUTE_MS, takesEffectAt: TODAY + MINUTE_MS + NOTICE, changes: ["Tackles: 1 → 2"] },
      { name: "26_27.1", kind: "fix", announcedAt: TODAY, takesEffectAt: TODAY, changes: ["Assists: 3 → 4", "Tackles: newly scored, 1 per action"] },
    ]);
  });

  test("are empty before any version, and signed out", async () => {
    expect(await notesAs(STRANGER)).toEqual([]);
    await holdGameweeks(t, { next: 9 });
    await fixAs(ADMIN, EDITED);

    expect(await t.query(api.scoring.patchNotes.notes, {})).toEqual([]);
  });
});
