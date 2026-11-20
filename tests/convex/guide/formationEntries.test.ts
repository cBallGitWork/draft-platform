import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { describedWith, LISTED_FORMATIONS } from "../../../convex/guide/formationEntries";
import { guideRefusals } from "../../../convex/guide/guide";
import { FIRST_CLASSIC_FORMATIONS, classicDescriptionOf } from "../../../convex/lineup/classicFormations";
import { FIRST_PRESETS, presetDescriptionOf } from "../../../convex/lineup/presets";
import { refusals } from "../../../convex/shared/leagueAccess";
import { COMMISSIONER, actingAs, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { KEEGANS } from "../../support/convex/lineup.harness";
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

const KEEGANS_ENTRY = { kind: "classic" as const, name: KEEGANS.name };
const FOUR_FOUR_TWO = { kind: "preset" as const, name: "4-4-2" };
/** Tactics' own entry, held before the formation entries. */
const OWN = "Prov.";

/** Basics, then Tactics, added by the deployment's one-off, holding its own entry and the formation
 *  entries. */
async function aGuide() {
  const admin = await asAdmin(t);
  await admin.mutation(api.guide.guide.addSection, { title: "Basics" });
  expect(await t.mutation(internal.migrations.guideTactics.addTactics, {})).toBe("added");
  const [, tactics] = await admin.query(api.guide.guide.list, {});
  await admin.mutation(api.guide.guide.addEntry, { sectionId: tactics.sectionId, title: OWN, text: "Not final yet." });
}

/** Tactics as Ann, a manager, reads it. */
const tacticsEntries = async () => (await (await actingAs(t, ANN)).query(api.guide.guide.list, {}))[1].entries;
const descriptions = async () => describedWith(await (await actingAs(t, ANN)).query(api.guide.guide.formationDescriptions, {}));

describe("formation entries follow the formations list", () => {
  test("S23.7 S23.16: Tactics lists its own entries, then one per preset and classic side, each with the formation window's description", async () => {
    await aGuide();
    const entries = await tacticsEntries();
    expect(entries.map((entry) => entry.title)).toEqual([OWN, ...FIRST_PRESETS.map(({ name }) => name), ...FIRST_CLASSIC_FORMATIONS.map(({ name }) => name)]);
    expect(entries.find((entry) => entry.title === "4-4-2")!.text).toBe(presetDescriptionOf("4-4-2"));
    expect(entries.find((entry) => entry.title === KEEGANS.name)!.text).toBe(classicDescriptionOf(KEEGANS));
  });

  test("S23.7: a Tactics the admin already added becomes the one listing the formation entries, and running the one-off again does nothing", async () => {
    const admin = await asAdmin(t);
    await admin.mutation(api.guide.guide.addSection, { title: "Tactics" });
    expect(await t.mutation(internal.migrations.guideTactics.addTactics, {})).toBe("flagged");
    expect(await t.mutation(internal.migrations.guideTactics.addTactics, {})).toBe("held already");
    const sections = await admin.query(api.guide.guide.list, {});
    expect(sections).toHaveLength(1);
    expect(sections[0].entries).toHaveLength(LISTED_FORMATIONS.length);
  });

  test("S23.7 S05.61: the admin's edit shows in the Guide and in the formation window's description, at once", async () => {
    await aGuide();
    await (await asAdmin(t)).mutation(api.guide.guide.editFormationEntry, { formation: KEEGANS_ENTRY, text: "  Entertainers.  " });
    expect((await tacticsEntries()).find((entry) => entry.title === KEEGANS.name)!.text).toBe("Entertainers.");
    const describe = await descriptions();
    expect(describe.classic({ name: KEEGANS.name, description: "A league's older copy" })).toBe("Entertainers.");
    // An unedited one keeps Claude's.
    expect(describe.preset("4-4-2")).toBe(presetDescriptionOf("4-4-2"));
  });

  test("S23.16: the admin moves a formation entry within Tactics", async () => {
    await aGuide();
    await (await asAdmin(t)).mutation(api.guide.guide.moveFormationEntry, { formation: KEEGANS_ENTRY, place: 0 });
    await (await asAdmin(t)).mutation(api.guide.guide.moveFormationEntry, { formation: FOUR_FOUR_TWO, place: 2 });
    const titles = (await tacticsEntries()).map((entry) => entry.title);
    expect(titles.slice(0, 4)).toEqual([OWN, KEEGANS.name, "4-3-3", "4-4-2"]);
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
    await expectRefused(admin.mutation(api.guide.guide.editFormationEntry, { formation: KEEGANS_ENTRY, text: "  " }), guideRefusals.text.blank);
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
      await expectRefused(them.mutation(api.guide.guide.editFormationEntry, { formation: KEEGANS_ENTRY, text: "Mine" }), refusals.notAdmin);
      await expectRefused(them.mutation(api.guide.guide.moveFormationEntry, { formation: KEEGANS_ENTRY, place: 0 }), refusals.notAdmin);
    }
    expect(await tacticsEntries()).toEqual(before);
  });
});
