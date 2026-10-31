// The Premier League table on the section (#50; spec/18, The table): P W D L GF GA GD Pts, worked
// out from the results on the server; live during matches, marked provisional until they are final.

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import type { PlStandings } from "../../../src/premierLeague/seam";
import { loadingTableWords, noClubsWords, provisionalWords, TABLE_TITLE, tableColumns } from "../../../src/premierLeague/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { ARSENAL, CHELSEA, FOREST, SPURS, standingsRow, type PremierLeagueData } from "../../support/src/premierLeague.harness";
import { manager, openApp } from "../../support/src/shell.harness";

const openSection = (premierLeague: PremierLeagueData = {}) => openApp(PREMIER_LEAGUE_PATH, manager, { premierLeague });
const panel = () => screen.findByRole("region", { name: TABLE_TITLE });

const standings: PlStandings = {
  rows: [
    standingsRow(1, ARSENAL, { played: 2, won: 2, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 6 }),
    standingsRow(2, CHELSEA, { played: 2, won: 1, drawn: 1, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 4 }),
    standingsRow(3, SPURS, { played: 2, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, goalDifference: -1, points: 1 }),
    standingsRow(3, FOREST, { played: 2, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, goalDifference: -1, points: 1 }),
  ],
  provisional: false,
};

/** Each body row's cells, the club by its full name (the desk's). */
async function tableLines() {
  const rows = within(await panel()).getAllByRole("row").slice(1);
  return rows.map((row) => [...row.children].map((cell, index) => (index === 1 ? cell.firstElementChild!.textContent : cell.textContent)));
}

describe("the Premier League table", () => {
  it("says so while it loads", async () => {
    openSection({ loading: true });
    expect(within(await panel()).getByRole("status").textContent).toBe(loadingTableWords);
  });

  it("says why it has no table before any club is held", async () => {
    openSection({ standings: { rows: [], provisional: false } });
    expect(within(await panel()).getByText(noClubsWords)).toBeTruthy();
    expect(within(await panel()).queryByRole("table")).toBeNull();
  });

  it("heads its columns P W D L GF GA GD Pts, each named in full for a screen reader", async () => {
    openSection({ standings });
    expectColumnHeads(await panel(), Object.values(tableColumns));
    expect(Object.values(tableColumns).map(({ short }) => short)).toEqual(["Pos", "Club", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"]);
  });

  it("lists every club in the server's order, clubs it can't part sharing a position, the difference signed", async () => {
    openSection({ standings });
    expect(await tableLines()).toEqual([
      ["1", "Arsenal", "2", "2", "0", "0", "5", "1", "+4", "6"],
      ["2", "Chelsea", "2", "1", "1", "0", "3", "2", "+1", "4"],
      ["3", "Spurs", "2", "0", "1", "1", "2", "3", "-1", "1"],
      ["3", "Nottingham Forest", "2", "0", "1", "1", "2", "3", "-1", "1"],
    ]);
  });

  it("leaves goals for and against off a phone, and names a club by its three letters there", async () => {
    openSection({ standings });
    const [heads] = within(await panel()).getAllByRole("row");
    const deskOnly = [...heads.children].filter((cell) => cell.className.includes("hidden sm:table-cell")).map((cell) => cell.textContent);
    expect(deskOnly).toEqual(["GF", "GA"]);
    const club = within(await panel()).getAllByRole("rowheader")[0];
    expect(club.lastElementChild!.textContent).toBe("ARS");
    expect(club.lastElementChild!.className).toContain("sm:hidden");
  });

  it("is marked provisional while a match in it is being played, and not once they are final", async () => {
    const app = openSection({ standings: { ...standings, provisional: true } });
    expect(within(await panel()).getByText(provisionalWords)).toBeTruthy();

    app.premierLeague.sendStandings(standings);
    expect(within(await panel()).queryByText(provisionalWords)).toBeNull();
  });
});
