// My team's Tactics tab: the two team instructions (spec/05, Team instructions; #990), picked side
// by side in the toolbar, each offering only what the formation's shape allows, and kept or
// switched when the formation changes.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { instructionLabel, instructionsTitle } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { OPEN_PICKED } from "../../../support/src/tactics.harness";
import { openedPitch, pickFormation, SAVED } from "../../../support/src/tacticsScreen.harness";

const picker = (side: "attacking" | "defensive") => screen.getByRole("combobox", { name: instructionLabel(side) }) as HTMLSelectElement;
const offered = (side: "attacking" | "defensive") => within(picker(side)).getAllByRole("option").map((option) => option.textContent);

describe("team instructions", () => {
  it("offers on each side only what the shape allows, on the picks held", async () => {
    // One at the back, one up top, nobody wide: Boot it is offered; Gung-ho, Get it wide, Press
    // high, Hold a high line and Park the bus aren't.
    await openedPitch();
    expect(offered("attacking")).toEqual(["Play out from the back", "Boot it to the big man", "Shoot on sight"]);
    expect(offered("defensive")).toEqual(["Clear it", "Get stuck in", "Keep it tight early"]);
    expect(picker("attacking").value).toBe(OPEN_PICKED.attacking);
    expect(picker("defensive").value).toBe(OPEN_PICKED.defensive);
  });

  it("saves a pick with the lineup, the other side kept", async () => {
    const app = await openedPitch();
    await userEvent.selectOptions(picker("attacking"), "Shoot on sight");
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, {
      starters: SAVED.lineup.starters,
      bench: SAVED.lineup.bench,
      instructions: { attacking: "shootOnSight", defensive: OPEN_PICKED.defensive },
    });
  });

  it("switches a pick the new formation blocks to its default, and says so under the toolbar", async () => {
    const app = await openedPitch();
    await userEvent.selectOptions(picker("attacking"), "Boot it to the big man");
    await pickFormation("4-4-2");
    expect(await screen.findByText("Boot it to the big man needs one up top and no wingers: switched to Play out from the back")).toBeTruthy();
    expect(picker("attacking").value).toBe("playOutFromTheBack");
    expect(app.myTeam.lineupChanges.save.mock.lastCall![1].instructions).toEqual({ attacking: "playOutFromTheBack", defensive: OPEN_PICKED.defensive });
  });

  it("keeps a pick the new formation allows, with no line", async () => {
    await openedPitch();
    await userEvent.selectOptions(picker("defensive"), "Get stuck in");
    await pickFormation("5-3-2");
    expect(picker("defensive").value).toBe("getStuckIn");
    expect(screen.queryByText(/switched to/)).toBeNull();
  });

  it("lists what each side offers, with what it does, the pick marked", async () => {
    await openedPitch();
    const box = screen.getByRole("region", { name: instructionsTitle(null) });
    const picked = within(box).getAllByRole("listitem").filter((item) => item.getAttribute("aria-current") === "true");
    expect(picked.map((item) => item.firstChild!.textContent)).toEqual(["Play out from the back", "Keep it tight early"]);
    expect(within(box).getByText("Rewards headed goals and the forwards' aerials won; costs the back line's failed long balls.")).toBeTruthy();
    // Get it wide isn't offered here, so it isn't listed.
    expect(within(box).queryByText("Rewards crosses; costs failed crosses.")).toBeNull();
  });
});
