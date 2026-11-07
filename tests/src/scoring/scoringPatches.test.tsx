// The rules editor's patches (Craig, 6 Nov 2026, on #368): a Draft patch tab beside Live, the same
// table saved as a draft and announced from a gameweek; and a row for every version, the coming
// patch withdrawn on a confirm.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { screenMoment } from "../../../convex/shared/moments";
import type { Scoring } from "../../../src/scoring/editing";
import type { ScoringVersion, ScoringView } from "../../../src/scoring/seam";
import {
  announceGameweekLabel,
  announcedWords,
  announceWords,
  columnWords,
  comingWords,
  draftSavedWords,
  draftTabWords,
  everyoneWords,
  liveTabWords,
  patchGameweekWords,
  saveDraftFirstWords,
  saveDraftWords,
  versionsTitle,
  withdrawWords,
  withdrawYesWords,
} from "../../../src/scoring/words";
import { ADMINS_VIEW, DRAFT_SAVED_AT, PATCH_GAMEWEEKS, REVISION } from "../../support/src/scoring.harness";
import { box, choose, openScoring, retype, save, SCORING_PAGE } from "../../support/src/scoringScreen.harness";
import { league, managerIn, openApp } from "../../support/src/shell.harness";

const withAssists = (points: number): Scoring => ({
  ...structuredClone(FIRST_SCORING),
  rules: FIRST_SCORING.rules.map((rule): Scoring["rules"][number] => (rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: points } } : structuredClone(rule))),
});
const openDraftTab = () => userEvent.click(screen.getByRole("button", { name: draftTabWords }));
const saveDraft = () => userEvent.click(screen.getByRole("button", { name: saveDraftWords }));
const announceButton = () => screen.getByRole("button", { name: announceWords }) as HTMLButtonElement;

describe("the tabs", () => {
  it("open on Live, which saves a fix as before", async () => {
    const app = openScoring();
    await choose("Assists");

    expect(screen.getByRole("button", { name: liveTabWords }).getAttribute("aria-pressed")).toBe("true");
    await retype(columnWords.points, everyoneWords, "4");
    await save();
    expect(app.scoring.save).toHaveBeenCalledExactlyOnceWith(withAssists(4), REVISION);
    expect(app.scoring.saveDraft).not.toHaveBeenCalled();
  });

  it("are the admin's alone: a manager reads the live set, with no tabs or versions", async () => {
    openApp(SCORING_PAGE, managerIn(league), { scoring: { view: { ...ADMINS_VIEW, canEdit: false } } });
    await screen.findByRole("list");

    expect(screen.queryByRole("button", { name: draftTabWords })).toBeNull();
    expect(screen.queryByRole("region", { name: versionsTitle })).toBeNull();
  });
});

describe("the draft patch", () => {
  it("opens on the live set while none is saved, and saves as a draft over none, made from the live version", async () => {
    const app = openScoring();
    await screen.findByRole("list");
    await openDraftTab();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "5");
    await saveDraft();

    expect(app.scoring.saveDraft).toHaveBeenCalledExactlyOnceWith(withAssists(5), REVISION, null);
    expect(app.scoring.save).not.toHaveBeenCalled();
    expect(await screen.findByText(draftSavedWords)).toBeTruthy();
  });

  it("opens on the saved draft, and saves over it", async () => {
    const app = openScoring({ view: { ...ADMINS_VIEW, draft: { part: withAssists(5), savedAt: DRAFT_SAVED_AT } } });
    await screen.findByRole("list");
    await openDraftTab();
    await choose("Assists");

    expect(box(columnWords.points, everyoneWords).value).toBe("5");
    await retype(columnWords.points, everyoneWords, "6");
    await saveDraft();
    expect(app.scoring.saveDraft).toHaveBeenCalledExactlyOnceWith(withAssists(6), REVISION, DRAFT_SAVED_AT);
  });

  it("is announced from a gameweek the server offers, at that gameweek's moment", async () => {
    const app = openScoring({ view: { ...ADMINS_VIEW, draft: { part: withAssists(5), savedAt: DRAFT_SAVED_AT } } });
    await screen.findByRole("list");
    await openDraftTab();

    const gameweek = screen.getByRole("combobox", { name: announceGameweekLabel }) as HTMLSelectElement;
    expect([...gameweek.options].map((option) => option.text)).toEqual(PATCH_GAMEWEEKS.map((each) => patchGameweekWords(each.gameweek, each.takesEffectAt)));
    await userEvent.selectOptions(gameweek, "11");
    await userEvent.click(announceButton());

    expect(app.scoring.announce).toHaveBeenCalledExactlyOnceWith(DRAFT_SAVED_AT, PATCH_GAMEWEEKS[1].takesEffectAt);
    expect(await screen.findByText(announcedWords("26_27.1", 10))).toBeTruthy();
  });

  it("can't be announced until saved, nor with edits since", async () => {
    openScoring({ view: { ...ADMINS_VIEW, draft: { part: withAssists(5), savedAt: DRAFT_SAVED_AT } } });
    await screen.findByRole("list");
    await openDraftTab();
    expect(announceButton().disabled).toBe(false);

    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "6");
    expect(announceButton().disabled).toBe(true);
    expect(screen.getByText(saveDraftFirstWords)).toBeTruthy();
  });

  it("says why an announcement was refused", async () => {
    const app = openScoring({ view: { ...ADMINS_VIEW, draft: { part: withAssists(5), savedAt: DRAFT_SAVED_AT } } });
    const refusal = "The draft patch changes nothing, so it wasn't announced.";
    app.scoring.announce.mockResolvedValueOnce(refusal);
    await screen.findByRole("list");
    await openDraftTab();
    await userEvent.click(announceButton());

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });
});

describe("the versions", () => {
  const FIX: ScoringVersion = { id: "v1" as Id<"siteScoring">, name: "26_27.1", kind: "fix", announcedAt: Date.parse("2026-10-01T10:00:00Z"), takesEffectAt: Date.parse("2026-10-01T10:00:00Z"), fromGameweek: 7 };
  const PATCH: ScoringVersion = { id: "v2" as Id<"siteScoring">, name: "26_27.2", kind: "patch", announcedAt: Date.now(), takesEffectAt: Date.now() + 10 * 24 * 3_600_000, fromGameweek: 11 };
  const withVersions = (versions: ScoringVersion[]): ScoringView => ({ ...ADMINS_VIEW, versions });
  const rows = async () => within(await screen.findByRole("region", { name: versionsTitle })).getAllByRole("row").slice(1);

  it("have a row each, newest first: name, patch or fix, announced on, the gameweek it takes effect from, and its notes; the coming one marked", async () => {
    openScoring({ view: withVersions([FIX, PATCH]) });

    const [coming, fix] = await rows();
    expect(within(coming).getByRole("rowheader").textContent).toBe(`26_27.2${comingWords}`);
    expect(fix.textContent).toContain(screenMoment(FIX.announcedAt));
    expect(fix.textContent).toContain("Fix");
    expect(fix.textContent).toContain("Gameweek 7");
    expect(within(fix).getByRole("link").getAttribute("href")).toBe("/patch-notes#version-26_27.1");
    expect(within(fix).queryByRole("button", { name: withdrawWords })).toBeNull();
  });

  it("withdraw the coming patch on a confirm", async () => {
    const app = openScoring({ view: withVersions([FIX, PATCH]) });
    const [coming] = await rows();

    await userEvent.click(within(coming).getByRole("button", { name: withdrawWords }));
    expect(app.scoring.withdraw).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: withdrawYesWords }));

    expect(app.scoring.withdraw).toHaveBeenCalledExactlyOnceWith(PATCH.id);
    await waitFor(() => expect(screen.queryByRole("button", { name: withdrawYesWords })).toBeNull());
  });
});
