// The rule balance lab on the draft patch and in the patch notes (spec/14, The rule balance lab;
// #843): the admin runs it on the saved draft with a button, and an announced patch's notes carry
// its report.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { categoryName } from "../../../convex/scoring/categories";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { PATCH_NOTES_PATH } from "../../../src/patches/paths";
import type { VersionNotes } from "../../../src/patches/seam";
import { labTitle, notTestedWords, offTargetWords } from "../../../src/patches/words";
import { draftTabWords, runLabWords, saveDraftToRunLabWords } from "../../../src/scoring/words";
import { ADMINS_VIEW, DRAFT_SAVED_AT, LAB_REPORT } from "../../support/src/scoring.harness";
import { openScoring } from "../../support/src/scoringScreen.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const openDraftTab = async () => {
  await screen.findByRole("list");
  await userEvent.click(screen.getByRole("button", { name: draftTabWords }));
};
const runButton = () => screen.getByRole("button", { name: runLabWords }) as HTMLButtonElement;

describe("on the draft patch", () => {
  it("runs on the saved draft when the admin presses its button, and shows each role's check", async () => {
    const app = openScoring({ view: { ...ADMINS_VIEW, draft: { part: structuredClone(FIRST_SCORING), savedAt: DRAFT_SAVED_AT } } });
    await openDraftTab();
    expect(app.scoring.runLab).not.toHaveBeenCalled();

    await userEvent.click(runButton());

    expect(app.scoring.runLab).toHaveBeenCalledExactlyOnceWith(DRAFT_SAVED_AT);
    expect(await screen.findByText(offTargetWords)).toBeTruthy();
    expect(screen.getByText(notTestedWords([categoryName("big_chance_created")]))).toBeTruthy();
  });

  it("waits for the draft to be saved", async () => {
    const app = openScoring();
    await openDraftTab();

    expect(runButton().disabled).toBe(true);
    expect(screen.getByText(saveDraftToRunLabWords)).toBeTruthy();
    expect(app.scoring.runLab).not.toHaveBeenCalled();
  });
});

it("an announced patch's notes carry its lab report", async () => {
  const notes: VersionNotes[] = [{ name: "26_27.1", kind: "patch", announcedAt: 0, takesEffectAt: 0, changes: ["Assists: 3 → 4"], lab: LAB_REPORT }];
  openApp(PATCH_NOTES_PATH, manager, { patches: { notes } });

  expect(await screen.findByRole("heading", { name: labTitle })).toBeTruthy();
  expect(screen.getByText(offTargetWords)).toBeTruthy();
});
