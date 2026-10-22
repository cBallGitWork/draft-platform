// The rules editor opened and worked as a commissioner would, by role and name, for its screen
// tests (scoring.harness.ts is its fake seam).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Rule, Scoring } from "../../../src/scoring/editing";
import { scoringPath } from "../../../src/scoring/paths";
import { boxLabel, categoriesLabel, saveWords } from "../../../src/scoring/words";
import type { ScoringData } from "./scoring.harness";
import { commissioner, league, openApp } from "./shell.harness";

export const SCORING_PAGE = scoringPath(league.leagueId);

/** The editor opened by the league's commissioner, on the fake server's `data`. */
export const openScoring = (data: ScoringData = {}) => openApp(SCORING_PAGE, commissioner, { scoring: data });
type App = ReturnType<typeof openScoring>;

/** The list of categories, once it has loaded. */
export const categories = () => screen.findByRole("list", { name: categoriesLabel });
/** Opens a category from the list by its full name. */
export const choose = async (name: string) => userEvent.click(within(await categories()).getByRole("button", { name: new RegExp(`^${name}`) }));
/** A box of the chosen category's values table, by its column and row. */
export const box = (column: string, row: string) => screen.getByRole("textbox", { name: boxLabel(column, row) }) as HTMLInputElement;
/** Empties a box and types `text` into it. */
export async function retype(column: string, row: string, text: string) {
  await userEvent.clear(box(column, row));
  if (text !== "") await userEvent.type(box(column, row), text);
}
export const save = () => userEvent.click(screen.getByRole("button", { name: saveWords }));
/** The scoring set the seam was asked to save. */
export const savedSet = (app: App): Scoring => app.scoring.save.mock.calls[0][1];
export const savedRule = (app: App, stat: string): Rule | undefined => savedSet(app).rules.find((rule) => rule.stat === stat);
