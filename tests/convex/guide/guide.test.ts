import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { guideRefusals } from "../../../convex/guide/guide";
import { GUIDE_TITLE_MAX } from "../../../convex/guide/guideLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN, COMMISSIONER, actingAs, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The Guide held on the server (spec/23): every signed-in manager reads its sections and entries
// in order (S23.4), the admin alone changes them (S23.13), and a change shows at once (S23.15).

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
});

const admin = () => actingAs(t, ADMIN);
/** The Guide as Ann, a manager, reads it: each section's title and its entries' titles. */
const outline = async () =>
  (await (await actingAs(t, ANN)).query(api.guide.guide.list, {})).map((section) => [section.title, section.entries.map((entry) => entry.title)]);
const addSection = async (title: string) => (await admin()).mutation(api.guide.guide.addSection, { title });
const addEntry = async (sectionId: Id<"guideSections">, title: string) =>
  (await admin()).mutation(api.guide.guide.addEntry, { sectionId, title, text: `${title}, explained.` });

/** Basics (Stars, Runs) then Tactics (Formations). */
async function aGuide() {
  const basics = await addSection("Basics");
  const tactics = await addSection("Tactics");
  const stars = await addEntry(basics, "Stars");
  const runs = await addEntry(basics, "Runs");
  const formations = await addEntry(tactics, "Formations");
  return { basics, tactics, stars, runs, formations };
}

describe("reading the Guide", () => {
  test("S23.4: a signed-in manager reads every section and its entries, in order", async () => {
    await aGuide();
    expect(await outline()).toEqual([
      ["Basics", ["Stars", "Runs"]],
      ["Tactics", ["Formations"]],
    ]);
  });

  test("S23.4: someone signed out can't read it", async () => {
    await expectRefused(t.query(api.guide.guide.list, {}), refusals.signedOut);
  });
});

describe("the admin changes it, and managers see it at once", () => {
  test("S23.13 S23.15: an entry's edit shows to managers at once", async () => {
    const { stars } = await aGuide();
    await (await admin()).mutation(api.guide.guide.editEntry, { entryId: stars, title: " Stars ", text: "  A star is a player picked.\nFor a gameweek. " });
    const [basics] = await (await actingAs(t, ANN)).query(api.guide.guide.list, {});
    expect(basics.entries[0]).toMatchObject({ title: "Stars", text: "A star is a player picked.\nFor a gameweek." });
  });

  test("S23.13: an added entry goes at the foot of its section, and an added section at the foot of the list", async () => {
    const { basics } = await aGuide();
    await addEntry(basics, "Prov.");
    await addSection("Waivers");
    expect(await outline()).toEqual([
      ["Basics", ["Stars", "Runs", "Prov."]],
      ["Tactics", ["Formations"]],
      ["Waivers", []],
    ]);
  });

  test("S23.13: a removed entry leaves the list, and the rest close up", async () => {
    const { stars, basics } = await aGuide();
    await (await admin()).mutation(api.guide.guide.removeEntry, { entryId: stars });
    await addEntry(basics, "Prov.");
    expect(await outline()).toEqual([
      ["Basics", ["Runs", "Prov."]],
      ["Tactics", ["Formations"]],
    ]);
  });

  test("S23.13: entries reorder within a section and move to another", async () => {
    const { runs, stars, tactics } = await aGuide();
    await (await admin()).mutation(api.guide.guide.moveEntry, { entryId: runs, sectionId: tactics, place: 0 });
    expect(await outline()).toEqual([
      ["Basics", ["Stars"]],
      ["Tactics", ["Runs", "Formations"]],
    ]);
    await (await admin()).mutation(api.guide.guide.moveEntry, { entryId: runs, sectionId: tactics, place: 1 });
    await (await admin()).mutation(api.guide.guide.moveEntry, { entryId: stars, sectionId: tactics, place: 2 });
    expect(await outline()).toEqual([
      ["Basics", []],
      ["Tactics", ["Formations", "Runs", "Stars"]],
    ]);
  });

  test("S23.13: sections rename and reorder", async () => {
    const { tactics, basics } = await aGuide();
    await (await admin()).mutation(api.guide.guide.moveSection, { sectionId: tactics, place: 0 });
    await (await admin()).mutation(api.guide.guide.renameSection, { sectionId: basics, title: "The basics" });
    expect(await outline()).toEqual([
      ["Tactics", ["Formations"]],
      ["The basics", ["Stars", "Runs"]],
    ]);
  });

  test("S23.13: a place past the end of the list is refused", async () => {
    const { tactics } = await aGuide();
    await expectRefused((await admin()).mutation(api.guide.guide.moveSection, { sectionId: tactics, place: 2 }), guideRefusals.noPlace);
  });

  test(`S23.13: a blank title, or one past ${GUIDE_TITLE_MAX} characters, is refused`, async () => {
    await expectRefused(addSection("  "), guideRefusals.title.blank);
    await expectRefused(addSection("a".repeat(GUIDE_TITLE_MAX + 1)), guideRefusals.title.tooLong);
  });
});

describe("removing a section", () => {
  test("S23.14: a section with entries can't be removed; once empty, it can", async () => {
    const { tactics, formations } = await aGuide();
    await expectRefused((await admin()).mutation(api.guide.guide.removeSection, { sectionId: tactics }), guideRefusals.notEmpty);
    await (await admin()).mutation(api.guide.guide.removeEntry, { entryId: formations });
    await (await admin()).mutation(api.guide.guide.removeSection, { sectionId: tactics });
    expect(await outline()).toEqual([["Basics", ["Stars", "Runs"]]]);
  });
});

describe("only the admin changes it", () => {
  test("S23.13: a manager, or a commissioner, who isn't the admin is refused every change, and nothing changes", async () => {
    const { basics, stars, tactics } = await aGuide();
    const before = await outline();
    for (const email of [ANN, COMMISSIONER]) {
      const them = await actingAs(t, email);
      const changes = [
        () => them.mutation(api.guide.guide.addSection, { title: "Mine" }),
        () => them.mutation(api.guide.guide.renameSection, { sectionId: basics, title: "Mine" }),
        () => them.mutation(api.guide.guide.moveSection, { sectionId: tactics, place: 0 }),
        () => them.mutation(api.guide.guide.removeSection, { sectionId: tactics }),
        () => them.mutation(api.guide.guide.addEntry, { sectionId: basics, title: "Mine", text: "Mine" }),
        () => them.mutation(api.guide.guide.editEntry, { entryId: stars, title: "Mine", text: "Mine" }),
        () => them.mutation(api.guide.guide.moveEntry, { entryId: stars, sectionId: tactics, place: 0 }),
        () => them.mutation(api.guide.guide.removeEntry, { entryId: stars }),
      ];
      for (const change of changes) await expectRefused(change(), refusals.notAdmin);
    }
    expect(await outline()).toEqual(before);
  });
});
