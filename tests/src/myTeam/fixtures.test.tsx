// My team's Fixtures tab (#365; spec/12, My team's tabs; #1031, its approved picture): reached from
// My team's tabs; the manager's team's games to come, the next first and marked, each opponent's
// place now; its results, newest first, the league's average and a bye said so, each result's
// score, provisional while live, linking to its matchup (#436); beside them the next game and the
// season; and why there are none, for a league in total points, one with no fixtures drawn yet, one
// with no rules, or someone running no team.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { MATCHUP_PATH, MY_TEAM_FIXTURES_PATH, MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { matchupLinkLabel } from "../../../src/matchup/words";
import { sectionTabsLabel } from "../../../src/frame/words";
import { otherTeamPath } from "../../../src/myTeam/paths";
import type { TeamFixtures } from "../../../src/myTeam/seam";
import { countdownWords, pointsShort } from "../../../src/myTeam/header/words";
import { standingOf } from "../../../src/myTeam/header/teamStanding";
import { competitionsLabel } from "../../../src/table/words";
import { dateWords, formLabel, resultWords } from "../../../src/shared/words";
import {
  byeWords,
  deadlineWords,
  fixturesLoadingWords,
  fixturesTableLabel,
  FIXTURES_TITLE,
  leagueAverageWords,
  liveWords,
  matchupMoreWords,
  nextGameTitle,
  nextGameWords,
  noFigureWords,
  noFixturesWords,
  noTeamWords,
  placeWords,
  provisionalWords,
  resultsTableLabel,
  scoreWords,
  SEASON_TITLE,
  tableMoreWords,
  theirFormWords,
  toPlayWords,
  totalPointsWords,
  unscoredWords,
  whenWords,
} from "../../../src/myTeam/words";
import { idOf, leagueTableOf, teamFixturesOf } from "../../../src/table/drawnTable";
import { MY_TEAM_ID, type MyTeamData } from "../../support/src/myTeam.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const openFixtures = (myTeam: MyTeamData = {}, session = manager) => openApp(MY_TEAM_FIXTURES_PATH, session, { myTeam });
const rowsOf = (label: string) => () =>
  within(screen.getByRole("table", { name: label }))
    .getAllByRole("row")
    .slice(1);
const toPlayRows = rowsOf(fixturesTableLabel("Team 1"));
const resultRows = rowsOf(resultsTableLabel("Team 1"));
const cells = (row: HTMLElement) => Array.from((row as HTMLTableRowElement).cells, (cell) => cell.textContent);

type Game = TeamFixtures["games"][number];
const game = (gameweek: number, against: Game["against"], deadline: number | null = null, score: Game["score"] = null, number = 1): Game => ({ gameweek, game: number, deadline, against, score });
const fixturesOf = (games: TeamFixtures["games"], unscored: TeamFixtures["unscored"] = []): TeamFixtures => ({ teamId: MY_TEAM_ID, teamName: "Team 1", format: "headToHead", games, unscored });

/** Four teams after gameweek 1 of three, Team 1 top: the table and Team 1's fixtures in one draw. */
const TEAMS = ["Team 1", "Team 2", "Team 3", "Team 4"];
const AFTER_ONE = { gameweeks: [1, 2, 3], scores: new Map([[1, new Map([["Team 1", 70], ["Team 2", 35], ["Team 3", 51], ["Team 4", 22]])]]) };
const afterOne = (): MyTeamData => ({ fixtures: teamFixturesOf(TEAMS, "Team 1", AFTER_ONE), leagueTable: leagueTableOf(TEAMS, AFTER_ONE) });

describe("reaching it", () => {
  it("a manager opens it from My team's Fixtures tab, for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(within(await screen.findByRole("navigation", { name: sectionTabsLabel })).getByRole("link", { name: FIXTURES_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: "Team 1" })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_FIXTURES_PATH);
    expect(app.myTeam.useTeamFixtures).toHaveBeenCalledWith(league.leagueId);
  });

  it("is a region named by its title, so screen readers list it", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" })]) });
    expect(await screen.findByRole("region", { name: FIXTURES_TITLE })).toBeTruthy();
  });

  it("says so while it loads", async () => {
    openFixtures({ loading: true });
    expect(await screen.findByText(fixturesLoadingWords)).toBeTruthy();
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openFixtures({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTeamFixtures).not.toHaveBeenCalled();
  });

  it("shows no Competition picker or Comp column while no league has a cup", async () => {
    openFixtures(afterOne());
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });
    expect(screen.queryByRole("combobox", { name: competitionsLabel })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /comp/i })).toBeNull();
  });
});

describe("the games", () => {
  it("lists each in gameweek order: its gameweek, the league's deadline, the opponent, and v until it is scored", async () => {
    const deadline = Date.now() + WEEK_MS;
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, deadline), game(2, { kind: "leagueAverage" }), game(3, { kind: "bye" })]) });
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });

    expect(toPlayRows().map(cells)).toEqual([
      ["1", dateWords(deadline), "Team 2", "", nextGameWords],
      ["2", noFigureWords, leagueAverageWords, "", ""],
      ["3", noFigureWords, byeWords, "", ""],
    ]);
    expect(screen.getByText(toPlayWords(3))).toBeTruthy();
  });

  it("marks the next gameweek to play: the first whose deadline hasn't passed", async () => {
    const now = Date.now();
    openFixtures({
      fixtures: fixturesOf([
        game(1, { kind: "team", teamName: "Team 2" }, now - WEEK_MS),
        game(2, { kind: "team", teamName: "Team 3" }, now + HOUR_MS),
        game(3, { kind: "team", teamName: "Team 4" }, now + WEEK_MS),
      ]),
    });
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });
    expect(toPlayRows().map((row) => [cells(row)[0], row.getAttribute("aria-current")])).toEqual([
      ["2", "true"],
      ["3", null],
    ]);
    expect(resultRows().map((row) => cells(row)[0])).toEqual(["1"]);
  });

  it("passes over a gameweek with no kickoff time behind one begun, as the server does (#413)", async () => {
    const now = Date.now();
    openFixtures({
      fixtures: fixturesOf([
        game(30, { kind: "team", teamName: "Team 2" }),
        game(31, { kind: "team", teamName: "Team 3" }, now - HOUR_MS),
        game(32, { kind: "team", teamName: "Team 4" }, now + WEEK_MS),
      ]),
    });
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });
    expect(toPlayRows().map((row) => [cells(row)[0], row.getAttribute("aria-current")])).toEqual([["32", "true"]]);
    expect(resultRows().map((row) => cells(row)[0])).toEqual(["31", "30"]);
  });

  it("with two games a gameweek, shows each", async () => {
    openFixtures({ fixtures: teamFixturesOf(TEAMS, "Team 1", { gamesPerGameweek: 2, gameweeks: [1] }) });
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });
    expect(toPlayRows().map((row) => cells(row)[0])).toEqual(["1", "1"]);
  });

  it("shows each opponent's place in the table now", async () => {
    const data = afterOne();
    openFixtures(data);
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });
    const placeOf = (team: string) => placeWords(data.leagueTable!.table.findIndex((row) => row.teamName === team) + 1);

    expect(toPlayRows().map((row) => cells(row)[3])).toEqual(toPlayRows().map((row) => placeOf(cells(row)[2]!)));
  });

  it("opens an opponent's team from his name", async () => {
    const app = openFixtures(afterOne());
    const opponent = (await screen.findAllByRole("rowheader"))[0].textContent!;
    await userEvent.click(within(screen.getByRole("table", { name: fixturesTableLabel("Team 1") })).getAllByRole("link", { name: opponent })[0]);

    expect(decodeURIComponent(app.path())).toBe(otherTeamPath(league.leagueId, idOf(opponent)));
  });
});

describe("the results", () => {
  const scored = { team: 61.5, opponent: 48, provisional: false };
  const live = { team: 22, opponent: 30, provisional: true };

  it("shows a scored game's score, the team's points first, with no live mark or note", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, null, scored), game(2, { kind: "team", teamName: "Team 3" })]) });
    await screen.findByRole("table", { name: resultsTableLabel("Team 1") });

    expect(resultRows().map((row) => cells(row)[3])).toEqual([`${resultWords.won.short}${scoreWords(61.5, 48)}`]);
    expect(toPlayRows().map((row) => cells(row)[0])).toEqual(["2"]);
    expect(screen.queryByText(liveWords)).toBeNull();
    expect(screen.queryByText(provisionalWords)).toBeNull();
  });

  it("marks a live game's score Live, and says points are provisional", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, null, scored), game(2, { kind: "leagueAverage" }, null, live)]) });
    await screen.findByRole("table", { name: resultsTableLabel("Team 1") });

    expect(resultRows().map((row) => cells(row)[3])).toEqual([`${resultWords.lost.short}${scoreWords(22, 30)}${liveWords}`, `${resultWords.won.short}${scoreWords(61.5, 48)}`]);
    expect(screen.getAllByText(provisionalWords).length).toBeGreaterThan(0);
  });

  it("says why a gameweek begun has no result, when it can't be scored", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" })], [{ gameweek: 1, reason: "a rule is no longer sound" }]) });
    expect(await screen.findByText(unscoredWords(1, "a rule is no longer sound"))).toBeTruthy();
  });

  it("shows the score the table's fixtures show for the same game, the team's points first", async () => {
    const teams = ["Team 1", "Team 2", "Team 3", "Team 4"];
    const drawn = { gameweeks: [1, 2], scores: new Map([[1, new Map([["Team 1", 40], ["Team 2", 35], ["Team 3", 51], ["Team 4", 22]])]]) };
    const fixture = leagueTableOf(teams, drawn).gameweeks[0].fixtures.find(({ team, opponent }) => team === "Team 1" || opponent === "Team 1")!;
    const [own, other] = fixture.team === "Team 1" ? [fixture.points!.team, fixture.points!.opponent] : [fixture.points!.opponent, fixture.points!.team];
    openFixtures({ fixtures: teamFixturesOf(teams, "Team 1", drawn) });
    await screen.findByRole("table", { name: resultsTableLabel("Team 1") });

    expect(resultRows().map((row) => cells(row)[3])).toEqual([`${resultWords.won.short}${scoreWords(own, other)}`]);
    expect(toPlayRows()).toHaveLength(1);
    expect(own).toBe(40);
  });

  it.each([
    ["a scored game", game(4, { kind: "team", teamName: "Team 2" }, null, scored), resultsTableLabel("Team 1"), matchupLinkLabel("Team 1", "Team 2", 4)],
    ["a live game against the league's average", game(4, { kind: "leagueAverage" }, null, live), resultsTableLabel("Team 1"), matchupLinkLabel("Team 1", null, 4)],
    ["a game not yet played", game(4, { kind: "team", teamName: "Team 2" }), nextGameTitle(4, "Team 2"), matchupMoreWords],
  ])("opens the matchup from %s, for the team and gameweek", async (_, played, where, link) => {
    const app = openFixtures({ fixtures: fixturesOf([played]) });
    const place = await screen.findByRole(where === nextGameTitle(4, "Team 2") ? "region" : "table", { name: where });
    await userEvent.click(within(place).getByRole("link", { name: link }));

    expect(app.path()).toBe(MATCHUP_PATH);
    expect(app.matchup.useMatchup).toHaveBeenLastCalledWith(league.leagueId, expect.any(Number), { teamId: MY_TEAM_ID, gameweek: 4 });
  });

  it("has no link on a bye", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "bye" })]) });
    await screen.findByRole("table", { name: fixturesTableLabel("Team 1") });
    for (const table of screen.getAllByRole("table")) expect(within(table).queryByRole("link")).toBeNull();
    expect(screen.queryByRole("region", { name: nextGameTitle(1, byeWords) })).toBeNull();
  });
});

describe("the next game and the season", () => {
  it("shows the next opponent's place and points, the deadline and its countdown, and their form", async () => {
    // Half an hour clear of the countdown's next step, so the page's minute and the test's agree.
    const deadline = Date.now() + 2 * WEEK_MS + 30 * MINUTE_MS;
    const data = afterOne();
    const fixtures = { ...data.fixtures!, games: data.fixtures!.games.map((each) => (each.gameweek === 2 ? { ...each, deadline } : each)) };
    openFixtures({ ...data, fixtures });
    const next = fixtures.games.find((each) => each.gameweek === 2)!;
    const opponent = next.against.kind === "team" ? next.against.teamName : "";
    const index = data.leagueTable!.table.findIndex((row) => row.teamName === opponent);
    const panel = await screen.findByRole("region", { name: nextGameTitle(2, opponent) });

    expect(within(panel).getByText(`${placeWords(index + 1)},`, { exact: false })).toBeTruthy();
    expect(within(panel).getByText(pointsShort(data.leagueTable!.table[index].points))).toBeTruthy();
    expect(within(panel).getByText(deadlineWords).nextSibling?.textContent).toBe(`${whenWords(deadline)} ${countdownWords(deadline - Date.now())}`);
    expect(within(panel).getByText(theirFormWords)).toBeTruthy();
    expect(within(panel).getByRole("img", { name: formLabel(standingOf(data.leagueTable!, opponent)!.form) })).toBeTruthy();
  });

  it("shows the season as the table counts it: played, won, drawn, lost, for, against and points, the team's place on its plate", async () => {
    const data = afterOne();
    const app = openFixtures(data);
    const panel = await screen.findByRole("region", { name: SEASON_TITLE });
    const { played, won, drawn, lost, pointsFor, pointsAgainst, points } = data.leagueTable!.table[0];

    expect(data.leagueTable!.table[0].teamName).toBe("Team 1");
    expect(within(panel).getByText(placeWords(1))).toBeTruthy();
    expect(cells(within(panel).getAllByRole("row")[1])).toEqual([played, won, drawn, lost, pointsFor, pointsAgainst, points].map(String));
    expect([played, won, pointsFor, points]).toEqual([1, 1, 70, 3]);
    await userEvent.click(within(panel).getByRole("link", { name: tableMoreWords }));
    expect(app.path()).toBe(TABLE_PATH);
  });
});

describe("why there are none", () => {
  it.each([
    ["a league in total points", { ...fixturesOf([]), format: "totalPoints" as const }, totalPointsWords],
    ["a league with no fixtures drawn yet", fixturesOf([]), noFixturesWords],
  ])("says so for %s", async (_, fixtures, words) => {
    openFixtures({ fixtures });
    expect(await screen.findByText(words)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
