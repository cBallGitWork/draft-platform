// The league's table and fixtures (#33; spec/12, spec/09): reached from the menu by anyone in the
// league; the table, all noughts and saying so until a gameweek is scored, then each fixture's
// score, live points marked provisional and a gameweek that can't be scored named; the fixtures a gameweek
// at a time, over the gameweeks the league plays, the team left over against the league's average
// or on a bye; and a total-points league's table with no fixtures.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { nextGameweekLabel, previousGameweekLabel } from "../../../src/words";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";
import { leagueTableOf } from "../../../src/table/drawnTable";
import type { TableData } from "../../support/src/table.harness";
import {
  byeWords,
  columns,
  fixturesListLabel,
  gameweekWords,
  leagueAverageWords,
  loadingWords,
  noLineupWords,
  noResultsWords,
  noRulesWords,
  provisionalWords,
  scoreWords,
  unscoredWords,
  TABLE_PAGE_TITLE,
  tooFewTeamsWords,
  totalPointsWords,
} from "../../../src/table/words";

const FIVE = ["Ann's", "Bob's", "Cat's", "Dan's", "Eve's"];
const openTable = (table: TableData = {}) => openApp(TABLE_PATH, manager, { table });
const fixtureLines = (gameweek: number) =>
  within(screen.getByRole("list", { name: fixturesListLabel(gameweek) }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("reaching it", () => {
  it.each([
    ["a manager", manager],
    ["a commissioner running no team", commissioner],
  ])("%s opens it from the menu's Table, for the league the app is in", async (_, session) => {
    const app = openApp(MY_TEAM_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: "Table" }));

    expect(await screen.findByRole("heading", { level: 1, name: TABLE_PAGE_TITLE })).toBeTruthy();
    expect(app.path()).toBe(TABLE_PATH);
    expect(app.table.useLeagueTable).toHaveBeenCalledWith(league.leagueId);
  });

  it("is a region named by its title, so screen readers list it", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE) });
    expect(await screen.findByRole("region", { name: TABLE_PAGE_TITLE })).toBeTruthy();
  });

  it("says so while it loads", async () => {
    openTable({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });

  it("says why a league made before rules has none", async () => {
    openTable({ leagueTable: null });
    expect(await screen.findByText(noRulesWords)).toBeTruthy();
  });
});

describe("the table", () => {
  it("lists every team on nothing, in the order they were made, and says why", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE) });
    await screen.findByText(noResultsWords);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((row) => [within(row).getByRole("rowheader").textContent, within(row).getAllByRole("cell").map((cell) => cell.textContent)]);
    expect(rows).toEqual(FIVE.map((name, index) => [name, [String(index + 1), "0", "0", "0", "0", "0", "0", "0", "0"]]));
  });

  it("heads a head-to-head table with played, won, drawn, lost, for, against, the difference and points", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE) });
    const heads = within(await screen.findByRole("table")).getAllByRole("columnheader");
    expect(heads.map((head) => head.getAttribute("aria-label"))).toEqual(Object.values(columns).map((column) => column.long));
  });

  it("ranks by points once matchups are scored, with a signed difference, and stops saying there are no results", async () => {
    const scores = new Map([[1, new Map([["Ann's", 10], ["Bob's", 30.5]])]]);
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { scores }) });

    const [first, second] = (await screen.findAllByRole("row")).slice(1);
    expect(within(first).getByRole("rowheader").textContent).toBe("Bob's");
    expect(within(first).getByText("+20.5")).toBeTruthy();
    expect(within(second).getByText("-20.5")).toBeTruthy();
    expect(screen.queryByText(noResultsWords)).toBeNull();
  });

  it("says when live points count, provisional until final", async () => {
    const scores = new Map([[1, new Map([["Ann's", 10], ["Bob's", 30.5]])]]);
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { scores, provisional: ["Bob's"] }) });
    expect(await screen.findByText(provisionalWords)).toBeTruthy();
  });

  it("names a gameweek that couldn't be scored, and why, rather than going blank (#287)", async () => {
    const reason = 'rule 8 of the scoring set scores "goals_scroed", which is neither a catalogue stat nor one of the league\'s own';
    openTable({ leagueTable: leagueTableOf(FIVE, { unscored: [{ gameweek: 6, reason }] }) });
    expect(await screen.findByText(unscoredWords(6, reason))).toBeTruthy();
    expect(screen.queryByText(provisionalWords)).toBeNull();
  });

  it("in total points, has only played and points, and no fixtures", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE, { format: "totalPoints" }) });
    const heads = within(await screen.findByRole("table")).getAllByRole("columnheader");
    expect(heads.map((head) => head.textContent)).toEqual(["Pos", "Team", "P", "Pts"]);
    expect(screen.getByText(totalPointsWords)).toBeTruthy();
    expect(screen.queryByRole("button", { name: nextGameweekLabel })).toBeNull();
  });
});

describe("the fixtures", () => {
  /** Gameweek 1 began two weeks ago, so gameweek 3 is the first not begun. */
  const deadlineOf = (gameweek: number) => Date.now() + (gameweek - 3) * WEEK_MS + HOUR_MS;

  it("open on the first gameweek not yet begun, the team left over against the league's average", async () => {
    const drawn = leagueTableOf(FIVE, { deadlineOf });
    openTable({ leagueTable: drawn });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(3) })).toBeTruthy();
    const { fixtures } = drawn.gameweeks[2];
    expect(fixtures.filter((fixture) => fixture.opponent === null)).toHaveLength(1);
    expect(fixtureLines(3)).toEqual(fixtures.map(({ team, opponent }) => `${team}v${opponent ?? leagueAverageWords}`));
  });

  it("show each scored fixture's score, the league's average's too, and name a team on 0 for saving no lineup", async () => {
    const scores = new Map([[1, new Map([["Ann's", 20], ["Bob's", 0], ["Cat's", 41.5], ["Dan's", 33], ["Eve's", 18]])]]);
    const drawn = leagueTableOf(FIVE, { scores, noLineup: ["Bob's"], deadlineOf: () => Date.now() - HOUR_MS, gameweeks: [1] });
    openTable({ leagueTable: drawn });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(1) })).toBeTruthy();
    expect(fixtureLines(1)).toEqual(
      drawn.gameweeks[0].fixtures.map(({ team, opponent, points }) => `${team}${scoreWords(points!.team, points!.opponent)}${opponent ?? leagueAverageWords}`),
    );
    const average = drawn.gameweeks[0].fixtures.find((fixture) => fixture.opponent === null)!;
    expect(average.points!.opponent).toBe(22.5);
    expect(screen.getByText(noLineupWords(["Bob's"]))).toBeTruthy();
  });

  it("step through only the gameweeks the league plays, no further than its first or last", async () => {
    const gameweeks = [1, 2, 5, 6];
    openTable({ leagueTable: leagueTableOf(FIVE, { gameweeks }) });

    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(1) })).toBeTruthy();
    expect((screen.getByRole("button", { name: previousGameweekLabel }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(5) })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    expect((screen.getByRole("button", { name: nextGameweekLabel }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: previousGameweekLabel }));
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(5) })).toBeTruthy();
  });

  it("open on the last gameweek once every one has begun", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE, { gameweeks: [1, 2], deadlineOf: () => Date.now() - HOUR_MS }) });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(2) })).toBeTruthy();
  });

  it("give the team left over a bye in a league that has them", async () => {
    const drawn = leagueTableOf(FIVE, { oddTeamOut: "bye" });
    openTable({ leagueTable: drawn });
    expect(await screen.findByText(byeWords(drawn.gameweeks[0].byes))).toBeTruthy();
    expect(fixtureLines(1)).toHaveLength(2);
  });

  it("with two games a gameweek, list both rounds' fixtures and every team with a bye", async () => {
    const drawn = leagueTableOf(FIVE, { oddTeamOut: "bye", gamesPerGameweek: 2 });
    openTable({ leagueTable: drawn });
    const [first] = drawn.gameweeks;
    const [one, other] = first.byes;
    expect(first.byes).toHaveLength(2);
    expect(await screen.findByText(`${one} and ${other} have a bye.`)).toBeTruthy();
    expect(fixtureLines(1)).toHaveLength(4);
  });

  it("wait for a second team", async () => {
    openTable({ leagueTable: leagueTableOf(["Ann's"]) });
    expect(await screen.findByText(tooFewTeamsWords)).toBeTruthy();
  });
});
