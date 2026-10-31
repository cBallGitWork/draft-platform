// Scouting's sort (#373, spec/19 The players list): a column's head asks the server to sort by it,
// and any catalogue stat is shown as a season total and sorted by.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogue";
import { sortByLabel } from "../../../src/shared/words";
import { columns, noStatWords, statLabel } from "../../../src/scouting/words";
import { HELD, lastAsk, namesShown, openScouting, PALMER, RICE, table } from "../../support/src/scoutingScreen.harness";

describe("the sort asks the server", () => {
  it("a column's head sorts by it, and again the other way", async () => {
    const app = openScouting();
    const byClub = await screen.findByRole("button", { name: sortByLabel(columns.club.long) });
    await userEvent.click(byClub);
    expect(lastAsk(app)[2]).toEqual({ by: "club", descending: false });
    expect(byClub.closest("th")!.getAttribute("aria-sort")).toBe("ascending");

    await userEvent.click(byClub);
    expect(lastAsk(app)[2]).toEqual({ by: "club", descending: true });
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(byClub.closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("by club, A to Z first", async () => {
    openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.club.long) }));
    expect(namesShown()).toEqual(["Rice", "Saka", "Palmer"]);
  });

  it("by name, pressed again, Z to A", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.name.long) }));
    expect(lastAsk(app)[2]).toEqual({ by: "name", descending: true });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
  });

  it("by season points, the most first", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.seasonPoints.long) }));
    expect(lastAsk(app)[2]).toEqual({ by: "seasonPoints", descending: true });
  });
});

describe("any stat, as a season total", () => {
  const GOALS = STAT_CATALOGUE.find((each) => each.stat === "goals_scored")!;
  const XG = STAT_CATALOGUE.find((each) => each.stat === "expected_goals")!;
  // Saka has no goals held: he hasn't scored, so his total is 0.
  const TOTALS = { [RICE.code]: { goals_scored: 2, expected_goals: 1.234 }, [PALMER.code]: { goals_scored: 5, expected_goals: 4.5 } };
  const openWithTotals = () => openScouting({ ...HELD, totals: TOTALS });
  const chooseStat = async (name: string) => userEvent.selectOptions(await screen.findByRole("combobox", { name: statLabel }), name);
  const statCells = () => within(table()).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").at(-1)!.textContent);

  it("offers every stat of the catalogue, and none by default", async () => {
    const app = openWithTotals();
    const picker = await screen.findByRole("combobox", { name: statLabel });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([noStatWords, ...STAT_CATALOGUE.map((each) => each.name)]);
    expect((picker as HTMLSelectElement).value).toBe("");
    expect(lastAsk(app)[3]).toBeNull();
  });

  it("a stat chosen is asked for and sorted by, the most first, in a column headed by its short code", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    expect(lastAsk(app).slice(2)).toEqual([{ by: "stat", descending: true }, GOALS.stat]);
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(statCells()).toEqual(["5", "2", "0"]);
    const head = screen.getByRole("button", { name: sortByLabel(GOALS.name) });
    expect(head.textContent).toContain(GOALS.shortCode);
    expect(head.closest("th")).toBe(screen.getByRole("columnheader", { name: GOALS.name }));
    expect(head.closest("th")!.getAttribute("title")).toBe(GOALS.name);
    expect(head.closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("its head pressed again sorts the fewest first", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    await userEvent.click(screen.getByRole("button", { name: sortByLabel(GOALS.name) }));
    expect(lastAsk(app)[2]).toEqual({ by: "stat", descending: false });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
  });

  it("shows a total to two decimal places at most", async () => {
    openWithTotals();
    await chooseStat(XG.name);
    expect(statCells()).toEqual(["4.5", "1.23", "0"]);
  });

  it("stays shown while another column sorts the list", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    await userEvent.click(screen.getByRole("button", { name: sortByLabel(columns.name.long) }));
    expect(lastAsk(app).slice(2)).toEqual([{ by: "name", descending: false }, GOALS.stat]);
    expect(statCells()).toEqual(["5", "2", "0"]);
  });

  it("none chosen again drops the column, and a sort by it goes back to names", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    await chooseStat(noStatWords);
    expect(lastAsk(app).slice(2)).toEqual([{ by: "name", descending: false }, null]);
    expect(screen.queryByRole("button", { name: sortByLabel(GOALS.name) })).toBeNull();
  });
});
