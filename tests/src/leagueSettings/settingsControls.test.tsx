// League settings shares the rules screens' controls in the Wells look (plate.md, Controls;
// src/rules/): the odd team out is a row of keys the arrow keys move, and Save says when there is
// nothing to save.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { drawRulesOf, FIRST_RULES } from "../../../convex/rules/firstRules";
import { ODD_TEAM_OUTS } from "../../../convex/table/roundRobin";
import { settingsPath } from "../../../src/leagueSettings/paths";
import { oddTeamOutLabel, oddTeamOutWords } from "../../../src/leagueSettings/words";
import { discardWords, saveWords } from "../../../src/rules/words";
import { commissioner, league, openApp } from "../../support/src/shell.harness";

const openSettings = () => openApp(settingsPath(league.leagueId), commissioner, { leagueSettings: {} });
const key = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: saveWords }) as HTMLButtonElement;

it("opens with Save in the plain border, disabled, and no Discard", async () => {
  openSettings();
  await screen.findByRole("radiogroup", { name: oddTeamOutLabel });

  expect(saveButton().disabled).toBe(true);
  expect(saveButton().className).toBe("action-idle");
  expect(screen.queryByRole("button", { name: discardWords })).toBeNull();
});

it("moves the odd team out with the arrow keys, which makes Save the action beside Discard", async () => {
  openSettings();
  await screen.findByRole("radiogroup", { name: oddTeamOutLabel });
  const start = drawRulesOf(FIRST_RULES).oddTeamOut;
  const other = ODD_TEAM_OUTS.find((oddTeamOut) => oddTeamOut !== start)!;
  key(oddTeamOutWords[start]).focus();
  await userEvent.keyboard("{ArrowRight}");

  expect(key(oddTeamOutWords[other]).checked).toBe(true);
  expect(saveButton().disabled).toBe(false);
  expect(saveButton().className).toBe("action");
  expect(screen.getByRole("button", { name: discardWords })).toBeTruthy();
});
