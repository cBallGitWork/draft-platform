// League settings opened and worked as whoever runs the league would, by role and name, for its
// screen tests (leagueSettings.harness.ts is its fake seam).

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf, type LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { settingsPath } from "../../../src/leagueSettings/paths";
import { SETTINGS_TITLE } from "../../../src/leagueSettings/words";
import { saveWords } from "../../../src/rules/words";
import type { LeagueSettingsData } from "./leagueSettings.harness";
import { commissioner, league, openApp } from "./shell.harness";

export const SETTINGS_PAGE = settingsPath(league.leagueId);
/** The settings the fake server holds unless a test says otherwise: the first rules'. */
export const FIRST_SETTINGS = leagueSettingsOf(FIRST_RULES);

/** The screen opened by the commissioner on the fake server's `data`. */
export const openSettings = (data: LeagueSettingsData = {}) => openApp(SETTINGS_PAGE, commissioner, { leagueSettings: data });
type App = ReturnType<typeof openSettings>;
/** The screen opened as openSettings opens it, once its heading shows. */
export async function openedSettings(data?: LeagueSettingsData) {
  const app = openSettings(data);
  await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
  return app;
}

/** A box by its label. */
export const box = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
/** Empties a box and types `text` into it. */
export async function fill(name: string, text: string) {
  await userEvent.clear(box(name));
  if (text !== "") await userEvent.type(box(name), text);
}
export const saveButton = () => screen.getByRole("button", { name: saveWords }) as HTMLButtonElement;
export const save = () => userEvent.click(saveButton());
/** The settings the first save sent the fake server. */
export const savedSettings = (app: App): LeagueSettings => app.leagueSettings.save.mock.calls[0][1];
