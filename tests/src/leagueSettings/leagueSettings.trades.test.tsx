// League settings' trades (#383): who reviews an accepted trade, a commissioner veto for a new
// league, and the trade deadline, off by default (Craig, 6 Nov 2026, on #383), saved with the rest.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { blankTradeDeadlineWords, tradeDeadlineHint, tradeDeadlineLabel, tradeDeadlineWords, tradeReviewWords } from "../../../src/leagueSettings/words";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { descriptionOf } from "../../support/src/describedBy";
import { REVISION } from "../../support/src/leagueSettings.harness";
import { box, fill, FIRST_SETTINGS, openedOn, save, savedSettings } from "../../support/src/leagueSettingsScreen.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";

const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const deadlineTick = () => screen.getByRole("checkbox", { name: tradeDeadlineWords }) as HTMLInputElement;
const withTrades = (trades: Partial<typeof FIRST_SETTINGS.trades>) => ({
  view: { part: { ...FIRST_SETTINGS, trades: { ...FIRST_SETTINGS.trades, ...trades } }, revision: REVISION, changesFrom: CHANGES_FROM },
});

describe("the trade settings (#383)", () => {
  it("opens on a new league's: a commissioner veto and no trade deadline, with no box for one", async () => {
    await openedOn("trades");

    expect(radio(tradeReviewWords.veto).checked).toBe(true);
    expect(deadlineTick().checked).toBe(false);
    expect(screen.queryByRole("textbox", { name: tradeDeadlineLabel })).toBeNull();
  });

  it.each([["none"], ["vote"]] as const)("saves a review by %s with the rest of the settings", async (review) => {
    const app = await openedOn("trades");
    await userEvent.click(radio(tradeReviewWords[review]));
    await save();

    expect(savedSettings(app).trades).toEqual({ review, deadline: null });
  });

  it("saves a trade deadline turned on and set, its box described by its hint", async () => {
    const app = await openedOn("trades");
    await userEvent.click(deadlineTick());
    expect(descriptionOf(box(tradeDeadlineLabel))).toBe(tradeDeadlineHint(PL_GAMEWEEKS));
    await fill(tradeDeadlineLabel, "30");
    await save();

    expect(savedSettings(app).trades).toEqual({ review: "veto", deadline: 30 });
  });

  it("opens on a league's trade deadline, and saves it turned off as none", async () => {
    const app = await openedOn("trades",withTrades({ deadline: 30 }));
    expect(box(tradeDeadlineLabel).value).toBe("30");

    await userEvent.click(deadlineTick());
    await save();

    expect(savedSettings(app).trades.deadline).toBeNull();
  });

  it("with the trade deadline turned on but left without a number, refuses the save itself and asks the server nothing", async () => {
    const app = await openedOn("trades");
    await userEvent.click(deadlineTick());
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(blankTradeDeadlineWords);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("shows the server's refusal of a gameweek past the season's", async () => {
    const app = await openedOn("trades");
    const refusal = "The trade deadline's gameweek must be a whole number from 1 to 38, not 39.";
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await userEvent.click(deadlineTick());
    await fill(tradeDeadlineLabel, "39");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });
});
