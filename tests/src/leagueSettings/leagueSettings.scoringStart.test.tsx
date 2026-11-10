// League settings' scoring start (#1190; spec/04, After the draft; Craig, 5 Nov 2026, on #1097):
// "scoring starts in gameweek N", offering only ticked gameweeks not begun, saved at once, and
// fixed once N's deadline passes.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { scoringStartRefusals, type ScoringStartView } from "../../../convex/gameweeks/scoringStart";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { noScoringStartChoicesWords, noScoringStartWords, scoringStartLabel } from "../../../src/leagueSettings/words";
import { descriptionOf } from "../../support/src/describedBy";
import { openedSettings } from "../../support/src/leagueSettingsScreen.harness";

const picker = () => screen.getByRole("combobox", { name: scoringStartLabel }) as HTMLSelectElement;
const offered = () => within(picker()).getAllByRole("option").map((option) => option.textContent);

/** Gameweeks 4 to 9, each a week on, gameweek 6 to kick off in an hour: 4 and 5 have begun; 7 is
 *  unticked; 9's kickoff isn't known. */
function season(start: number | null): ScoringStartView {
  const deadlineOf = (gameweek: number) => Date.now() + HOUR_MS + (gameweek - 6) * WEEK_MS;
  return { start, ticked: [...[4, 5, 6, 8].map((gameweek) => ({ gameweek, deadline: deadlineOf(gameweek) })), { gameweek: 9, deadline: null }] };
}

describe("the scoring start (#1190)", () => {
  it("offers only the ticked gameweeks not begun, with none set at first", async () => {
    await openedSettings({ scoringStart: season(null) });

    expect(offered()).toEqual([noScoringStartWords, "GW6", "GW8"]);
    expect(picker().value).toBe("");
  });

  it("saves the gameweek picked at once, apart from the settings' Save", async () => {
    const app = await openedSettings({ scoringStart: season(6) });
    expect(picker().value).toBe("6");
    expect(descriptionOf(picker())).toMatch(/^Earlier gameweeks score nothing and have no head-to-heads\. A change saves at once\. Fixed after /);

    await userEvent.selectOptions(picker(), "GW8");

    expect(app.leagueSettings.setScoringStart).toHaveBeenCalledExactlyOnceWith(expect.anything(), 8);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the server's refusal", async () => {
    const app = await openedSettings({ scoringStart: season(6) });
    app.leagueSettings.setScoringStart.mockResolvedValueOnce(scoringStartRefusals.begun(8));

    await userEvent.selectOptions(picker(), "GW8");

    expect((await screen.findByRole("alert")).textContent).toBe(scoringStartRefusals.begun(8));
  });

  it("is fixed once its deadline passes: no picker, just the gameweek", async () => {
    await openedSettings({ scoringStart: season(5) });

    expect(screen.queryByRole("combobox", { name: scoringStartLabel })).toBeNull();
    expect(screen.getByText("GW5")).toBeTruthy();
    expect(screen.getByText(/Fixed: its deadline, .+, has passed\./)).toBeTruthy();
  });

  it("with none set and every ticked gameweek begun, says there's none to start in", async () => {
    await openedSettings({ scoringStart: { start: null, ticked: season(null).ticked.slice(0, 2) } });

    expect(screen.queryByRole("combobox", { name: scoringStartLabel })).toBeNull();
    expect(screen.getByText(noScoringStartChoicesWords)).toBeTruthy();
  });
});
