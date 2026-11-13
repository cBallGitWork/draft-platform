// The Premier League table on the section (#50; spec/18, The table): P W D L GF GA GD Pts, worked
// out from the results on the server; live during matches, marked provisional until they are final.

import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { crestUrl } from "../../../src/ui/ClubName";
import type { PlStandings } from "../../../src/premierLeague/seam";
import { COMPETITION_TABLE_LINES } from "../../../convex/football/tableLines";
import {
  loadingTableWords,
  movedColumn,
  movedLabel,
  movedWords,
  noClubsWords,
  provisionalWords,
  TABLE_TITLE,
  tableColumns,
  tableLineWords,
} from "../../../src/premierLeague/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { ARSENAL, CHELSEA, FOREST, SPURS, standingsRow } from "../../support/src/premierLeague.harness";
import { openSection } from "../../support/src/premierLeagueScreen.harness";
import { panel } from "../../support/src/shell.harness";
const tablePanel = () => panel(TABLE_TITLE);

const standings: PlStandings = {
  rows: [
    standingsRow(1, ARSENAL, { played: 2, won: 2, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 6 }),
    standingsRow(2, CHELSEA, { played: 2, won: 1, drawn: 1, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 4 }),
    standingsRow(3, SPURS, { played: 2, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, goalDifference: -1, points: 1 }),
    standingsRow(3, FOREST, { played: 2, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, goalDifference: -1, points: 1 }),
  ],
  provisional: false,
  liveGameweek: null,
};

/** Each body row's cells, the club by its full name (the desk's). */
async function tableLines() {
  const rows = within(await tablePanel()).getAllByRole("row").slice(1);
  return rows.map((row) => [...row.children].map((cell, index) => (index === 1 ? cell.querySelector(".sm\\:inline")!.textContent : cell.textContent)));
}

/** The club mark heading a row, before the club's name: its crest by the club's code. */
const markOf = (row: HTMLElement) => row.querySelector<HTMLImageElement>("[data-club-mark]");

describe("the Premier League table", () => {
  it("says so while it loads", async () => {
    openSection({ loading: true });
    expect(within(await tablePanel()).getByRole("status").textContent).toBe(loadingTableWords);
  });

  it("says why it has no table before any club is held", async () => {
    openSection({ standings: { rows: [], provisional: false, liveGameweek: null } });
    expect(within(await tablePanel()).getByText(noClubsWords)).toBeTruthy();
    expect(within(await tablePanel()).queryByRole("table")).toBeNull();
  });

  it("heads its columns P W D L GF GA GD Pts, each named in full for a screen reader", async () => {
    openSection({ standings });
    expectColumnHeads(await tablePanel(), Object.values(tableColumns));
    expect(Object.values(tableColumns).map(({ short }) => short)).toEqual(["Pos", "Club", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"]);
  });

  it("lists every club in the server's order, clubs it can't part sharing a position, the difference signed", async () => {
    openSection({ standings });
    expect(await tableLines()).toEqual([
      ["1", "Arsenal", "2", "2", "0", "0", "5", "1", "+4", "6"],
      ["2", "Chelsea", "2", "1", "1", "0", "3", "2", "+1", "4"],
      ["3", "Spurs", "2", "0", "1", "1", "2", "3", "\u22121", "1"],
      ["3", "Nottingham Forest", "2", "0", "1", "1", "2", "3", "\u22121", "1"],
    ]);
  });

  it("puts each club's crest before its name, fetched by the club's code", async () => {
    openSection({ standings });
    const clubs = within(await tablePanel()).getAllByRole("rowheader");
    expect(clubs.map((club) => markOf(club)?.getAttribute("src"))).toEqual(
      [ARSENAL, CHELSEA, SPURS, FOREST].map(({ code }) => crestUrl(code)),
    );
    expect(clubs[0].firstElementChild).toBe(markOf(clubs[0]));
  });

  it("leaves goals for and against off a phone, and names a club by its three letters there", async () => {
    openSection({ standings });
    const [heads] = within(await tablePanel()).getAllByRole("row");
    const deskOnly = [...heads.children].filter((cell) => cell.className.includes("hidden sm:table-cell")).map((cell) => cell.textContent);
    expect(deskOnly).toEqual(["GF", "GA"]);
    // The name is a link to the club's page, after the mark (#1936).
    const club = within(within(await tablePanel()).getAllByRole("rowheader")[0]).getByRole("link");
    expect(club.lastElementChild!.textContent).toBe("ARS");
    expect(club.lastElementChild!.className).toContain("sm:hidden");
  });

  it("is marked provisional while a match in it is being played, and not once they are final", async () => {
    const app = openSection({ standings: { ...standings, provisional: true } });
    expect(within(await tablePanel()).getByText(provisionalWords)).toBeTruthy();

    app.premierLeague.sendStandings(standings);
    expect(within(await tablePanel()).queryByText(provisionalWords)).toBeNull();
  });

  it("while a gameweek is live, shows after Pos each club's places moved since it began, and not between gameweeks (S18.4)", async () => {
    const live: PlStandings = {
      rows: [standingsRow(1, CHELSEA, { moved: 1 }), standingsRow(2, ARSENAL, { moved: -1 }), standingsRow(3, SPURS, { moved: 0 }), standingsRow(3, FOREST, { moved: 0 })],
      provisional: true,
      liveGameweek: 11,
    };
    const app = openSection({ standings: live });
    const rows = within(await tablePanel()).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.children[1].textContent)).toEqual([movedWords(1), movedWords(-1), movedWords(0), movedWords(0)]);
    expect([movedWords(2), movedWords(-1), movedWords(0)]).toEqual(["▲ 2", "▼ 1", "–"]);
    expect(rows.map((row) => row.children[1].getAttribute("title"))).toEqual([movedLabel(1, 11), movedLabel(-1, 11), movedLabel(0, 11), movedLabel(0, 11)]);
    expect(movedLabel(2, 11)).toBe("Up 2 since GW11 began");
    expectColumnHeads(await tablePanel(), [tableColumns.position, movedColumn, ...Object.values(tableColumns).slice(1)]);

    app.premierLeague.sendStandings(standings);
    expect(within(await tablePanel()).getAllByRole("columnheader")).toHaveLength(Object.keys(tableColumns).length);
  });

  it("draws the competition's lines under its European places and above relegation, each saying what it marks (S18.5)", async () => {
    const clubs = Array.from({ length: 20 }, (_, index) => ({ code: 100 + index, name: `Club ${index + 1}`, shortName: `C${index + 1}` }));
    openSection({ standings: { rows: clubs.map((club, index) => standingsRow(index + 1, club)), provisional: false, liveGameweek: null } });
    const rows = within(await tablePanel()).getAllByRole("row").slice(1);
    const lines = rows.flatMap((row, index) => (row.title === "" ? [] : [[index + 1, row.title]]));
    const { championsLeague, otherEurope, relegation } = COMPETITION_TABLE_LINES.premierLeague;
    expect(lines).toEqual([
      [championsLeague, tableLineWords.championsLeague],
      [otherEurope, tableLineWords.otherEurope],
      [relegation, tableLineWords.relegation],
    ]);
    expect([championsLeague, otherEurope, relegation]).toEqual([5, 7, 17]);
  });
});
