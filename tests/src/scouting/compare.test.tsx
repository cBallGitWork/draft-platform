// Comparing two players on Scouting (#373, spec/19 The players list; the approved picture, #1028):
// a selected player's Compare with another…, then a second row, or Compare with your [position],
// puts the two side by side: points, minutes, and the first's area's stats with each one's total,
// per 90 and bar, then the first's pickup or claim (Craig, 9 Nov 2026, on #1028, answers 1 and 4).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { per90Stats } from "../../../convex/scouting/per90Figures";
import { statFigure } from "../../../src/shared/figures";
import {
  clearComparisonWords,
  clubLabel,
  columns,
  COMPARE_TITLE,
  COMPARE_YOURS_TITLE,
  compareNoteWords,
  compareTakeWords,
  compareWithAnotherWords,
  compareWithYourWords,
  comparingWords,
  freeAgentWords,
  noFigureWords,
  panelMinutesWords,
  PER90_STAT_NAMES,
  percentileLabel,
  pickSecondWords,
  seasonPointsColumn,
  yoursWords,
} from "../../../src/scouting/words";
import type { ScoutingData } from "../../support/src/scouting.harness";
import { HELD, openOnAll, PALMER, RICE, rowOf, SAKA } from "../../support/src/scoutingScreen.harness";
import { league } from "../../support/src/shell.harness";

describe("comparing two players", () => {
  /** Saka 4 goals in 720 minutes, Palmer 6 in 765: both attacking midfielders, ranked. */
  const TOTALS: ScoutingData["totals"] = {
    [SAKA.code]: { goals_scored: 4, assists: 2, minutes: 720 },
    [PALMER.code]: { goals_scored: 6, minutes: 765 },
  };
  const openToCompare = (data: Partial<ScoutingData> = {}) => openOnAll({ ...HELD, totals: TOTALS, ...data });
  /** Selects `first`, presses Compare with another… on his panel, then picks `second`'s row. */
  const compare = async (first: string, second: string) => {
    await userEvent.click(rowOf(first));
    await userEvent.click(screen.getByRole("button", { name: compareWithAnotherWords }));
    await userEvent.click(rowOf(second));
  };
  const panel = (title = COMPARE_TITLE) => screen.getByRole("region", { name: title });
  const comparisonTable = () => within(panel()).getByRole("table");
  /** The heads naming each player, and who holds him. */
  const playerHeads = () =>
    within(comparisonTable())
      .getAllByRole("columnheader")
      .filter((head) => head.getAttribute("scope") === "colgroup")
      .map((head) => head.textContent);
  const cellsOf = (label: string) =>
    within(within(comparisonTable()).getByRole("rowheader", { name: label }).closest("tr")!)
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
    expect(cellsOf(panelMinutesWords("season", 2025))).toEqual(["720", "765"]);
  });

  it("the two are asked for and shown side by side: points, minutes, and the first's area's stats, each one's total, per 90 and bar", async () => {
    const app = await openToCompare();
    await compare("Saka", "Palmer");

    expect(app.scouting.useComparison.mock.lastCall!).toEqual([league.leagueId, [SAKA.code, PALMER.code], null, "season"]);
    expect(playerHeads()).toEqual(["Saka (Saka Potatoes)", "Palmer (Kroos Control)"]);
    expect(cellsOf(columns.roleFit.long)).toEqual([noFigureWords, noFigureWords]);
    expect(cellsOf(columns.seasonPoints.short)).toEqual([noFigureWords, noFigureWords]);
    expect(cellsOf(panelMinutesWords("season", null))).toEqual(["720", "765"]);
    const rows = within(comparisonTable()).getAllByRole("rowheader").slice(3).map((head) => head.textContent);
    expect(rows).toEqual(per90Stats("attackingMidfield", null).map((stat) => PER90_STAT_NAMES[stat]));
    // Saka's 4 in 720 is 0.5 a match, below Palmer's 6 in 765, so half the ranked are at or below him.
    expect(cellsOf(PER90_STAT_NAMES.goals_scored)).toEqual(["4", statFigure(0.5), "", "6", statFigure((6 / 765) * 90), ""]);
    const goalsRow = within(comparisonTable()).getByRole("rowheader", { name: PER90_STAT_NAMES.goals_scored }).closest("tr")!;
    expect(within(goalsRow).getAllByRole("img").map((bar) => bar.getAttribute("aria-label"))).toEqual(
      [50, 100].map((percentile) => percentileLabel(percentile, "attackingMidfield")),
    );
    expect(within(panel()).getByText(compareNoteWords("attackingMidfield", "season"))).toBeTruthy();
  });

  it("a free agent is said to be one, and the manager's own player his", async () => {
    await openToCompare({ players: [{ ...SAKA, ownerTeamName: league.teamName }, RICE, PALMER] });
    await compare("Saka", "Rice");
    expect(playerHeads()).toEqual([`Saka (${yoursWords})`, `Rice (${freeAgentWords})`]);
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
    expect(playerHeads()).toEqual(["Saka (Saka Potatoes)", "Palmer (Kroos Control)"]);
  });
});

describe("compare with your player (Craig, 9 Nov 2026, on #1028, answers 1 and 4)", () => {
  /** The manager holds Saka; Rice, a free agent, is compared with him. */
  const YOURS: ScoutingData["yours"] = { player: { position: "CM", code: SAKA.code, name: "Saka" }, squadFull: false };
  const SQUAD = [{ playerCode: SAKA.code, playerName: "Saka" }];
  const open = (data: Partial<ScoutingData> = {}) =>
    openOnAll({ ...HELD, yours: YOURS, actions: new Map([[RICE.code, { kind: "pickUp", squad: SQUAD }]]), ...data });
  const compareWithYours = async () => {
    await userEvent.click(rowOf("Rice"));
    await userEvent.click(screen.getByRole("button", { name: compareWithYourWords("CM", "Saka") }));
  };

  it("his panel names your player at his position, and pressing it compares the two", async () => {
    const app = await open();
    await compareWithYours();
    expect(app.scouting.useComparison.mock.lastCall![1]).toEqual([RICE.code, SAKA.code]);
    expect(screen.getByRole("region", { name: COMPARE_YOURS_TITLE })).toBeTruthy();
  });

  it("with no player of yours at his position, only Compare with another… shows", async () => {
    await open({ yours: { player: null, squadFull: false } });
    await userEvent.click(rowOf("Rice"));
    expect(screen.queryByRole("button", { name: /Compare with your/ })).toBeNull();
    expect(screen.getByRole("button", { name: compareWithAnotherWords })).toBeTruthy();
  });

  it("with room in the squad, Pick up drops nobody", async () => {
    const app = await open();
    await compareWithYours();
    await userEvent.click(within(screen.getByRole("region", { name: COMPARE_YOURS_TITLE })).getByRole("button", { name: compareTakeWords("pickUp", "Rice", null) }));
    expect(app.scouting.waiverChanges.pickUp).toHaveBeenCalledWith(league.leagueId, RICE.code, null);
  });

  it("with the squad full, it drops your player", async () => {
    const app = await open({ yours: { ...YOURS, squadFull: true } });
    await compareWithYours();
    await userEvent.click(screen.getByRole("button", { name: compareTakeWords("pickUp", "Rice", "Saka") }));
    expect(app.scouting.waiverChanges.pickUp).toHaveBeenCalledWith(league.leagueId, RICE.code, SAKA.code);
  });

  it("a player on waivers is claimed the same way", async () => {
    const app = await open({ yours: { ...YOURS, squadFull: true }, actions: new Map([[RICE.code, { kind: "claim", firstRunAt: null, squad: SQUAD }]]) });
    await compareWithYours();
    await userEvent.click(screen.getByRole("button", { name: compareTakeWords("claim", "Rice", "Saka") }));
    expect(app.scouting.waiverChanges.claim).toHaveBeenCalledWith(league.leagueId, RICE.code, SAKA.code);
  });
});
