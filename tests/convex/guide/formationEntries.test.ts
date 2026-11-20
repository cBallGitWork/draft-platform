import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { describedWith, LISTED_FORMATIONS } from "../../../convex/guide/formationEntries";
import { guideRefusals } from "../../../convex/guide/guide";
import { FIRST_CLASSIC_FORMATIONS, classicDescriptionOf } from "../../../convex/lineup/classicFormations";
import { FIRST_PRESETS, presetDescriptionOf } from "../../../convex/lineup/presets";
import { refusals } from "../../../convex/shared/leagueAccess";
import { COMMISSIONER, actingAs, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { asAdmin } from "../../support/convex/positionsSync.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The Guide's formation entries (spec/23 S23.7, S23.16): one per preset and classic side, under
// Tactics, following the formations list; the admin edits their text, the one description the
// formation window shows too (spec/05 S05.61), and moves them within Tactics, never removing one or
// adding one.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});

const KEEGANS = { kind: "classic" as const, name: "Keegan's Newcastle" };
const FOUR_FOUR_TWO = { kind: "preset" as const, name: "4-4-2" };

/** Basics, then Tactics holding Team instructions and the formation entries. */
async function aGuide() {
  await t.run(async (ctx) => {
    await ctx.db.insert("guideSections", { title: "Basics", order: 0 });
    const tactics = await ctx.db.insert("guideSections", { title: "Tactics", order: 1, holdsFormations: true });
    await ctx.db.insert("guideEntries", { sectionId: tactics, title: "Team instructions", text: "Two a side.", order: 0 });
  });
}

/** Tactics as Ann, a manager, reads it. */
const tacticsEntries = async () => (await (await actingAs(t, ANN)).query(api.guide.guide.list, {}))[1].entries;
const descriptions = async () => describedWith(await (await actingAs(t, ANN)).query(api.guide.guide.formationDescriptions, {}));

describe("formation entries follow the formations list", () => {
  test("S23.7 S23.16: Tactics lists its own entries, then one per preset and classic side, each with the formation window's description", async () => {
    await aGuide();
    const entries = await tacticsEntries();
    expect(entries.map((entry) => entry.title)).toEqual(["Team instructions", ...FIRST_PRESETS.map(({ name }) => name), ...FIRST_CLASSIC_FORMATIONS.map(({ name }) => name)]);
    expect(entries.find((entry) => entry.title === "4-4-2")!.text).toBe(presetDescriptionOf("4-4-2"));
    const keegans = FIRST_CLASSIC_FORMATIONS.find(({ name }) => name === KEEGANS.name)!;
    expect(entries.find((entry) => entry.title === KEEGANS.name)!.text).toBe(classicDescriptionOf(keegans));
  });

  test("S23.7 S05.61: the admin's edit shows in the Guide and in the formation window's description, at once", async () => {
    await aGuide();
    await (await asAdmin(t)).mutation(api.guide.guide.editFormationEntry, { formation: KEEGANS, text: "  Entertainers.  " });
    expect((await tacticsEntries()).find((entry) => entry.title === KEEGANS.name)!.text).toBe("Entertainers.");
    const describe = await descriptions();
    expect(describe.classic({ name: KEEGANS.name, description: "A league's older copy" })).toBe("Entertainers.");
    // An unedited one keeps Claude's.
    expect(describe.preset("4-4-2")).toBe(presetDescriptionOf("4-4-2"));
  });

  test("S23.16: the admin moves a formation entry within Tactics", async () => {
    await aGuide();
    await (await asAdmin(t)).mutation(api.guide.guide.moveFormationEntry, { formation: KEEGANS, place: 0 });
    await (await asAdmin(t)).mutation(api.guide.guide.moveFormationEntry, { formation: FOUR_FOUR_TWO, place: 2 });
    const titles = (await tacticsEntries()).map((entry) => entry.title);
    expect(titles.slice(0, 4)).toEqual(["Team instructions", KEEGANS.name, "4-3-3", "4-4-2"]);
    expect(titles).toHaveLength(1 + LISTED_FORMATIONS.length);
  });

  test("S23.16: a formation entry can't be added for a side that isn't in the formations list", async () => {
    await aGuide();
    const admin = await asAdmin(t);
    await expectRefused(admin.mutation(api.guide.guide.editFormationEntry, { formation: { kind: "classic", name: "Leeds 1992" }, text: "Mine" }), guideRefusals.noFormation);
    // A preset's name isn't a classic side's.
    await expectRefused(admin.mutation(api.guide.guide.moveFormationEntry, { formation: { kind: "classic", name: "4-4-2" }, place: 0 }), guideRefusals.noFormation);
    expect(await tacticsEntries()).toHaveLength(1 + LISTED_FORMATIONS.length);
  });

  test("S23.16 S23.14: a formation entry can't be removed, so Tactics never empties", async () => {
    await aGuide();
    const admin = await asAdmin(t);
    await expectRefused(admin.mutation(api.guide.guide.editFormationEntry, { formation: KEEGANS, text: "  " }), guideRefusals.text.blank);
    const [, tactics] = await admin.query(api.guide.guide.list, {});
    const own = tactics.entries[0];
    if (!("entryId" in own)) throw new Error("Tactics' own entry comes first");
    await admin.mutation(api.guide.guide.removeEntry, { entryId: own.entryId });
    await expectRefused(admin.mutation(api.guide.guide.removeSection, { sectionId: tactics.sectionId }), guideRefusals.notEmpty);
  });

  test("S23.16: a manager, or a commissioner, who isn't the admin is refused, and nothing changes", async () => {
    await aGuide();
    const before = await tacticsEntries();
    for (const email of [ANN, COMMISSIONER]) {
      const them = await actingAs(t, email);
      await expectRefused(them.mutation(api.guide.guide.editFormationEntry, { formation: KEEGANS, text: "Mine" }), refusals.notAdmin);
      await expectRefused(them.mutation(api.guide.guide.moveFormationEntry, { formation: KEEGANS, place: 0 }), refusals.notAdmin);
    }
    expect(await tacticsEntries()).toEqual(before);
  });
});
