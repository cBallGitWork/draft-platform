// The site's scoring patches as managers meet them (#356; spec/14 Changes and corrections): a banner
// from a patch's announcement until it takes effect, which each manager can dismiss and which links
// to the patch notes; and the notes, every version's changes, for anyone signed in.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS } from "../../../convex/shared/time";
import { TABLE_PATH } from "../../../src/frame/menu";
import { mainMenuLabel } from "../../../src/frame/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { PATCH_NOTES_PATH } from "../../../src/patches/paths";
import type { VersionNotes, WaitingPatch } from "../../../src/patches/seam";
import {
  bannerWords,
  dismissWords,
  fromWords,
  KIND_WORDS,
  loadingWords,
  noVersionsWords,
  nothingScoresDifferentlyWords,
  PATCH_NOTES_TITLE,
  patchNotesLinkWords,
} from "../../../src/patches/words";
import { scoringPath } from "../../../src/scoring/paths";
import { SCORING_TITLE } from "../../../src/scoring/words";
import { SIGN_IN_PATH } from "../../../src/signIn/paths";
import { league, manager, newcomer, openApp, visitor } from "../../support/src/shell.harness";

const TAKES_EFFECT = Date.parse("2026-11-01T12:00:00Z");
const WAITING: WaitingPatch = { versionId: "version-2" as Id<"siteScoring">, name: "26_27.2", takesEffectAt: TAKES_EFFECT };
const NOTES: VersionNotes[] = [
  { name: "26_27.2", kind: "patch", announcedAt: TAKES_EFFECT - 7 * DAY_MS, takesEffectAt: TAKES_EFFECT, changes: ["Assists: 3 → 4", "Tackles: newly scored, 1 per action"] },
  { name: "26_27.1", kind: "fix", announcedAt: TAKES_EFFECT - 9 * DAY_MS, takesEffectAt: TAKES_EFFECT - 9 * DAY_MS, changes: [] },
];

const banner = () => screen.findByText(bannerWords(WAITING.name, WAITING.takesEffectAt));

describe("the banner", () => {
  it("#356 Done: shows the waiting patch and when it takes effect, on a manager's frame", async () => {
    openApp(TABLE_PATH, manager, { patches: { banner: WAITING } });
    expect((await banner()).closest("[role=status]")).toBeTruthy();
  });

  it("tells the moment on London's clock with its zone, as the patch's letter does", () => {
    expect(bannerWords(WAITING.name, TAKES_EFFECT)).toBe("Scoring patch 26_27.2 takes effect on Sunday 1 November at 12:00 GMT.");
    expect(fromWords(TAKES_EFFECT)).toBe("From Sunday 1 November at 12:00 GMT");
  });

  it("shows on the frame of someone in no league too", async () => {
    openApp(LEAGUES_PATH, newcomer, { patches: { banner: WAITING } });
    expect(await banner()).toBeTruthy();
  });

  it("shows nothing while no patch waits", async () => {
    openApp(TABLE_PATH, manager);
    await screen.findByRole("navigation", { name: mainMenuLabel });
    expect(screen.queryByRole("button", { name: dismissWords })).toBeNull();
  });

  it("#356 Done: links to the patch notes", async () => {
    const app = openApp(TABLE_PATH, manager, { patches: { banner: WAITING, notes: NOTES } });
    const strip = (await banner()).closest("[role=status]") as HTMLElement;
    await userEvent.click(within(strip).getByRole("link", { name: patchNotesLinkWords }));
    expect(app.path()).toBe(PATCH_NOTES_PATH);
  });

  it("#356 Done: Dismiss asks to dismiss that patch's banner", async () => {
    const app = openApp(TABLE_PATH, manager, { patches: { banner: WAITING } });
    await banner();
    await userEvent.click(screen.getByRole("button", { name: dismissWords }));
    expect(app.patches.dismiss).toHaveBeenCalledWith(WAITING.versionId);
  });

  // Dismiss is a button drawn as a link (plate.md, Colour roles: link). Its underline under the
  // pointer and with focus is CSS (src/styles.css), which jsdom doesn't apply, so only the class is
  // checked here; the screenshots check the look.
  it("draws Dismiss as a link", async () => {
    openApp(TABLE_PATH, manager, { patches: { banner: WAITING } });
    await banner();
    expect(screen.getByRole("button", { name: dismissWords }).classList).toContain("link-look");
  });

  it("a refused dismissal says why", async () => {
    const app = openApp(TABLE_PATH, manager, { patches: { banner: WAITING } });
    app.patches.dismiss.mockResolvedValue("That patch doesn't exist.");
    await banner();
    await userEvent.click(screen.getByRole("button", { name: dismissWords }));
    expect((await screen.findByRole("alert")).textContent).toBe("That patch doesn't exist.");
  });
});

describe("the patch notes", () => {
  it("#356 Done: list every version, newest first, with what kind, from when, and each change", async () => {
    openApp(PATCH_NOTES_PATH, manager, { patches: { notes: NOTES } });
    expect(await screen.findByRole("heading", { level: 1, name: PATCH_NOTES_TITLE })).toBeTruthy();
    const versions = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(versions).toEqual([
      `26_27.2${KIND_WORDS.patch}${fromWords(TAKES_EFFECT)}`,
      `26_27.1${KIND_WORDS.fix}${fromWords(TAKES_EFFECT - 9 * DAY_MS)}`,
    ]);
    const patch = screen.getByRole("listitem", { name: /26_27\.2/ });
    expect(within(patch).getAllByRole("listitem").map((item) => item.textContent)).toEqual(NOTES[0].changes);
    expect(within(screen.getByRole("listitem", { name: /26_27\.1/ })).getByText(nothingScoresDifferentlyWords)).toBeTruthy();
  });

  it("say so before any version", async () => {
    openApp(PATCH_NOTES_PATH, manager);
    expect(await screen.findByText(noVersionsWords)).toBeTruthy();
  });

  it("say they're loading while on their way", async () => {
    openApp(PATCH_NOTES_PATH, manager, { patches: { loading: true } });
    expect(await screen.findByText(loadingWords)).toBeTruthy();
  });

  it("someone in no league reads them too", async () => {
    openApp(PATCH_NOTES_PATH, newcomer, { patches: { notes: NOTES } });
    expect(await screen.findByRole("heading", { level: 1, name: PATCH_NOTES_TITLE })).toBeTruthy();
  });

  it("a visitor is sent to sign in", async () => {
    const app = openApp(PATCH_NOTES_PATH, visitor);
    await waitFor(() => expect(app.path()).toBe(SIGN_IN_PATH));
  });

  it("Player scoring links to them", async () => {
    const app = openApp(scoringPath(league.leagueId), manager);
    const title = await screen.findByRole("heading", { level: 1, name: SCORING_TITLE });
    await userEvent.click(within(title.parentElement!).getByRole("link", { name: patchNotesLinkWords }));
    expect(app.path()).toBe(PATCH_NOTES_PATH);
  });
});
