// The Auto team reading on My team's header band (spec/09, The auto team; the approved auto-team
// picture): Off or On and until when, and its panel, switching it on until the end of a gameweek
// from the next not begun, or until switched off, and switching it off.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  autoTeamHead,
  autoTeamStateWords,
  autoTeamWhatWords,
  cancelWords,
  endGameweekLabel,
  gameweekShort,
  meterListLabel,
  switchOffWords,
  switchOnWords,
  untilSwitchedOffWords,
} from "../../../../src/myTeam/header/words";
import { SEASON_GAMEWEEKS } from "../../../../convex/gameweeks/usedGameweeks";
import { MY_TEAM_ID } from "../../../support/src/myTeam.harness";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK } from "../../../support/src/tactics.harness";
import { SAVED, openTacticsTab } from "../../../support/src/tacticsScreen.harness";

const openPanel = async (state: string) => {
  const band = within(await screen.findByRole("group", { name: meterListLabel }));
  await userEvent.click(band.getByRole("button", { name: new RegExp(`^${state}`) }));
  return within(screen.getByRole("region", { name: autoTeamHead }));
};

describe("My team's Auto team", () => {
  it("reads Off, and switches on until the end of the gameweek picked, from the next not begun", async () => {
    // The league skips the gameweek after next and ends at 30 (#1561).
    const endGameweeks = [TACTICS_GAMEWEEK, ...SEASON_GAMEWEEKS.filter((gameweek) => gameweek > TACTICS_GAMEWEEK + 1 && gameweek <= 30)];
    const app = openTacticsTab({ tactics: SAVED, autoTeam: { on: false, endsAfter: null, endGameweeks } });
    const panel = await openPanel(autoTeamStateWords({ on: false, endsAfter: null }));
    expect(panel.getByText(autoTeamWhatWords)).toBeTruthy();

    const gameweeks = panel.getByRole("combobox", { name: endGameweekLabel });
    const options = within(gameweeks).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(endGameweeks.map(gameweekShort));
    expect(options).not.toContain(gameweekShort(TACTICS_GAMEWEEK + 1));
    expect(options.at(-1)).toBe(gameweekShort(30));
    await userEvent.selectOptions(gameweeks, String(TACTICS_GAMEWEEK + 4));
    await userEvent.click(panel.getByRole("button", { name: switchOnWords }));

    expect(app.myTeam.autoTeamChanges.set).toHaveBeenCalledWith(league.leagueId, MY_TEAM_ID, true, TACTICS_GAMEWEEK + 4);
    expect(screen.queryByRole("region", { name: autoTeamHead })).toBeNull();
  });

  it("switches on until switched off, naming no gameweek", async () => {
    const app = openTacticsTab({ tactics: SAVED });
    const panel = await openPanel(autoTeamStateWords({ on: false, endsAfter: null }));
    await userEvent.click(panel.getByRole("radio", { name: untilSwitchedOffWords }));
    await userEvent.click(panel.getByRole("button", { name: switchOnWords }));
    expect(app.myTeam.autoTeamChanges.set).toHaveBeenCalledWith(league.leagueId, MY_TEAM_ID, true, undefined);
  });

  it("reads On and until when, and switches off", async () => {
    const autoTeam = { on: true, endsAfter: TACTICS_GAMEWEEK + 2 };
    const app = openTacticsTab({ tactics: SAVED, autoTeam });
    expect(autoTeamStateWords(autoTeam)).toBe(`On, to ${gameweekShort(TACTICS_GAMEWEEK + 2)}`);
    const panel = await openPanel(autoTeamStateWords(autoTeam));
    expect(panel.queryByRole("radio")).toBeNull();
    await userEvent.click(panel.getByRole("button", { name: switchOffWords }));
    expect(app.myTeam.autoTeamChanges.set).toHaveBeenCalledWith(league.leagueId, MY_TEAM_ID, false, undefined);
  });

  it("keeps the panel open with the server's words when it refuses, and Cancel changes nothing", async () => {
    const refusal = "There is no gameweek left to come for the auto team to end after.";
    const app = openTacticsTab({ tactics: SAVED, autoTeamAnswer: refusal });
    const panel = await openPanel(autoTeamStateWords({ on: false, endsAfter: null }));
    await userEvent.click(panel.getByRole("button", { name: switchOnWords }));
    expect(await panel.findByRole("alert")).toHaveProperty("textContent", refusal);

    await userEvent.click(panel.getByRole("button", { name: cancelWords }));
    expect(screen.queryByRole("region", { name: autoTeamHead })).toBeNull();
    expect(app.myTeam.autoTeamChanges.set).toHaveBeenCalledTimes(1);
  });
});
