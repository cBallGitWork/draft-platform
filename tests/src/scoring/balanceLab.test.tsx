// The rule balance lab on the draft patch and in the patch notes (spec/14, The rule balance lab;
// #843): the admin runs it on the saved draft with a button, and an announced patch's notes carry
// its report.

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LabReport } from "../../../convex/balanceLab/labReportShape";
import { categoryName } from "../../../convex/scoring/categories";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { PATCH_NOTES_PATH } from "../../../src/patches/paths";
import type { VersionNotes } from "../../../src/patches/seam";
import { signedWords } from "../../../convex/shared/numberWords";
import {
  instructionsHint,
  instructionsUntestedHint,
  labTitle,
  noTeamInstructionsWords,
  notTestedWords,
  notTestedYetWords,
  noXisWords,
  offTargetWords,
} from "../../../src/patches/words";
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

const openNotesWith = async (lab: LabReport) => {
  const notes: VersionNotes[] = [{ name: "26_27.1", kind: "patch", announcedAt: 0, takesEffectAt: 0, changes: ["Assists: 3 → 4"], lab }];
  openApp(PATCH_NOTES_PATH, manager, { patches: { notes } });
  await screen.findByRole("heading", { name: labTitle });
};

it("an announced patch's notes carry its lab report", async () => {
  await openNotesWith(LAB_REPORT);
  expect(screen.getByText(offTargetWords)).toBeTruthy();
});

describe("an announced patch's notes", () => {
  const rowOf = (name: string) => screen.getByRole("rowheader", { name }).closest("tr")?.textContent;

  it("give each team instruction's average for a whole XI and the XIs it was tested on, or not tested, naming any stat the past seasons lack (S14.9, S14.13; #1541)", async () => {
    await openNotesWith(LAB_REPORT);
    expect(screen.getByText(instructionsHint(1520, 12))).toBeTruthy();
    expect(rowOf("Gung-ho")).toBe(`Gung-ho${signedWords(1.61)}40`);
    expect(rowOf("Park the bus")).toBe(`Park the bus${noXisWords}0`);
    expect(rowOf("Shoot on sight")).toContain(notTestedWords([categoryName("att_obox_goal")]));
    expect(screen.queryByText(noTeamInstructionsWords)).toBeNull();
  });

  it("list each instruction as not tested on a report kept before the averages", async () => {
    const { xis: _xis, xisShort: _short, ...before } = LAB_REPORT;
    await openNotesWith({ ...before, instructions: [{ instruction: "gungHo", missing: [] }] });
    expect(screen.getByText(instructionsUntestedHint)).toBeTruthy();
    expect(rowOf("Gung-ho")).toContain(notTestedYetWords);
  });

  it("say the set scores no team instructions only when it scores none, and say nothing of them on a report kept before #1541", async () => {
    await openNotesWith({ ...LAB_REPORT, instructions: [] });
    expect(screen.getByText(noTeamInstructionsWords)).toBeTruthy();

    const { instructions: _kept, ...before } = LAB_REPORT;
    cleanup();
    await openNotesWith(before);
    expect(screen.queryByText(noTeamInstructionsWords)).toBeNull();
    expect(screen.queryByText(instructionsHint(1520, 12))).toBeNull();
  });
});
