// Scouting's sort (#373, spec/19 The players list): a column's head asks the server to sort by it,
// and any catalogue stat is shown as a season total and sorted by.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogueList";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
import { columns, noFigureWords, noStatWords, statLabel } from "../../../src/scouting/words";
import { catalogueGroupWords, ownStatsGroupWords } from "../../../src/shared/words";
import { columnHeadIn, sortLabelOf } from "../../support/src/columnHeads";
import { HELD, lastAsk, namesShown, openOnAll, PALMER, RICE, rowOf, SAKA, table } from "../../support/src/scoutingScreen.harness";

describe("the sort asks the server", () => {
  // Rice has played the most minutes, Saka the fewest; Palmer has the goals.
  const FIGURED = {
    ...HELD,
    players: [
      { ...SAKA, figures: { ...NO_FIGURES, minutes: 90 } },
      { ...RICE, figures: { ...NO_FIGURES, minutes: 540, goals: 1 } },
      { ...PALMER, figures: { ...NO_FIGURES, minutes: 300, goals: 4 } },
    ],
  };

  it("a column's head sorts by it, and again the other way", async () => {
    const app = await openOnAll(FIGURED);
    const byMinutes = await screen.findByRole("button", { name: sortLabelOf(columns.minutes) });
    await userEvent.click(byMinutes);
    expect(lastAsk(app)[2]).toEqual({ by: "minutes", descending: true });
    expect(namesShown()).toEqual(["Rice", "Palmer", "Saka"]);
    expect(byMinutes.closest("th")!.getAttribute("aria-sort")).toBe("descending");

    await userEvent.click(byMinutes);
    expect(lastAsk(app)[2]).toEqual({ by: "minutes", descending: false });
    expect(namesShown()).toEqual(["Saka", "Palmer", "Rice"]);
    expect(byMinutes.closest("th")!.getAttribute("aria-sort")).toBe("ascending");
  });

  it.each([
    ["goals", columns.goals],
    ["assists", columns.assists],
    ["shotsOnTarget", columns.shotsOnTarget],
  ] as const)("by %s, the most first", async (by, head) => {
    const app = await openOnAll(FIGURED);
    await userEvent.click(await screen.findByRole("button", { name: sortLabelOf(head) }));
    expect(lastAsk(app)[2]).toEqual({ by, descending: true });
  });

  it("each row shows his minutes, points, goals, assists and shots on target", async () => {
    await openOnAll(FIGURED);
    const cells = within(rowOf("Palmer")).getAllByRole("cell").slice(-5);
    expect(cells.map((cell) => cell.textContent)).toEqual(["300", noFigureWords, "4", "0", "0"]);
  });

  it("by name, pressed again, Z to A", async () => {
    const app = await openOnAll();
    await userEvent.click(await screen.findByRole("button", { name: sortLabelOf(columns.name) }));
    expect(lastAsk(app)[2]).toEqual({ by: "name", descending: true });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
  });

  it("by season points, the most first", async () => {
    const app = await openOnAll();
    await userEvent.click(await screen.findByRole("button", { name: sortLabelOf(columns.seasonPoints) }));
    expect(lastAsk(app)[2]).toEqual({ by: "points", descending: true });
  });
});

describe("any stat, as a season total", () => {
  const GOALS = STAT_CATALOGUE.find((each) => each.stat === "goals_scored")!;
  const GOALS_HEAD = { short: GOALS.shortCode, long: GOALS.name };
  const XG = STAT_CATALOGUE.find((each) => each.stat === "expected_goals")!;
  // Saka has no goals held: he hasn't scored, so his total is 0.
  const TOTALS = { [RICE.code]: { goals_scored: 2, expected_goals: 1.234 }, [PALMER.code]: { goals_scored: 5, expected_goals: 4.5 } };
  const openWithTotals = () => openOnAll({ ...HELD, totals: TOTALS });
  const chooseStat = async (name: string) => userEvent.selectOptions(await screen.findByRole("combobox", { name: statLabel }), name);
  const statCells = () => within(table()).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").at(-1)!.textContent);

  it("offers every stat of the catalogue, and none by default", async () => {
    const app = await openWithTotals();
    const picker = await screen.findByRole("combobox", { name: statLabel });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([noStatWords, ...STAT_CATALOGUE.map((each) => each.name)]);
    expect((picker as HTMLSelectElement).value).toBe("");
    expect(lastAsk(app)[3]).toBeNull();
  });

  it("a stat chosen is asked for and sorted by, the most first, in a column headed by its short code", async () => {
    const app = await openWithTotals();
    await chooseStat(GOALS.name);
    expect(lastAsk(app).slice(2, 4)).toEqual([{ by: "stat", descending: true }, GOALS.stat]);
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(statCells()).toEqual(["5", "2", "0"]);
    const head = screen.getByRole("button", { name: sortLabelOf(GOALS_HEAD) });
    expect(head.textContent).toContain(GOALS.shortCode);
    expect(head.closest("th")).toBe(columnHeadIn(table(), GOALS_HEAD));
    expect(head.closest("th")!.getAttribute("title")).toBe(GOALS.name);
    expect(head.closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("its head pressed again sorts the fewest first", async () => {
    const app = await openWithTotals();
    await chooseStat(GOALS.name);
    await userEvent.click(screen.getByRole("button", { name: sortLabelOf(GOALS_HEAD) }));
    expect(lastAsk(app)[2]).toEqual({ by: "stat", descending: false });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
  });

  it("shows a total to two decimal places at most", async () => {
    await openWithTotals();
    await chooseStat(XG.name);
    expect(statCells()).toEqual(["4.5", "1.23", "0"]);
  });

  it("stays shown while another column sorts the list", async () => {
    const app = await openWithTotals();
    await chooseStat(GOALS.name);
    await userEvent.click(screen.getByRole("button", { name: sortLabelOf(columns.name) }));
    expect(lastAsk(app).slice(2, 4)).toEqual([{ by: "name", descending: false }, GOALS.stat]);
    expect(statCells()).toEqual(["5", "2", "0"]);
  });

  it("offers the site set's own stats in a group above the feeds' (#910), and shows one chosen", async () => {
    const OWN = { stat: "league:involvements", name: "Involvements", shortCode: "INV" };
    const app = await openOnAll({ ...HELD, ownStats: [OWN], totals: { [RICE.code]: { [OWN.stat]: 1.5 }, [PALMER.code]: { [OWN.stat]: 3 } } });
    const picker = await screen.findByRole("combobox", { name: statLabel });
    const groups = within(picker).getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("label"))).toEqual([ownStatsGroupWords, catalogueGroupWords]);
    expect(within(groups[0]).getAllByRole("option").map((option) => option.textContent)).toEqual([OWN.name]);
    expect(within(groups[1]).getAllByRole("option").map((option) => option.textContent)).toEqual(STAT_CATALOGUE.map((each) => each.name));

    await chooseStat(OWN.name);
    expect(lastAsk(app).slice(2, 4)).toEqual([{ by: "stat", descending: true }, OWN.stat]);
    expect(statCells()).toEqual(["3", "1.5", "0"]);
    expect(screen.getByRole("button", { name: sortLabelOf({ short: OWN.shortCode, long: OWN.name }) })).toBeTruthy();
  });

  it("none chosen again drops the column, and a sort by it goes back to names", async () => {
    const app = await openWithTotals();
    await chooseStat(GOALS.name);
    await chooseStat(noStatWords);
    expect(lastAsk(app).slice(2, 4)).toEqual([{ by: "name", descending: false }, null]);
    expect(screen.queryByRole("button", { name: sortLabelOf(GOALS_HEAD) })).toBeNull();
  });
});
