// League settings' trades (#383): who reviews an accepted trade, a commissioner veto for a new
// league, and the trade deadline, off by default (Craig, 6 Nov 2026, on #383), saved with the rest.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { blankTradeDeadlineWords, tradeDeadlineHint, tradeDeadlineLabel, tradeDeadlineWords, tradeReviewWords } from "../../../src/leagueSettings/words";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { descriptionOf } from "../../support/src/describedBy";
import { REVISION } from "../../support/src/leagueSettings.harness";
import { FIRST_SETTINGS, openedOn, save, savedSettings } from "../../support/src/leagueSettingsScreen.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const deadlinePicker = () => screen.getByRole("combobox", { name: tradeDeadlineLabel }) as HTMLSelectElement;
const deadlineTick = () => screen.getByRole("checkbox", { name: tradeDeadlineWords }) as HTMLInputElement;
const withTrades = (trades: Partial<typeof FIRST_SETTINGS.trades>) => ({
  view: { part: { ...FIRST_SETTINGS, trades: { ...FIRST_SETTINGS.trades, ...trades } }, revision: REVISION, changesFrom: CHANGES_FROM },
});

describe("the trade settings (#383)", () => {
  it("opens on a new league's: a commissioner veto and no trade deadline, with no picker for one", async () => {
    await openedOn("trades");

    expect(radio(tradeReviewWords.veto).checked).toBe(true);
    expect(deadlineTick().checked).toBe(false);
    expect(screen.queryByRole("combobox", { name: tradeDeadlineLabel })).toBeNull();
  });

  it.each([["none"], ["vote"]] as const)("saves a review by %s with the rest of the settings", async (review) => {
    const app = await openedOn("trades");
    await userEvent.click(radio(tradeReviewWords[review]));
    await save();

    expect(savedSettings(app).trades).toEqual({ review, deadline: null });
  });

  it("saves a trade deadline turned on and a gameweek of the season chosen, its picker described by its hint", async () => {
    const app = await openedOn("trades");
    await userEvent.click(deadlineTick());
    expect(descriptionOf(deadlinePicker())).toBe(tradeDeadlineHint(PL_GAMEWEEKS));
    expect([...deadlinePicker().options].filter(({ disabled }) => !disabled)).toHaveLength(PL_GAMEWEEKS);
    await userEvent.selectOptions(deadlinePicker(), "30");
    await save();

    expect(savedSettings(app).trades).toEqual({ review: "veto", deadline: 30 });
  });

  it("opens on a league's trade deadline, and saves it turned off as none", async () => {
    const app = await openedOn("trades",withTrades({ deadline: 30 }));
    expect(deadlinePicker().value).toBe("30");

    await userEvent.click(deadlineTick());
    await save();

    expect(savedSettings(app).trades.deadline).toBeNull();
  });

  it("with the trade deadline turned on but no gameweek chosen, refuses the save itself and asks the server nothing", async () => {
    const app = await openedOn("trades");
    await userEvent.click(deadlineTick());
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(blankTradeDeadlineWords);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of the chosen gameweek", async () => {
    const app = await openedOn("trades");
    const refusal = "The trade deadline's gameweek must be a whole number from 1 to 38, not 39.";
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await userEvent.click(deadlineTick());
    await userEvent.selectOptions(deadlinePicker(), "38");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });
});
