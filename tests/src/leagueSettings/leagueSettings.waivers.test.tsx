// League settings' waivers (#1200; spec/03, spec/08; the waivers picture's Waivers tab): the order's
// type, each explained, and the runs as day and time rows, with Remove and Add a run, saved with
// the rest; at least one run and no time twice; the waiver order beside them.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WAIVER_ORDER_TITLE, waiverOrderNote, waiverOrderWords } from "../../../src/myTeam/claims/words";
import { addRunWords, removeRunLabel, runDayLabel, runTimeLabel, runTwiceWords } from "../../../src/leagueSettings/words";
import { NO_WAIVERS } from "../../support/src/myTeam.harness";
import { openedSettings, save, savedSettings } from "../../support/src/leagueSettingsScreen.harness";

const select = (name: string) => screen.getByRole("combobox", { name }) as HTMLSelectElement;
const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;

describe("the waiver settings (#1200)", () => {
  it("opens on a new league's: reverse table order, Wednesday and Thursday at 18:00", async () => {
    await openedSettings();

    expect(radio(waiverOrderWords.reverseStandings).checked).toBe(true);
    expect([select(runDayLabel(1)).value, select(runTimeLabel(1)).value]).toEqual(["wednesday", "18:0"]);
    expect([select(runDayLabel(2)).value, select(runTimeLabel(2)).value]).toEqual(["thursday", "18:0"]);
  });

  it("saves rotating, a run moved, one removed and one added, with the rest of the settings", async () => {
    const app = await openedSettings();
    await userEvent.click(radio(waiverOrderWords.rotating));
    await userEvent.selectOptions(select(runTimeLabel(1)), "9:30");
    await userEvent.click(screen.getByRole("button", { name: removeRunLabel(2) }));
    await userEvent.click(screen.getByRole("button", { name: addRunWords }));
    await save();

    expect(savedSettings(app).waivers).toEqual({
      order: "rotating",
      runs: [
        { day: "wednesday", hour: 9, minute: 30 },
        { day: "monday", hour: 18, minute: 0 },
      ],
    });
  });

  it("keeps at least one run: the last can't be removed", async () => {
    await openedSettings();
    await userEvent.click(screen.getByRole("button", { name: removeRunLabel(2) }));

    expect((screen.getByRole("button", { name: removeRunLabel(1) }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("refuses two runs at the same time itself, and asks the server nothing", async () => {
    const app = await openedSettings();
    await userEvent.selectOptions(select(runDayLabel(2)), "wednesday");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(runTwiceWords);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the waiver order beside them, its note following the type chosen", async () => {
    await openedSettings({ waivers: NO_WAIVERS });
    const order = () => screen.getByRole("region", { name: WAIVER_ORDER_TITLE });
    expect(within(order()).getByText(waiverOrderNote("reverseStandings", null))).toBeTruthy();

    await userEvent.click(radio(waiverOrderWords.rotating));
    expect(within(order()).getByText(waiverOrderNote("rotating", null))).toBeTruthy();
  });
});
