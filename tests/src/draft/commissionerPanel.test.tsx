// The draft room's commissioner panel (#1101; spec/04, Starting it and The commissioner): only whoever
// runs the league sees it. Before the start he starts the draft, says "I'll pick for" a team with no
// manager, and sets the pick time; while it runs he pauses or resumes it, undoes the last pick, picks
// the selected player for the team on the clock (#1475), and sets the pick time only while paused
// (Craig, 5 Nov 2026, on #1101).

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import type { DraftState } from "../../../src/draft/seam";
import {
  badPickTimeWords,
  changeStartWords,
  COMMISSIONER_TITLE,
  draftPlayerWords,
  notLegalWords,
  pauseWords,
  pickForTeamWords,
  pickForWhyNotWords,
  pickForWords,
  pickTimeLabel,
  resumeWords,
  selectLabel,
  startNowWords,
  stopPickingForWords,
  undoLastWords,
  unmanagedWords,
  whilePausedWords,
  youPickForWords,
} from "../../../src/draft/words";
import { DRAFT_PATH } from "../../../src/frame/menu";
import { SETTINGS_DRAFT_HASH, settingsPath } from "../../../src/leagueSettings/paths";
import { commissionerView, draftOrder, emptyBoard, type DraftData } from "../../support/src/draft.harness";
import { RICE } from "../../support/src/scoutingScreen.harness";
import { coCommissioned, commissioner, league, manager, managerIn, openApp } from "../../support/src/shell.harness";

const openAs = (session: typeof manager, draft: DraftData = {}) => openApp(DRAFT_PATH, session, { draft });
const panel = () => screen.findByRole("region", { name: COMMISSIONER_TITLE });
const button = async (name: string) => within(await panel()).getByRole("button", { name });
const pickTimeBox = async () => within(await panel()).getByLabelText(pickTimeLabel) as HTMLInputElement;

/** Team 1's Saka made pick 1; Team 2 is on the clock, or paused there. */
function liveDraft(paused = false): Extract<DraftState, { status: "live" }> {
  const now = Date.now();
  return {
    status: "live",
    startedAt: now - MINUTE_MS,
    rounds: 2,
    order: draftOrder,
    picksMade: 1,
    onTheClock: { pick: 2, round: 1, teamId: draftOrder[1].teamId, name: draftOrder[1].name },
    clock: { startsAt: now - 42 * SECOND_MS, endsAt: now + 48 * SECOND_MS, pausedAt: paused ? now : undefined },
  };
}
const oneTaken = { ...emptyBoard, picks: [{ pick: 1, teamId: draftOrder[0].teamId, auto: false, player: { code: 1, name: "Saka", clubShortName: "ARS", position: "W" as const } }] };

describe("who sees it", () => {
  it("is shown to the commissioner", async () => {
    openAs(commissioner);
    expect(await panel()).toBeTruthy();
  });

  it("is shown to the co-commissioner", async () => {
    openAs(managerIn(coCommissioned));
    expect(await panel()).toBeTruthy();
  });

  it("is never shown to a manager, nor read for him", async () => {
    const app = openAs(manager);
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("region", { name: COMMISSIONER_TITLE })).toBeNull();
    expect(app.draft.useCommissioner).not.toHaveBeenCalled();
  });

  it("is gone once the draft is over", async () => {
    const over: DraftState = { status: "over", startedAt: Date.now(), rounds: 1, order: draftOrder, picksMade: 3 };
    openAs(commissioner, { draft: over });
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("region", { name: COMMISSIONER_TITLE })).toBeNull();
  });
});

describe("before the start", () => {
  it("starts the draft now", async () => {
    const app = openAs(commissioner);
    await userEvent.click(await button(startNowWords));
    expect(app.draft.changes.start).toHaveBeenCalledWith(league.leagueId);
  });

  it("Change the start opens League settings' draft panel, the start date's home (#1476)", async () => {
    openAs(commissioner);
    const link = within(await panel()).getByRole("link", { name: changeStartWords });
    expect(link.getAttribute("href")).toBe(`${settingsPath(league.leagueId)}#${SETTINGS_DRAFT_HASH}`);
  });

  it("offers no Change the start once the draft runs", async () => {
    openAs(commissioner, { draft: liveDraft() });
    expect(within(await panel()).queryByRole("link", { name: changeStartWords })).toBeNull();
  });

  it("offers I'll pick for each team with no manager, saying it is on auto-pick until then", async () => {
    const app = openAs(commissioner);
    expect(within(await panel()).getByText(unmanagedWords("Team 3"))).toBeTruthy();
    await userEvent.click(await button(pickForTeamWords("Team 3")));
    expect(app.draft.changes.markForCommissioner).toHaveBeenCalledWith(league.leagueId, draftOrder[2].teamId, true);
  });

  it("offers Stop picking for a team he has taken on", async () => {
    const app = openAs(commissioner, { commissioner: { ...commissionerView, unmanaged: [{ ...commissionerView.unmanaged[0], marked: true }] } });
    expect(within(await panel()).getByText(youPickForWords("Team 3"))).toBeTruthy();
    await userEvent.click(await button(stopPickingForWords("Team 3")));
    expect(app.draft.changes.markForCommissioner).toHaveBeenCalledWith(league.leagueId, draftOrder[2].teamId, false);
  });

  it("changes the pick time, typed in seconds, minutes or hours", async () => {
    const app = openAs(commissioner);
    const box = await pickTimeBox();
    expect(box.value).toBe("90s");
    await userEvent.clear(box);
    await userEvent.type(box, "2m{Enter}");
    expect(app.draft.changes.setPickTime).toHaveBeenCalledWith(league.leagueId, 120);
  });

  it("says how to type a pick time it can't read, and saves nothing", async () => {
    const app = openAs(commissioner);
    const box = await pickTimeBox();
    await userEvent.clear(box);
    await userEvent.type(box, "soon{Enter}");
    expect(within(await panel()).getByRole("alert").textContent).toBe(badPickTimeWords);
    expect(app.draft.changes.setPickTime).not.toHaveBeenCalled();
  });
});

describe("while it runs", () => {
  it("pauses the draft, and undoes the last pick, saying what it was", async () => {
    const app = openAs(commissioner, { draft: liveDraft(), board: oneTaken });
    expect(within(await panel()).getByText("Last pick: Team 1 took Saka ARS, 1.01")).toBeTruthy();
    await userEvent.click(await button(pauseWords));
    expect(app.draft.changes.pause).toHaveBeenCalledWith(league.leagueId);
    await userEvent.click(await button(undoLastWords));
    expect(app.draft.changes.undo).toHaveBeenCalledWith(league.leagueId);
  });

  it("offers no undo before any pick is made", async () => {
    openAs(commissioner, { draft: { ...liveDraft(), picksMade: 0 } });
    expect((await button(undoLastWords)).hasAttribute("disabled")).toBe(true);
  });

  it("greys the pick time while it runs unpaused", async () => {
    openAs(commissioner, { draft: liveDraft(), board: oneTaken });
    expect((await pickTimeBox()).disabled).toBe(true);
    expect(within(await panel()).getByText(whilePausedWords)).toBeTruthy();
  });

  it("while paused, resumes it and changes the pick time", async () => {
    const app = openAs(commissioner, { draft: liveDraft(true), board: oneTaken });
    const box = await pickTimeBox();
    expect(box.disabled).toBe(false);
    await userEvent.clear(box);
    await userEvent.type(box, "60{Enter}");
    expect(app.draft.changes.setPickTime).toHaveBeenCalledWith(league.leagueId, 60);
    await userEvent.click(await button(resumeWords));
    expect(app.draft.changes.resume).toHaveBeenCalledWith(league.leagueId);
  });

  describe("Pick for the team on the clock (#1475)", () => {
    const pickFor = () => button(pickForWords("Team 2"));
    const select = async (name: string) => userEvent.click(await screen.findByRole("button", { name: selectLabel(name) }));

    it("is greyed until a player is selected", async () => {
      openAs(commissioner, { draft: liveDraft(), board: oneTaken, players: [RICE] });
      expect((await pickFor()).hasAttribute("disabled")).toBe(true);
    });

    it("picks the selected player for the team on the clock, and lets him go", async () => {
      const app = openAs(commissioner, { draft: liveDraft(), board: oneTaken, players: [RICE] });
      await select("Rice");
      await userEvent.click(await pickFor());
      expect(app.draft.changes.pickFor).toHaveBeenCalledWith(league.leagueId, draftOrder[1].teamId, RICE.code);
      expect(app.draft.changes.makePick).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: draftPlayerWords("Rice") })).toBeNull();
    });

    it("works while paused too", async () => {
      const app = openAs(commissioner, { draft: liveDraft(true), board: oneTaken, players: [RICE] });
      await select("Rice");
      await userEvent.click(await pickFor());
      expect(app.draft.changes.pickFor).toHaveBeenCalledWith(league.leagueId, draftOrder[1].teamId, RICE.code);
    });

    it("is greyed by the team on the clock's squad rules, not his own, saying why", async () => {
      const app = openAs(commissioner, { draft: liveDraft(), board: oneTaken, players: [RICE], greyed: [], greyedOnTheClock: [{ code: RICE.code, reason: "clubFull" }] });
      await select("Rice");
      expect((await pickFor()).hasAttribute("disabled")).toBe(true);
      expect(within(await panel()).getByText(pickForWhyNotWords("Rice", "Team 2", notLegalWords.clubFull))).toBeTruthy();
      expect(app.draft.useGreyedOnTheClock).toHaveBeenCalledWith(league.leagueId);
    });

    it("says why the pick is refused", async () => {
      openAs(commissioner, { draft: liveDraft(), board: oneTaken, players: [RICE], refusal: "The draft is over." });
      await select("Rice");
      await userEvent.click(await pickFor());
      expect((await within(await panel()).findByRole("alert")).textContent).toBe("The draft is over.");
    });

    it("isn't offered before the start", async () => {
      openAs(commissioner);
      expect(within(await panel()).queryByRole("button", { name: pickForWords("Team 2") })).toBeNull();
    });
  });

  // #1531: the room's reads took the minute, so as it turned Convex answered undefined for the new
  // args, the page blanked to Loading and the selected player and a half-typed pick time were lost.
  it("keeps the selected player and a half-typed pick time as the minute turns", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const app = openAs(commissioner, { draft: liveDraft(true), board: oneTaken, players: [RICE] });
    // Like Convex's useQuery: nothing yet for a minute it hasn't answered.
    let answered: number | undefined;
    app.draft.useCommissioner.mockImplementation((_, now) => {
      answered ??= now;
      return now === answered ? commissionerView : undefined;
    });
    await userEvent.click(await screen.findByRole("button", { name: selectLabel("Rice") }));
    const box = await pickTimeBox();
    await userEvent.clear(box);
    await userEvent.type(box, "3m");

    act(() => vi.advanceTimersByTime(MINUTE_MS));

    expect(app.draft.useDraft).toHaveBeenLastCalledWith(league.leagueId);
    expect(app.draft.useCommissioner.mock.lastCall![1]).not.toBe(answered);
    expect((await button(pickForWords("Team 2"))).hasAttribute("disabled")).toBe(false);
    expect((await pickTimeBox()).value).toBe("3m");
  });

  it("says why a change is refused", async () => {
    openAs(commissioner, { draft: liveDraft(), board: oneTaken, refusal: "The draft is already paused." });
    await userEvent.click(await button(pauseWords));
    expect((await within(await panel()).findByRole("alert")).textContent).toBe("The draft is already paused.");
  });
});
