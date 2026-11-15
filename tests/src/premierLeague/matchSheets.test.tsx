// The match page's two clubs (#45; spec/10, The match page): each club's team sheet with every
// man's points and the team they're for, or "Free agent", and the team stats side by side. The
// rest of the page is matchPage.test.tsx's.

import { cleanup, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HOUR_MS } from "../../../convex/shared/time";
import {
  cameOnWords,
  freeAgentWords,
  markLabels,
  matchColumns,
  MOVED_TITLE,
  noFigureWords,
  noMenWords,
  notCountingLabel,
  noTeamStatsWords,
  pointsProblemWords,
  possessionWords,
  provisionalWords,
  provWords,
  sheetLabel,
  STAT_COLUMN,
  SUBSTITUTES_TITLE,
  teamStatRows,
  teamStatsLabel,
  unusedLabel,
} from "../../../src/premierLeague/words";
import { expectColumnHeads, expectUnseenHead } from "../../support/src/columnHeads";
import { man, matchOf, MEN, openMatch } from "../../support/src/matchPage.harness";
import { ARSENAL, CHELSEA } from "../../support/src/premierLeague.harness";
import { MY_TEAM_NAME, THEIR_TEAM_NAME } from "../../support/src/teams.harness";

/** The rows of a club's team sheet, each as its cells' text. */
function sheetRows(club: string) {
  const table = screen.getByRole("table", { name: sheetLabel(club) });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent));
}

describe("the team sheets", () => {
  // "Just because they aren't a team doesn't mean they don't get points"; "Well he would be a free
  // agent or waiver not blank" (Craig, 31 Oct 2026; #771).
  it("each club's starters, then its substitutes, each man with his points and his team, or a free agent's shown plainly, and a bench man's greyed", async () => {
    openMatch({ match: matchOf() });
    await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expect(sheetRows(ARSENAL.name)).toEqual([
      ["GK", "Raya", "Team 1", "2"],
      ["CM", "Saka", "Team 2", "11"],
      ["CM", "Rice", "Team 1", noFigureWords],
      [SUBSTITUTES_TITLE],
      ["CM", `Ødegaard${cameOnWords}`, freeAgentWords, "3"],
      ["GK", `Arrizabalaga ${unusedLabel}`, "Team 1", `0 ${notCountingLabel}`],
    ]);
    expect(sheetRows(CHELSEA.name)).toEqual([["CM", "Palmer", "Team 2", "7"]]);
  });

  // "people don't think grey means no teams" (Craig, 31 Oct 2026).
  it("a free agent's points are a figure, as an owned man's, never greyed", async () => {
    openMatch({ match: matchOf() });
    const sheet = await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    const row = within(sheet).getByRole("rowheader", { name: /^Ødegaard/ }).closest("tr")!;
    const points = within(row).getAllByRole("cell").at(-1)!;
    expect(points.className).toContain("text-figure");
    expect(points.className).not.toContain("text-muted");
  });

  it("marks a substitute who came on in the event colour", async () => {
    openMatch({ match: matchOf() });
    await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expect(screen.getByText(cameOnWords).className).toContain("text-event");
  });

  it("before the sheets are out, says they come about an hour before kickoff", async () => {
    openMatch({ match: matchOf({ men: [] }) });
    expect(await screen.findAllByText(noMenWords)).toHaveLength(2);
  });

  it("before kickoff, the sheets as named: a substitute neither greyed nor marked as on", async () => {
    const before = { played: null, points: null };
    const men = [man(1, "Raya", "home", { ...before, position: "GK", ownerTeamName: "Team 1" }), man(4, "Ødegaard", "home", { ...before, started: false })];
    openMatch({ match: matchOf({ kickoff: Date.now() + HOUR_MS, score: null, men }) });
    await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expect(sheetRows(ARSENAL.name)).toEqual([["GK", "Raya", "Team 1", noFigureWords], [SUBSTITUTES_TITLE], ["CM", "Ødegaard", freeAgentWords, noFigureWords]]);
    expect(screen.getByRole("rowheader", { name: "Ødegaard" }).closest("tr")!.className).not.toContain("text-muted");
  });

  it("a man who has since left both clubs has his own panel", async () => {
    openMatch({ match: matchOf({ men: [...MEN, man(7, "Isak", null)] }) });
    await screen.findByRole("table", { name: sheetLabel(MOVED_TITLE) });
    expect(sheetRows(MOVED_TITLE)).toEqual([["CM", "Isak", freeAgentWords, noFigureWords]]);
  });

  // "the team sheets' column of the league team owning each player is headed Owner" (Craig, 10 Nov 2026, on #1032; S10.7).
  it("heads the team each man's points are for Owner", async () => {
    openMatch({ match: matchOf() });
    const sheet = await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expectColumnHeads(within(sheet).getAllByRole("row")[0], Object.values(matchColumns));
    expect(matchColumns.owner.short).toBe("Owner");
  });

  // "We probably need an assist icon somewhere too" (Craig, 10 Nov 2026, on #1032): a ball, a boot and cards after the name.
  it("marks each goal, assist and card after a man's name, and none for a man with none", async () => {
    const saka = man(2, "Saka", "home", { marks: { goals: 2, assists: 1, yellowCards: 1, redCards: 1 } });
    openMatch({ match: matchOf({ men: [saka, man(3, "Rice", "home")] }) });
    const row = (await screen.findByRole("rowheader", { name: /^Saka/ })).closest("tr")!;
    expect(within(row).getAllByRole("img").map((mark) => mark.getAttribute("aria-label"))).toEqual([
      markLabels.goals,
      markLabels.goals,
      markLabels.assists,
      markLabels.yellowCards,
      markLabels.redCards,
    ]);
    expect(within(screen.getByRole("rowheader", { name: "Rice" }).closest("tr")!).queryAllByRole("img")).toEqual([]);
  });

  // "your own players highlighted" (Craig, 10 Nov 2026, on #1032): their rows lit, their owner in white.
  it("lights the viewer's own men, and only theirs", async () => {
    openMatch({ match: matchOf() });
    const rowOf = async (name: string) => (await screen.findByRole("rowheader", { name })).closest("tr")!;
    expect((await rowOf("Raya")).className).toContain("bg-row-lit");
    expect(within(await rowOf("Raya")).getByText(MY_TEAM_NAME).closest("td")!.className).toContain("text-fact");
    expect((await rowOf("Saka")).className).not.toContain("bg-row-lit");
    expect(within(await rowOf("Saka")).getByText(THEIR_TEAM_NAME).closest("td")!.className).toContain("text-soft");
  });

  // "Live points carry a small 'prov.' tag until the gameweek's points are final" (Craig, 10 Nov 2026, on #1032).
  it("S10.10: each sheet's plate says prov. while its points are live, and nothing once they are final", async () => {
    openMatch({ match: matchOf() });
    await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expect(screen.getAllByTitle(provisionalWords).map((tag) => tag.textContent)).toEqual([provWords, provWords]);
    cleanup();
    openMatch({ match: matchOf({ provisional: false }) });
    await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expect(screen.queryByText(provWords)).toBeNull();
  });

  it("when the league's points can't be worked out, says why in the alert strip", async () => {
    openMatch({ match: matchOf({ pointsProblem: "a rule names a stat that doesn't exist" }) });
    expect((await screen.findByText(pointsProblemWords("a rule names a stat that doesn't exist"))).className).toContain("alert-strip");
  });
});

describe("the team stats", () => {
  const stats = {
    home: { shots: 10, shotsOnTarget: 2, possession: 40.4, corners: 3, yellowCards: 2, redCards: 2 },
    away: { shots: 21, shotsOnTarget: 5, possession: 59.6, corners: 9, yellowCards: 3, redCards: 0 },
  };
  const rows = async () => {
    const table = await screen.findByRole("table", { name: teamStatsLabel(ARSENAL.shortName, CHELSEA.shortName) });
    return within(table)
      .getAllByRole("row")
      .map((row) => [...row.children].map((cell) => cell.textContent));
  };

  it("the five, home's left of each and away's right, possession to the whole percent and cards as yellow and red", async () => {
    openMatch({ match: matchOf({ teamStats: stats }) });
    expect(await rows()).toEqual([
      [ARSENAL.shortName, STAT_COLUMN.short, CHELSEA.shortName],
      ["10", teamStatRows.shots, "21"],
      ["2", teamStatRows.shotsOnTarget, "5"],
      [possessionWords(40.4), teamStatRows.possession, possessionWords(59.6)],
      ["3", teamStatRows.corners, "9"],
      ["2", teamStatRows.yellowCards, "3"],
      ["2", teamStatRows.redCards, "0"],
    ]);
    expect([possessionWords(40.4), possessionWords(59.6)]).toEqual(["40%", "60%"]);
  });

  it("heads each club's column with its three letters, named by its full name, and the stat's column for screen readers only", async () => {
    openMatch({ match: matchOf({ teamStats: stats }) });
    const table = await screen.findByRole("table", { name: teamStatsLabel(ARSENAL.shortName, CHELSEA.shortName) });
    expectColumnHeads(table, [{ short: ARSENAL.shortName, long: ARSENAL.name }, STAT_COLUMN, { short: CHELSEA.shortName, long: CHELSEA.name }]);
    expectUnseenHead(table, STAT_COLUMN);
  });

  it("early on, before Opta sends possession, shows a dash for it", async () => {
    const nothingYet = { shots: 0, shotsOnTarget: 0, possession: null, corners: 0, yellowCards: 0, redCards: 0 };
    openMatch({ match: matchOf({ teamStats: { home: nothingYet, away: nothingYet } }) });
    expect((await rows())[3]).toEqual([noFigureWords, teamStatRows.possession, noFigureWords]);
  });

  it("before any are read, says they come once it kicks off", async () => {
    openMatch({ match: matchOf() });
    expect(await screen.findByText(noTeamStatsWords)).toBeTruthy();
  });
});
