// My team's Tactics tab, saving (#14; #851): each move saves itself, with no button, from the
// gameweek the server names; its refusal in its words, the move kept; Undo back through every move
// since the tab was opened, across saves; an edit kept sound when the squad changes under it; a
// refusal that clears once the lineup it was about is changed; and an answer that lands after a
// later move, which says nothing.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { saveFailedWords, savedWords, startingWords } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "../../../support/src/tactics.harness";
import {
  ARRIZABALAGA,
  RAYA,
  SALIBA,
  SAVED,
  SQUAD,
  STARTERS,
  WHITE,
  at,
  blockOf,
  member,
  openTacticsTab,
  benchOrder,
  openedPitch,
  pickFormation,
  pickUp,
  pitch,
  swap,
  undo,
} from "../../../support/src/tacticsScreen.harness";

const REFUSAL = "A lineup starts 11 players; this one starts 5.";
/** Saliba's cell, left-centre of defence, which White swaps into. */
const SALIBAS_CELL = { area: "defence", lane: "leftCentre" } as const;

/** White, on the bench, swapped in for Saliba, once the tab is up. */
const whiteForSaliba = () => swap(WHITE, SALIBA);

/** White swapped in for Saliba, the server answering `answer`; the app and its alert. */
async function refusedWith(answer: string) {
  const app = openTacticsTab({ tactics: SAVED, saveAnswer: answer });
  await whiteForSaliba();
  return { app, alert: await screen.findByRole("alert") };
}

describe("saving", () => {
  it("saves nothing until something moves, then saves each move as it stands, with no button", async () => {
    const app = await openedPitch();
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    const statusesBefore = screen.getAllByRole("status");

    await swap(ARRIZABALAGA, RAYA);

    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, {
      starters: [at(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" }), ...STARTERS.slice(1)],
      bench: [RAYA.playerCode, WHITE.playerCode],
    });
    const saved = await screen.findByText(savedWords(TACTICS_GAMEWEEK));
    // The live region was in the page, empty, before the save, so the words are announced.
    expect(saved.getAttribute("role")).toBe("status");
    expect(statusesBefore).toContain(saved);
  });

  it("names the gameweek the server saved it from: the one after, if the deadline passed on the way", async () => {
    await openedPitch({ tactics: SAVED, saveAnswer: TACTICS_GAMEWEEK + 1 });
    await whiteForSaliba();
    expect(await screen.findByText(savedWords(TACTICS_GAMEWEEK + 1))).toBeTruthy();
  });

  it("shows the server's refusal in its words, keeping the move", async () => {
    expect((await refusedWith(REFUSAL)).alert.textContent).toBe(REFUSAL);
    expect(blockOf(WHITE, SALIBAS_CELL)).toBeTruthy();
  });

  it("says a save that failed for another reason plainly", async () => {
    expect((await refusedWith(saveFailedWords)).alert.textContent).toBe(saveFailedWords);
  });

  describe("a refusal, once the lineup it was about is changed (#622)", () => {
    it("clears when a player moves and the move saves", async () => {
      const { app } = await refusedWith(REFUSAL);
      app.myTeam.lineupChanges.save.mockResolvedValueOnce(TACTICS_GAMEWEEK);
      await swap(SALIBA, WHITE);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("stays while a player is only picked up, nothing yet changed", async () => {
      await refusedWith(REFUSAL);
      await pickUp(RAYA);
      expect(screen.getByRole("alert").textContent).toBe(REFUSAL);
    });

    it("clears when a preset is picked and saves", async () => {
      const { app } = await refusedWith(REFUSAL);
      app.myTeam.lineupChanges.save.mockResolvedValueOnce(TACTICS_GAMEWEEK);
      await pickFormation("4-4-2");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("an answer that lands after a later move (#642)", () => {
    /** White swapped in for Saliba, the server holding back its `answer`; Saliba then swapped
     *  back in if `moveAfter`, and the first answer let go. */
    async function answerLands(answer: number | string, moveAfter: boolean) {
      const app = openTacticsTab({ tactics: SAVED, saveAnswer: answer, saveHeld: true });
      await whiteForSaliba();
      if (moveAfter) {
        // The later move's own save answers at once, so only the first is still waiting.
        app.myTeam.lineupChanges.save.mockResolvedValueOnce(TACTICS_GAMEWEEK + 1);
        await swap(SALIBA, WHITE);
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
    await whiteForSaliba();
    await screen.findByText(savedWords(TACTICS_GAMEWEEK));
    await swap(ARRIZABALAGA, RAYA);
    await swap(SALIBA, WHITE);
    const { calls } = app.myTeam.lineupChanges.save.mock;
    expect(calls).toHaveLength(3);
    const [[, afterOne], [, afterTwo]] = calls;

    await userEvent.click(undo());
    expect(blockOf(WHITE, SALIBAS_CELL)).toBeTruthy();
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, afterTwo);
    await userEvent.click(undo());
    expect(blockOf(RAYA, { area: "goalkeeper", lane: "centre" })).toBeTruthy();
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
    await whiteForSaliba();

    const SAKA = member(7, "Saka", ["W"]);
    act(() => app.myTeam.serverHolds(openTactics({ ...SAVED, squad: [...SQUAD.filter((each) => each !== WHITE), SAKA] })));

    expect(await screen.findByText(startingWords(STARTERS.length - 1))).toBeTruthy();
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${WHITE.name},`) })).toBeNull();
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, SALIBA.name, SAKA.name]);
  });
});
