// League settings shares the rules screens' controls in the Wells look (plate.md, Controls;
// src/ui/, src/rules/): the double gameweek rule is a row of keys the arrow keys move, and Save says
// when there is nothing to save.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { DOUBLE_GAMEWEEK_RULES } from "../../../convex/scoring/values";
import { doubleGameweekLabel, doubleGameweekWords } from "../../../src/leagueSettings/words";
import { discardWords } from "../../../src/rules/words";
import { openSettings, saveButton } from "../../support/src/leagueSettingsScreen.harness";

const key = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;

it("opens with Save in the plain border, disabled, and no Discard", async () => {
  openSettings();
  await screen.findByRole("radiogroup", { name: doubleGameweekLabel });

  expect(saveButton().disabled).toBe(true);
  expect(saveButton().className).toBe("action-idle");
  expect(screen.queryByRole("button", { name: discardWords })).toBeNull();
});

it("moves the double gameweek choice with the arrow keys, which makes Save the action beside Discard", async () => {
  openSettings();
  await screen.findByRole("radiogroup", { name: doubleGameweekLabel });
  const start = FIRST_RULES.doubleGameweek;
  const other = DOUBLE_GAMEWEEK_RULES.find((rule) => rule !== start)!;
  key(doubleGameweekWords[start]).focus();
  await userEvent.keyboard("{ArrowRight}");

  expect(key(doubleGameweekWords[other]).checked).toBe(true);
  expect(saveButton().disabled).toBe(false);
  expect(saveButton().className).toBe("action");
  expect(screen.getByRole("button", { name: discardWords })).toBeTruthy();
});
