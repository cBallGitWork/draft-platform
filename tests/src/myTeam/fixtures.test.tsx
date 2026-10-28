// My team's Fixtures tab (#365; spec/12, My team's tabs): reached from My team's tabs; the
// manager's team's games in gameweek order, the next to play marked, the league's average and a
// bye said so; and why there are none, for a league in total points, one with no fixtures drawn
// yet, one with no rules, or someone running no team.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { MY_TEAM_FIXTURES_PATH, MY_TEAM_PATH } from "../../../src/frame/menu";
import { sectionTabsLabel } from "../../../src/frame/words";
import type { TeamFixtures } from "../../../src/myTeam/seam";
import {
  byeWords,
  fixturesLoadingWords,
  fixturesTableLabel,
  FIXTURES_TITLE,
  leagueAverageWords,
  noFigureWords,
  noFixturesWords,
  noResultsWords,
  noRulesWords,
  noTeamWords,
  totalPointsWords,
  whenWords,
} from "../../../src/myTeam/words";
import { teamFixturesOf } from "../../../src/table/drawnTable";
import type { MyTeamData } from "../../support/src/myTeam.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const openFixtures = (myTeam: MyTeamData = {}, session = manager) => openApp(MY_TEAM_FIXTURES_PATH, session, { myTeam });
const rows = () =>
  within(screen.getByRole("table", { name: fixturesTableLabel("Team 1") }))
    .getAllByRole("row")
    .slice(1);
const cells = (row: HTMLElement) => Array.from((row as HTMLTableRowElement).cells, (cell) => cell.textContent);

const game = (gameweek: number, against: TeamFixtures["games"][number]["against"], deadline: number | null = null) => ({ gameweek, deadline, against });
const fixturesOf = (games: TeamFixtures["games"]): TeamFixtures => ({ teamName: "Team 1", format: "headToHead", games });

describe("reaching it", () => {
  it("a manager opens it from My team's Fixtures tab, for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(within(await screen.findByRole("navigation", { name: sectionTabsLabel })).getByRole("link", { name: FIXTURES_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: FIXTURES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_FIXTURES_PATH);
    expect(app.myTeam.useTeamFixtures).toHaveBeenCalledWith(league.leagueId);
  });

  it("is a region named by its title, so screen readers list it", async () => {
    openFixtures();
    expect(await screen.findByRole("region", { name: FIXTURES_TITLE })).toBeTruthy();
  });

  it("says so while it loads", async () => {
    openFixtures({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(fixturesLoadingWords);
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openFixtures({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTeamFixtures).not.toHaveBeenCalled();
  });
});

describe("the games", () => {
  it("lists each in gameweek order: its gameweek, the league's deadline, and the opponent", async () => {
    const deadline = Date.parse("2026-08-15T10:00:00Z");
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, deadline), game(2, { kind: "leagueAverage" }), game(3, { kind: "bye" })]) });
    await screen.findByRole("table");

    expect(rows().map(cells)).toEqual([
      ["1", whenWords(deadline), "Team 2"],
      ["2", noFigureWords, leagueAverageWords],
      ["3", noFigureWords, byeWords],
    ]);
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
    await screen.findByRole("table");
    expect(rows().map((row) => row.getAttribute("aria-current"))).toEqual([null, "true", null]);
  });

  it("with two games a gameweek, shows each", async () => {
    openFixtures({ fixtures: teamFixturesOf(["Team 1", "Team 2", "Team 3", "Team 4"], "Team 1", { gamesPerGameweek: 2, gameweeks: [1] }) });
    await screen.findByRole("table");
    expect(rows().map((row) => cells(row)[0])).toEqual(["1", "1"]);
  });

  it("says no result is shown until matchups are scored", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "leagueAverage" })]) });
    expect(await screen.findByText(noResultsWords)).toBeTruthy();
  });
});

describe("why there are none", () => {
  it.each([
    ["a league in total points", { ...fixturesOf([]), format: "totalPoints" as const }, totalPointsWords],
    ["a league with no fixtures drawn yet", fixturesOf([]), noFixturesWords],
    ["a league made before rules", null, noRulesWords],
  ])("says so for %s", async (_, fixtures, words) => {
    openFixtures({ fixtures });
    expect(await screen.findByText(words)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
