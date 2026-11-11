// The reader's own undo on the draft room (spec/04, The draft room; the approved picture's
// interaction notes; #1458): for the 10 seconds after a pick he made himself, his panel's Draft
// button is Undo with the time left, frozen while the draft is paused; never for another team's
// pick, an auto-pick or the commissioner's, and never once the 10 seconds are up.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { DRAFT_PATH } from "../../../src/frame/menu";
import type { DraftState } from "../../../src/draft/seam";
import { allPickedWords, draftPlayerWords, PLAYERS_TITLE, selectLabel, undoMyPickWords } from "../../../src/draft/words";
import { draftOrder, YOUR_TEAM, type DraftData } from "../../support/src/draft.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const SAKA: ListedPlayer = {
  code: 1,
  name: "Saka",
  fullName: "Saka",
  club: { code: 3, name: "Arsenal", shortName: "ARS" },
  positions: ["W"],
  ownerTeamName: null,
  onWaivers: null,
  seasonPoints: null,
  points: null,
  figures: NO_FIGURES,
  stat: null,
};

/** Team 3 on the clock at pick 3, its clock starting `startsIn` from now, after the last pick,
 *  Team 2's (the reader's), made by `ownPickBy`'s manager himself or by no one. */
function afterPick(startsIn: number, ownPickBy: Id<"teams"> | null = YOUR_TEAM, paused = false): DraftState {
  const now = Date.now();
  const startsAt = now + startsIn;
  return {
    status: "live",
    startedAt: now - MINUTE_MS,
    rounds: 2,
    order: draftOrder,
    picksMade: 2,
    ownPickBy,
    onTheClock: { pick: 3, round: 1, teamId: draftOrder[2].teamId, name: draftOrder[2].name },
    clock: { startsAt, endsAt: startsAt + 90 * SECOND_MS, pausedAt: paused ? now : undefined },
  };
}

const openDraft = async (data: DraftData) => {
  const app = openApp(DRAFT_PATH, manager, { draft: { players: [SAKA], ...data } });
  await userEvent.click(within(await screen.findByRole("region", { name: PLAYERS_TITLE })).getByRole("button", { name: selectLabel(SAKA.name) }));
  return app;
};
const undoButton = () => screen.queryByRole("button", { name: new RegExp(`^${undoMyPickWords}`) });

describe("the Undo button", () => {
  it("takes the Draft button's place, with the time left, and undoes the reader's own pick", async () => {
    const app = await openDraft({ draft: afterPick(7 * SECOND_MS) });
    const button = undoButton()!;
    expect(button.textContent).toMatch(/^Undo0:0[67] left$/);
    expect(screen.queryByRole("button", { name: draftPlayerWords(SAKA.name) })).toBeNull();
    await userEvent.click(button);
    expect(app.draft.changes.undoMyPick).toHaveBeenCalledWith(expect.anything());
  });

  it("stands still while the draft is paused", async () => {
    await openDraft({ draft: afterPick(4 * SECOND_MS, YOUR_TEAM, true) });
    expect(undoButton()!.textContent).toBe("Undo0:04 left");
  });

  it("isn't there once the 10 seconds are up", async () => {
    await openDraft({ draft: afterPick(-SECOND_MS) });
    expect(undoButton()).toBeNull();
    expect(screen.getByRole("button", { name: draftPlayerWords(SAKA.name) })).toBeTruthy();
  });

  it("isn't there for another team's pick, an auto-pick or the commissioner's", async () => {
    await openDraft({ draft: afterPick(7 * SECOND_MS, draftOrder[0].teamId) });
    expect(undoButton()).toBeNull();
    await openDraft({ draft: afterPick(7 * SECOND_MS, null) });
    expect(undoButton()).toBeNull();
  });

  it("runs on after the last pick, until the draft ends", async () => {
    const ending: DraftState = { status: "ending", startedAt: 0, rounds: 2, order: draftOrder, picksMade: 6, endsAt: Date.now() + 5 * SECOND_MS, pausedAt: undefined, ownPickBy: YOUR_TEAM };
    await openDraft({ draft: ending });
    expect(undoButton()!.textContent).toMatch(/^Undo0:0[45] left$/);
  });

  it("leaves everyone else's Draft button saying every pick is made while the draft ends", async () => {
    const ending: DraftState = { status: "ending", startedAt: 0, rounds: 2, order: draftOrder, picksMade: 6, endsAt: Date.now() + 5 * SECOND_MS, pausedAt: undefined, ownPickBy: draftOrder[0].teamId };
    await openDraft({ draft: ending });
    expect(undoButton()).toBeNull();
    const button = screen.getByRole("button", { name: draftPlayerWords(SAKA.name) });
    expect(button).toHaveProperty("disabled", true);
    expect(within(button).getByText(allPickedWords)).toBeTruthy();
  });
});
