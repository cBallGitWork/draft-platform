// My team's Tactics tab, saving (#14; #851): each move saves itself, with no button, from the
// gameweek the server names; its refusal in its words, the move kept; Undo back through every move
// since the tab was opened, across saves; an edit kept sound when the squad changes under it; a
// refusal that clears once the lineup it was about is changed; and an answer that lands after a
// later move, which says nothing.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { moveLabel, presetLabel, putHereLabel, saveFailedWords, savedWords, startingWords } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "../../../support/src/tactics.harness";
import {
  ARRIZABALAGA,
  HAVERTZ,
  SALIBA,
  SAVED,
  SQUAD,
  STARTERS,
  WHITE,
  at,
  blockOf,
  member,
  openTacticsTab,
  openedPitch,
  pitch,
  squadRows,
  undo,
} from "../../../support/src/tacticsScreen.harness";

const REFUSAL = "A lineup starts 11 players; this one starts 5.";

/** White, on the bench, moved to the left of defence, once the tab is up. */
async function whiteToLeftOfDefence() {
  await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));
  await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }));
}

/** White moved to the left of defence, the server answering `answer`; the app and its alert. */
async function refusedWith(answer: string) {
  const app = openTacticsTab({ tactics: SAVED, saveAnswer: answer });
  await whiteToLeftOfDefence();
  return { app, alert: await screen.findByRole("alert") };
}

describe("saving", () => {
  it("saves nothing until something moves, then saves each move as it stands, with no button", async () => {
    const app = await openedPitch();
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    const statusesBefore = screen.getAllByRole("status");

    await userEvent.click(blockOf(HAVERTZ, { area: "attack", lane: "centre" }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(HAVERTZ.name, "attack", "left") }));

    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, {
      starters: [...STARTERS.slice(0, 3), at(HAVERTZ, { area: "attack", lane: "left" })],
      bench: [ARRIZABALAGA.playerCode, WHITE.playerCode],
    });
    const saved = await screen.findByText(savedWords(TACTICS_GAMEWEEK));
    // The live region was in the page, empty, before the save, so the words are announced.
    expect(saved.getAttribute("role")).toBe("status");
    expect(statusesBefore).toContain(saved);
  });

  it("names the gameweek the server saved it from: the one after, if the deadline passed on the way", async () => {
    await openedPitch({ tactics: SAVED, saveAnswer: TACTICS_GAMEWEEK + 1 });
    await whiteToLeftOfDefence();
    expect(await screen.findByText(savedWords(TACTICS_GAMEWEEK + 1))).toBeTruthy();
  });

  it("shows the server's refusal in its words, keeping the move", async () => {
    expect((await refusedWith(REFUSAL)).alert.textContent).toBe(REFUSAL);
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("says a save that failed for another reason plainly", async () => {
    expect((await refusedWith(saveFailedWords)).alert.textContent).toBe(saveFailedWords);
  });

  describe("a refusal, once the lineup it was about is changed (#622)", () => {
    it("clears when a player moves and the move saves", async () => {
      const { app } = await refusedWith(REFUSAL);
      app.myTeam.lineupChanges.save.mockResolvedValueOnce(TACTICS_GAMEWEEK);
      await userEvent.click(blockOf(WHITE, { area: "defence", lane: "left" }));
      await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "centre") }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("stays while a player is only picked up, nothing yet changed", async () => {
      await refusedWith(REFUSAL);
      await userEvent.click(screen.getByRole("button", { name: moveLabel(HAVERTZ.name) }));
      expect(screen.getByRole("alert").textContent).toBe(REFUSAL);
    });

    it("clears when a preset is picked and saves", async () => {
      const { app } = await refusedWith(REFUSAL);
      app.myTeam.lineupChanges.save.mockResolvedValueOnce(TACTICS_GAMEWEEK);
      await userEvent.selectOptions(screen.getByRole<HTMLSelectElement>("combobox", { name: presetLabel }), "4-4-2");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("an answer that lands after a later move (#642)", () => {
    /** White moved to the left of defence, the server holding back its `answer`; White then moved
     *  to the centre if `moveAfter`, and the first answer let go. */
    async function answerLands(answer: number | string, moveAfter: boolean) {
      const app = openTacticsTab({ tactics: SAVED, saveAnswer: answer, saveHeld: true });
      await whiteToLeftOfDefence();
      if (moveAfter) {
        // The later move's own save answers at once, so only the first is still waiting.
        app.myTeam.lineupChanges.save.mockResolvedValueOnce(TACTICS_GAMEWEEK + 1);
        await userEvent.click(blockOf(WHITE, { area: "defence", lane: "left" }));
        await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "centre") }));
      }
      await act(async () => app.myTeam.letSaveGo());
    }

    it("says nothing of a refusal of the lineup sent before", async () => {
      await answerLands(REFUSAL, true);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("says nothing of the lineup sent before being saved", async () => {
      await answerLands(TACTICS_GAMEWEEK, true);
      expect(screen.queryByText(savedWords(TACTICS_GAMEWEEK))).toBeNull();
    });

    it("still says a refusal that lands with nothing moved since", async () => {
      await answerLands(REFUSAL, false);
      expect(screen.getByRole("alert").textContent).toBe(REFUSAL);
    });

    it("still says a save that lands with nothing moved since", async () => {
      await answerLands(TACTICS_GAMEWEEK, false);
      expect(screen.getByText(savedWords(TACTICS_GAMEWEEK))).toBeTruthy();
    });
  });
});

describe("Undo (spec/05, Moving players)", () => {
  it("has nothing to undo when the tab opens", async () => {
    await openedPitch();
    expect(undo().disabled).toBe(true);
  });

  it("walks back three moves, one at a time, across their saves, saving each lineup it goes back to", async () => {
    const app = await openedPitch();
    await whiteToLeftOfDefence();
    await screen.findByText(savedWords(TACTICS_GAMEWEEK));
    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "centre") }));
    await userEvent.click(blockOf(HAVERTZ, { area: "attack", lane: "centre" }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(HAVERTZ.name, "attack", "left") }));
    const { calls } = app.myTeam.lineupChanges.save.mock;
    expect(calls).toHaveLength(3);
    const [[, afterOne], [, afterTwo]] = calls;

    await userEvent.click(undo());
    expect(blockOf(HAVERTZ, { area: "attack", lane: "centre" })).toBeTruthy();
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, afterTwo);
    await userEvent.click(undo());
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" })).toBeTruthy();
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, afterOne);
    await userEvent.click(undo());
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${WHITE.name},`) })).toBeNull();
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, { starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode] });
    expect(undo().disabled).toBe(true);
  });
});

describe("the squad changing under an edit", () => {
  it("drops a starter who left and puts one who joined at the end of the bench", async () => {
    const app = await openedPitch();
    await whiteToLeftOfDefence();

    const SAKA = member(7, "Saka", ["W"]);
    act(() => app.myTeam.serverHolds(openTactics({ ...SAVED, squad: [...SQUAD.filter((each) => each !== WHITE), SAKA] })));

    expect(await screen.findByText(startingWords(STARTERS.length))).toBeTruthy();
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${WHITE.name},`) })).toBeNull();
    expect(squadRows().at(-1)).toBe("WSaka ARSMove Up Down");
  });
});
