// The dashboard's Guide tab (spec/23 S23.13): the admin edits an entry's text, and adds, removes and
// reorders entries and sections; a formation entry is edited and moved only (S23.16), and a section
// with entries says why it can't be removed yet (S23.14).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { ADMIN_GUIDE_PATH, ADMIN_PATH } from "../../../src/admin/paths";
import { guideLoadingWords, guideTabWords, guideTitle, guideWords } from "../../../src/admin/words";
import type { GuideSection } from "../../../src/guide/seam";
import type { GuideData } from "../../support/src/guide.harness";
import { admin, commissioner, expectSentToLeagues, openApp, panel } from "../../support/src/shell.harness";

const BASICS = "basics" as Id<"guideSections">;
const TACTICS = "tactics" as Id<"guideSections">;
const WAIVERS = "waivers" as Id<"guideSections">;
const GAMEWEEKS = "gameweeks" as Id<"guideEntries">;
const DEADLINES = "deadlines" as Id<"guideEntries">;
const FORMATION = { kind: "preset", name: "4-4-2" } as const;

const GUIDE: readonly GuideSection[] = [
  {
    sectionId: BASICS,
    title: "Basics",
    entries: [
      { entryId: GAMEWEEKS, title: "Gameweeks", text: "Old words." },
      { entryId: DEADLINES, title: "Deadlines", text: "Lock time." },
    ],
  },
  { sectionId: TACTICS, title: "Tactics", entries: [{ formation: FORMATION, title: "4-4-2", text: "Two banks of four." }] },
  { sectionId: WAIVERS, title: "Waivers", entries: [] },
];

const openGuide = (data: GuideData = { guide: GUIDE }) => openApp(ADMIN_GUIDE_PATH, admin, { guide: data });
const pickEntry = async (title: string) => userEvent.click(await screen.findByRole("button", { name: title }));

describe("reaching the Guide tab", () => {
  it("S23.13 the admin reaches it from the dashboard's tabs", async () => {
    const app = openApp(ADMIN_PATH, admin, { guide: { guide: GUIDE } });
    await userEvent.click(await screen.findByRole("link", { name: guideTabWords }));
    expect(await panel(guideTitle)).toBeTruthy();
    expect(app.path()).toBe(ADMIN_GUIDE_PATH);
  });

  it("S23.13 anyone else is sent back to Your leagues", async () => {
    await expectSentToLeagues(ADMIN_GUIDE_PATH, commissioner);
  });

  it("S23.13 says so while the Guide loads", async () => {
    openGuide({ loading: true });
    expect(await screen.findByRole("status")).toHaveProperty("textContent", guideLoadingWords);
  });
});

describe("editing an entry", () => {
  it("S23.13 the admin rewrites an entry's title and text", async () => {
    const app = openGuide();
    await pickEntry("Gameweeks");
    const entry = await panel("Gameweeks");
    const text = within(entry).getByLabelText(guideWords.textLabel);
    await userEvent.clear(text);
    await userEvent.type(text, "New words.");
    await userEvent.click(within(entry).getByRole("button", { name: guideWords.save }));
    expect(app.guide.editEntry).toHaveBeenCalledWith(GAMEWEEKS, "Gameweeks", "New words.");
  });

  it("S23.16 a formation entry's text is edited, with no title box and no Remove", async () => {
    const app = openGuide();
    await pickEntry("4-4-2");
    const entry = await panel("4-4-2");
    expect(within(entry).queryByLabelText(guideWords.titleLabel)).toBeNull();
    expect(within(entry).queryByRole("button", { name: guideWords.remove })).toBeNull();
    const text = within(entry).getByLabelText(guideWords.textLabel);
    await userEvent.clear(text);
    await userEvent.type(text, "Solid.");
    await userEvent.click(within(entry).getByRole("button", { name: guideWords.save }));
    expect(app.guide.editFormationEntry).toHaveBeenCalledWith(FORMATION, "Solid.");
  });
});

describe("adding and removing", () => {
  it("S23.13 the admin adds an entry to a section", async () => {
    const app = openGuide();
    await userEvent.click(await screen.findByRole("button", { name: guideWords.newEntryLabel("Waivers") }));
    const entry = await panel(guideWords.newEntryLabel("Waivers"));
    await userEvent.type(within(entry).getByLabelText(guideWords.titleLabel), "Claims");
    await userEvent.type(within(entry).getByLabelText(guideWords.textLabel), "How a claim works.");
    await userEvent.click(within(entry).getByRole("button", { name: guideWords.add }));
    expect(app.guide.addEntry).toHaveBeenCalledWith(WAIVERS, "Claims", "How a claim works.");
  });

  it("S23.13 the admin removes an entry after a yes", async () => {
    const app = openGuide();
    await pickEntry("Deadlines");
    const entry = await panel("Deadlines");
    await userEvent.click(within(entry).getByRole("button", { name: guideWords.remove }));
    expect(within(entry).getByText(guideWords.confirm("Deadlines"))).toBeTruthy();
    await userEvent.click(within(entry).getByRole("button", { name: guideWords.yes }));
    expect(app.guide.removeEntry).toHaveBeenCalledWith(DEADLINES);
  });

  it("S23.13 the admin adds a section", async () => {
    const app = openGuide();
    await userEvent.type(await screen.findByLabelText(guideWords.newSectionLabel), "Trades");
    await userEvent.click(screen.getByRole("button", { name: guideWords.addSection }));
    expect(app.guide.addSection).toHaveBeenCalledWith("Trades");
  });

  it("S23.14 an empty section is removed; one with entries says why it can't be yet", async () => {
    const app = openGuide();
    await userEvent.click(await screen.findByRole("button", { name: guideWords.removeSectionLabel("Waivers") }));
    expect(app.guide.removeSection).toHaveBeenCalledWith(WAIVERS);
    expect(screen.queryByRole("button", { name: guideWords.removeSectionLabel("Basics") })).toBeNull();
    expect(screen.getAllByText(guideWords.notEmpty)).toHaveLength(1);
    expect(guideWords.notEmpty).not.toMatch(/\bmove\b/i);
  });

  it("S23.16 a section holding formation entries, which can't be removed, offers no Remove and no way to empty it", async () => {
    openGuide();
    const tactics = await screen.findByRole("list", { name: "Tactics" });
    const row = tactics.closest("li") as HTMLElement;
    expect(within(row).queryByRole("button", { name: guideWords.removeSectionLabel("Tactics") })).toBeNull();
    expect(within(row).queryByText(guideWords.notEmpty)).toBeNull();
  });
});

describe("reordering", () => {
  it("S23.13 the admin moves an entry within its section, the first's Up and the last's Down off", async () => {
    const app = openGuide();
    const up = await screen.findByRole("button", { name: guideWords.upLabel("Gameweeks") });
    expect(up).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: guideWords.downLabel("Deadlines") })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: guideWords.downLabel("Gameweeks") }));
    expect(app.guide.moveEntry).toHaveBeenCalledWith(GAMEWEEKS, BASICS, 1);
  });

  it("S23.13 the admin moves a section", async () => {
    const app = openGuide();
    await userEvent.click(await screen.findByRole("button", { name: guideWords.upLabel("Waivers") }));
    expect(app.guide.moveSection).toHaveBeenCalledWith(WAIVERS, 1);
  });

  it("S23.16 a formation entry moves among Tactics' formation entries", async () => {
    const two = { kind: "classic", name: "Keegan's Newcastle" } as const;
    const guide: readonly GuideSection[] = [
      {
        sectionId: TACTICS,
        title: "Tactics",
        entries: [
          { formation: FORMATION, title: "4-4-2", text: "Two banks of four." },
          { formation: two, title: two.name, text: "Attack." },
        ],
      },
    ];
    const app = openGuide({ guide });
    await userEvent.click(await screen.findByRole("button", { name: guideWords.upLabel(two.name) }));
    expect(app.guide.moveFormationEntry).toHaveBeenCalledWith(two, 0);
  });
});
