// League settings' draft (#1087): the draft order, the pick clock, the timeouts before auto-pick and
// where undrafted players go, saved with the rest; and the commissioner's draft order, saved a move
// at a time.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { draftOrderRefusals } from "../../../convex/draft/draftOrder";
import {
  autoPickWords,
  blankPickClockWords,
  blankTimeoutsWords,
  moveDownLabel,
  moveUpLabel,
  neverAutoPickWords,
  pickClockLabel,
  randomOrderHint,
  savedWords,
  teamOrderTitle,
  timeoutsLabel,
} from "../../../src/leagueSettings/words";
import { REVISION, TEAMS_IN_ORDER } from "../../support/src/leagueSettings.harness";
import { box, fill, FIRST_SETTINGS, openedSettings, save, savedSettings } from "../../support/src/leagueSettingsScreen.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const autoPickTick = () => screen.getByRole("checkbox", { name: autoPickWords }) as HTMLInputElement;
const orderPanel = () => screen.queryByRole("region", { name: teamOrderTitle });
const withDraft = (draft: Partial<typeof FIRST_SETTINGS.draft>) => ({
  view: { part: { ...FIRST_SETTINGS, draft: { ...FIRST_SETTINGS.draft, ...draft } }, revision: REVISION, changesFrom: CHANGES_FROM },
});

describe("the draft settings (#1087)", () => {
  it("opens on the league's: the commissioner's order, 90 seconds a pick, auto-pick after 2 timeouts, and waivers", async () => {
    await openedSettings();

    expect(radio("Set by the commissioner").checked).toBe(true);
    expect(box(pickClockLabel).value).toBe("90");
    expect(radio("Seconds").checked).toBe(true);
    expect(autoPickTick().checked).toBe(true);
    expect(box(timeoutsLabel).value).toBe("2");
    expect(radio("Waivers").checked).toBe(true);
  });

  it("saves each one changed with the rest of the settings", async () => {
    const app = await openedSettings();
    await userEvent.click(radio("Random"));
    await fill(pickClockLabel, "8");
    await userEvent.click(radio("Hours"));
    await userEvent.click(autoPickTick());
    await userEvent.click(radio("Free agents"));
    await save();

    expect(savedSettings(app).draft).toEqual({ order: "random", pickSeconds: 8 * 3600, timeoutsBeforeAutoPick: null, undrafted: "freeAgents" });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(savedWords(CHANGES_FROM)));
  });

  it("says a random order is drawn before the draft starts, and offers no order to set", async () => {
    await openedSettings(withDraft({ order: "random" }));

    expect(screen.getByText(randomOrderHint)).toBeTruthy();
    expect(orderPanel()).toBeNull();
  });

  it("shows a clock in the largest unit it is a whole number of, and saves one typed in minutes in seconds", async () => {
    const app = await openedSettings(withDraft({ pickSeconds: 2 * 3600 }));
    expect(box(pickClockLabel).value).toBe("2");
    expect(radio("Hours").checked).toBe(true);

    await userEvent.click(radio("Minutes"));
    await fill(pickClockLabel, "1.5");
    await save();

    expect(savedSettings(app).draft.pickSeconds).toBe(90);
  });

  it("says never, and shows no box, with auto-pick after timeouts off; turned on, its box is saved", async () => {
    const app = await openedSettings(withDraft({ timeoutsBeforeAutoPick: null }));
    expect(screen.getByText(neverAutoPickWords)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: timeoutsLabel })).toBeNull();

    await userEvent.click(autoPickTick());
    await fill(timeoutsLabel, "15");
    await save();

    expect(savedSettings(app).draft.timeoutsBeforeAutoPick).toBe(15);
  });

  it.each([
    ["the pick clock", () => fill(pickClockLabel, ""), blankPickClockWords],
    ["the timeouts", () => fill(timeoutsLabel, ""), blankTimeoutsWords],
  ])("with %s left without a number, refuses the save itself and asks the server nothing", async (_, leaveBlank, words) => {
    const app = await openedSettings();
    await leaveBlank();
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(words);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of a clock under 15 seconds", async () => {
    const app = await openedSettings();
    const refusal = "The pick clock's seconds must be a whole number from 15 to 86400, not 10.";
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await fill(pickClockLabel, "10");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });
});

describe("the commissioner's draft order (#1087)", () => {
  const [saka, kroos, pique] = TEAMS_IN_ORDER;

  it("lists the teams first pick first, offering no Up for the first and no Down for the last", async () => {
    await openedSettings();
    const rows = within(orderPanel()!).getAllByRole("listitem");

    expect(rows.map((row) => row.textContent)).toEqual([`1${saka.name}UpDown`, `2${kroos.name}UpDown`, `3${pique.name}UpDown`]);
    expect(screen.queryByRole("button", { name: moveUpLabel(saka.name) })).toBeNull();
    expect(screen.queryByRole("button", { name: moveDownLabel(pique.name) })).toBeNull();
  });

  it("saves a move at once, without the settings' Save", async () => {
    const app = await openedSettings();
    await userEvent.click(screen.getByRole("button", { name: moveUpLabel(kroos.name) }));

    expect(app.leagueSettings.saveTeamOrder).toHaveBeenCalledExactlyOnceWith(expect.anything(), [kroos.teamId, saka.teamId, pique.teamId]);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of a move", async () => {
    const app = await openedSettings();
    app.leagueSettings.saveTeamOrder.mockResolvedValueOnce(draftOrderRefusals.teamsChanged);
    await userEvent.click(screen.getByRole("button", { name: moveDownLabel(saka.name) }));

    expect((await within(orderPanel()!).findByRole("alert")).textContent).toBe(draftOrderRefusals.teamsChanged);
  });

  it("goes when the order chosen is random, before it is saved", async () => {
    await openedSettings();
    await userEvent.click(radio("Random"));

    expect(orderPanel()).toBeNull();
  });
});
