// Comparing two players on Scouting (#373, spec/19 The players list): any two ticked, side by side.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogue";
import {
  clearComparisonWords,
  clubLabel,
  columns,
  COMPARE_TITLE,
  compareLabel,
  comparingWords,
  freeAgentWords,
  matchesWords,
  noFigureWords,
  noStatsYetWords,
  pickOneMoreWords,
} from "../../../src/scouting/words";
import type { ScoutingData } from "../../support/src/scouting.harness";
import { HELD, openScouting, PALMER, RICE, SAKA } from "../../support/src/scoutingScreen.harness";
import { league } from "../../support/src/shell.harness";

const nameOf = (stat: string) => STAT_CATALOGUE.find((each) => each.stat === stat)!.name;

describe("comparing two players", () => {
  const SEASONS: ScoutingData["seasons"] = {
    [SAKA.code]: { matches: 9, stats: { goals_scored: 4, expected_goals: 3.456, minutes: 720 } },
    [PALMER.code]: { matches: 8, stats: { goals_scored: 6, minutes: 765 } },
  };
  const openToCompare = (data: Partial<ScoutingData> = {}) => openScouting({ ...HELD, seasons: SEASONS, ...data });
  const tick = async (name: string) => userEvent.click(await screen.findByRole("checkbox", { name: compareLabel(name) }));
  const panel = () => screen.getByRole("region", { name: COMPARE_TITLE });
  const comparisonTable = () => within(panel()).getByRole("table");
  const rowIn = (label: string) =>
    within(comparisonTable())
      .getByRole("rowheader", { name: label })
      .closest("tr")!;
  const cellsOf = (label: string) =>
    within(rowIn(label))
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

  it("nothing is compared, or asked for, until a player is ticked", async () => {
    const app = openToCompare();
    await screen.findByRole("table");
    expect(screen.queryByRole("region", { name: COMPARE_TITLE })).toBeNull();
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("one ticked asks for one more", async () => {
    const app = openToCompare();
    await tick("Saka");
    expect(within(panel()).getByText(pickOneMoreWords("Saka"))).toBeTruthy();
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("two ticked are asked for and shown side by side: who each is, his matches, and every stat either has", async () => {
    const app = openToCompare();
    await tick("Saka");
    await tick("Palmer");

    expect(app.scouting.useComparison.mock.lastCall!).toEqual([league.leagueId, [SAKA.code, PALMER.code]]);
    expect(within(comparisonTable()).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Saka", "Palmer"]);
    expect(cellsOf(columns.club.long)).toEqual(["ARS", "CHE"]);
    expect(cellsOf(columns.owner.short)).toEqual(["Saka Potatoes", "Kroos Control"]);
    expect(cellsOf(columns.seasonPoints.short)).toEqual([noFigureWords, noFigureWords]);
    expect(cellsOf(matchesWords)).toEqual(["9", "8"]);
    expect(cellsOf(nameOf("goals_scored"))).toEqual(["4", "6"]);
    expect(cellsOf(nameOf("expected_goals"))).toEqual(["3.46", "0"]);
    expect(cellsOf(nameOf("minutes"))).toEqual(["720", "765"]);
    // A stat neither has is left out.
    expect(within(comparisonTable()).queryByRole("rowheader", { name: nameOf("saves") })).toBeNull();
  });

  it("a free agent is said to be one", async () => {
    openToCompare();
    await tick("Saka");
    await tick("Rice");
    expect(cellsOf(columns.owner.short)).toEqual(["Saka Potatoes", freeAgentWords]);
    expect(within(panel()).getByText(nameOf("goals_scored"))).toBeTruthy();
  });

  it("says when neither has a stat this season", async () => {
    openToCompare({ seasons: {} });
    await tick("Rice");
    await tick("Palmer");
    expect(within(panel()).getByText(noStatsYetWords)).toBeTruthy();
  });

  it("says so while the comparison loads", async () => {
    openToCompare({ comparing: true });
    await tick("Saka");
    await tick("Palmer");
    expect(within(panel()).getByRole("status").textContent).toBe(comparingWords);
  });

  it("a third ticked takes the first one's place", async () => {
    const app = openToCompare();
    await tick("Saka");
    await tick("Palmer");
    await tick("Rice");
    expect(app.scouting.useComparison.mock.lastCall![1]).toEqual([PALMER.code, RICE.code]);
    expect((screen.getByRole("checkbox", { name: compareLabel("Saka") }) as HTMLInputElement).checked).toBe(false);
  });

  it("unticking one goes back to asking for another, and Clear drops the comparison", async () => {
    openToCompare();
    await tick("Saka");
    await tick("Palmer");
    await tick("Saka");
    expect(within(panel()).getByText(pickOneMoreWords("Palmer"))).toBeTruthy();

    await userEvent.click(within(panel()).getByRole("button", { name: clearComparisonWords }));
    expect(screen.queryByRole("region", { name: COMPARE_TITLE })).toBeNull();
    expect((screen.getByRole("checkbox", { name: compareLabel("Palmer") }) as HTMLInputElement).checked).toBe(false);
  });

  it("the ticks stay while a filter hides one of them", async () => {
    const app = openToCompare();
    await tick("Saka");
    await tick("Palmer");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: clubLabel }), "Arsenal");
    expect(app.scouting.useComparison.mock.lastCall![1]).toEqual([SAKA.code, PALMER.code]);
    expect(within(panel()).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Saka", "Palmer"]);
  });
});
