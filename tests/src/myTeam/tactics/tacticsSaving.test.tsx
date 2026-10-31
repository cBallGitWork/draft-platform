// My team's Tactics tab, saving (#14): nothing to save until something moves; the lineup saved as it
// stands, from the gameweek the server names; its refusal in its words; Discard; and an edit kept
// sound when the squad changes under it; a refusal that clears once the lineup it was about is changed;
// and an answer that lands after a move, which says nothing.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { discardWords, moveLabel, presetLabel, putHereLabel, saveFailedWords, saveWords, savedWords, startingWords } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "../../../support/src/tactics.harness";
import {
  ARRIZABALAGA,
  HAVERTZ,
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
  save,
  squadRows,
} from "../../../support/src/tacticsScreen.harness";

const REFUSAL = "A lineup starts 11 players; this one starts 4.";

/** White, on the bench, moved to the left of defence, once the tab is up. */
async function whiteToLeftOfDefence() {
  await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));
  await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }));
}

/** White moved to the left of defence and saved, the server answering `answer`; its alert. */
async function refusedWith(answer: string) {
  openTacticsTab({ tactics: SAVED, saveAnswer: answer });
  await whiteToLeftOfDefence();
  await userEvent.click(save());
  return screen.findByRole("alert");
}

describe("saving", () => {
  it("has nothing to save until something moves, then saves the lineup as it stands", async () => {
    const app = openTacticsTab();
    expect((await screen.findByRole("button", { name: saveWords })).hasAttribute("disabled")).toBe(true);

    await userEvent.click(blockOf(HAVERTZ, { area: "attack", lane: "centre" }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(HAVERTZ.name, "attack", "left") }));
    const statusesBefore = screen.getAllByRole("status");
    await userEvent.click(save());

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
    await userEvent.click(save());
    expect(await screen.findByText(savedWords(TACTICS_GAMEWEEK + 1))).toBeTruthy();
  });

  it("shows the server's refusal in its words, keeping the edit", async () => {
    expect((await refusedWith(REFUSAL)).textContent).toBe(REFUSAL);
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("says a save that failed for another reason plainly", async () => {
    expect((await refusedWith(saveFailedWords)).textContent).toBe(saveFailedWords);
  });

  describe("a refusal, once the lineup it was about is changed (#622)", () => {
    it("clears when a player moves", async () => {
      await refusedWith(REFUSAL);
      await userEvent.click(blockOf(WHITE, { area: "defence", lane: "left" }));
      await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "centre") }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("stays while a player is only picked up, nothing yet changed", async () => {
      await refusedWith(REFUSAL);
      await userEvent.click(screen.getByRole("button", { name: moveLabel(HAVERTZ.name) }));
      expect(screen.getByRole("alert").textContent).toBe(REFUSAL);
    });

    it("clears when a preset is picked", async () => {
      await refusedWith(REFUSAL);
      await userEvent.selectOptions(screen.getByRole<HTMLSelectElement>("combobox", { name: presetLabel }), "4-4-2");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("an answer that lands after a player moves (#642)", () => {
    /** White moved to the left of defence and saved, the server holding back its `answer`; White
     *  then moved to the centre if `moveAfter`, and the answer let go. */
    async function answerLands(answer: number | string, moveAfter: boolean) {
      const app = openTacticsTab({ tactics: SAVED, saveAnswer: answer, saveHeld: true });
      await whiteToLeftOfDefence();
      await userEvent.click(save());
      expect(save().hasAttribute("disabled")).toBe(true);
      if (moveAfter) {
        await userEvent.click(blockOf(WHITE, { area: "defence", lane: "left" }));
        await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "centre") }));
      }
      await act(async () => app.myTeam.letSaveGo());
      // The answer has landed: the save no longer waits.
      expect(save().hasAttribute("disabled")).toBe(false);
    }

    it("says nothing of a refusal of the lineup sent", async () => {
      await answerLands(REFUSAL, true);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("says nothing of the lineup sent being saved", async () => {
      await answerLands(TACTICS_GAMEWEEK, true);
      expect(screen.queryByText(savedWords(TACTICS_GAMEWEEK))).toBeNull();
    });

    it("still says a refusal that lands with nothing moved", async () => {
      await answerLands(REFUSAL, false);
      expect(screen.getByRole("alert").textContent).toBe(REFUSAL);
    });

    it("still says a save that lands with nothing moved", async () => {
      await answerLands(TACTICS_GAMEWEEK, false);
      expect(screen.getByText(savedWords(TACTICS_GAMEWEEK))).toBeTruthy();
    });
  });

  it("discards an edit, back to the lineup held", async () => {
    openTacticsTab();
    await whiteToLeftOfDefence();
    await userEvent.click(screen.getByRole("button", { name: discardWords }));

    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${WHITE.name},`) })).toBeNull();
    expect(save().hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: discardWords })).toBeNull();
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
