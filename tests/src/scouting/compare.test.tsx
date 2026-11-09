// Comparing two players on Scouting (#373, spec/19 The players list; the approved picture, #1028):
// a selected player's Compare with another…, then a second row, puts the two side by side.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogueList";
import { crestUrl } from "../../../src/ui/ClubName";
import {
  clearComparisonWords,
  clubLabel,
  columns,
  COMPARE_TITLE,
  compareWhatColumn,
  compareWithAnotherWords,
  comparingWords,
  freeAgentWords,
  matchesWords,
  noFigureWords,
  noStatsYetWords,
  pickSecondWords,
  seasonPointsColumn,
} from "../../../src/scouting/words";
import { expectColumnHeads, expectUnseenHead } from "../../support/src/columnHeads";
import type { ScoutingData } from "../../support/src/scouting.harness";
import { HELD, openOnAll, PALMER, rowOf, SAKA } from "../../support/src/scoutingScreen.harness";
import { league } from "../../support/src/shell.harness";

const nameOf = (stat: string) => STAT_CATALOGUE.find((each) => each.stat === stat)!.name;

describe("comparing two players", () => {
  const SEASONS: ScoutingData["seasons"] = {
    [SAKA.code]: { matches: 9, stats: { goals_scored: 4, expected_goals: 3.456, minutes: 720 } },
    [PALMER.code]: { matches: 8, stats: { goals_scored: 6, minutes: 765 } },
  };
  const openToCompare = (data: Partial<ScoutingData> = {}) => openOnAll({ ...HELD, seasons: SEASONS, ...data });
  /** Selects `first`, presses Compare with another… on his panel, then picks `second`'s row. */
  const compare = async (first: string, second: string) => {
    await userEvent.click(rowOf(first));
    await userEvent.click(screen.getByRole("button", { name: compareWithAnotherWords }));
    await userEvent.click(rowOf(second));
  };
  const panel = () => screen.getByRole("region", { name: COMPARE_TITLE });
  const comparisonTable = () => within(panel()).getByRole("table");
  /** The comparison's heads with Saka and then Palmer picked, each named in full. */
  const SAKA_AND_PALMER_HEADS = [compareWhatColumn, { short: "Saka", long: SAKA.fullName }, { short: "Palmer", long: PALMER.fullName }];
  const rowIn = (label: string) =>
    within(comparisonTable())
      .getByRole("rowheader", { name: label })
      .closest("tr")!;
  const cellsOf = (label: string) =>
    within(rowIn(label))
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

  it("nothing is compared, or asked for, until a second player is picked", async () => {
    const app = await openToCompare();
    await userEvent.click(rowOf("Saka"));
    expect(screen.queryByRole("region", { name: COMPARE_TITLE })).toBeNull();
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("Compare with another… asks for a second row, and pressed again stops asking", async () => {
    const app = await openToCompare();
    await userEvent.click(rowOf("Saka"));
    const button = screen.getByRole("button", { name: compareWithAnotherWords });
    await userEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(pickSecondWords("Saka"))).toBeTruthy();

    await userEvent.click(button);
    expect(screen.queryByText(pickSecondWords("Saka"))).toBeNull();
    await userEvent.click(rowOf("Palmer"));
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("before the new season's first match, names the points row by last season, as the list does (#956)", async () => {
    await openToCompare({ pointsSeason: 2025 });
    await compare("Saka", "Palmer");
    expect(cellsOf(seasonPointsColumn(2025).short)).toEqual([noFigureWords, noFigureWords]);
    expect(seasonPointsColumn(2025).short).toBe("Pts 25/26");
  });

  it("the two are asked for and shown side by side: who each is, his matches, and every stat either has", async () => {
    const app = await openToCompare();
    await compare("Saka", "Palmer");

    expect(app.scouting.useComparison.mock.lastCall!).toEqual([league.leagueId, [SAKA.code, PALMER.code]]);
    expectColumnHeads(comparisonTable(), SAKA_AND_PALMER_HEADS);
    expectUnseenHead(comparisonTable(), compareWhatColumn);
    expect(cellsOf(columns.club.long)).toEqual(["ARS", "CHE"]);
    expect([...comparisonTable().querySelectorAll("[data-club-mark]")].map((mark) => mark.getAttribute("src"))).toEqual(
      [SAKA, PALMER].map((player) => crestUrl(player.club.code)),
    );
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
    await openToCompare();
    await compare("Saka", "Rice");
    expect(cellsOf(columns.owner.short)).toEqual(["Saka Potatoes", freeAgentWords]);
    expect(within(panel()).getByText(nameOf("goals_scored"))).toBeTruthy();
  });

  it("says when neither has a stat this season", async () => {
    await openToCompare({ seasons: {} });
    await compare("Rice", "Palmer");
    expect(within(panel()).getByText(noStatsYetWords)).toBeTruthy();
  });

  it("says so while the comparison loads", async () => {
    await openToCompare({ comparing: true });
    await compare("Saka", "Palmer");
    expect(within(panel()).getByRole("status").textContent).toBe(comparingWords);
  });

  it("Clear drops the comparison", async () => {
    const app = await openToCompare();
    await compare("Saka", "Palmer");
    await userEvent.click(within(panel()).getByRole("button", { name: clearComparisonWords }));
    expect(screen.queryByRole("region", { name: COMPARE_TITLE })).toBeNull();
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("the comparison stays while a filter hides one of them", async () => {
    const app = await openToCompare();
    await compare("Saka", "Palmer");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: clubLabel }), "Arsenal");
    expect(app.scouting.useComparison.mock.lastCall![1]).toEqual([SAKA.code, PALMER.code]);
    expectColumnHeads(comparisonTable(), SAKA_AND_PALMER_HEADS);
  });
});
