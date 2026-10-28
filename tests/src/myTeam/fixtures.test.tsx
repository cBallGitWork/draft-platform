// My team's Fixtures tab (#365; spec/12, My team's tabs): reached from My team's tabs; the
// manager's team's games in gameweek order, the next to play marked, the league's average and a
// bye said so; each game's result once scored, provisional while live, linking to its matchup
// (#436); and why there are none, for a league in total points, one with no fixtures drawn yet,
// one with no rules, or someone running no team.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { MATCHUP_PATH, MY_TEAM_FIXTURES_PATH, MY_TEAM_PATH } from "../../../src/frame/menu";
import { matchupLinkLabel } from "../../../src/matchup/words";
import { sectionTabsLabel } from "../../../src/frame/words";
import type { TeamFixtures } from "../../../src/myTeam/seam";
import {
  byeWords,
  fixturesLoadingWords,
  fixturesTableLabel,
  FIXTURES_TITLE,
  leagueAverageWords,
  liveWords,
  noFigureWords,
  noFixturesWords,
  noRulesWords,
  noTeamWords,
  provisionalWords,
  scoreWords,
  totalPointsWords,
  unscoredWords,
  versusWords,
  whenWords,
} from "../../../src/myTeam/words";
import { leagueTableOf, teamFixturesOf } from "../../../src/table/drawnTable";
import { MY_TEAM_ID, type MyTeamData } from "../../support/src/myTeam.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const openFixtures = (myTeam: MyTeamData = {}, session = manager) => openApp(MY_TEAM_FIXTURES_PATH, session, { myTeam });
const rows = () =>
  within(screen.getByRole("table", { name: fixturesTableLabel("Team 1") }))
    .getAllByRole("row")
    .slice(1);
const cells = (row: HTMLElement) => Array.from((row as HTMLTableRowElement).cells, (cell) => cell.textContent);

type Game = TeamFixtures["games"][number];
const game = (gameweek: number, against: Game["against"], deadline: number | null = null, score: Game["score"] = null): Game => ({ gameweek, deadline, against, score });
const fixturesOf = (games: TeamFixtures["games"], unscored: TeamFixtures["unscored"] = []): TeamFixtures => ({ teamId: MY_TEAM_ID, teamName: "Team 1", format: "headToHead", games, unscored });

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
  it("lists each in gameweek order: its gameweek, the league's deadline, the opponent, and v until it is scored", async () => {
    const deadline = Date.parse("2026-08-15T10:00:00Z");
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, deadline), game(2, { kind: "leagueAverage" }), game(3, { kind: "bye" })]) });
    await screen.findByRole("table");

    expect(rows().map(cells)).toEqual([
      ["1", whenWords(deadline), "Team 2", versusWords],
      ["2", noFigureWords, leagueAverageWords, versusWords],
      ["3", noFigureWords, byeWords, ""],
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

  it("passes over a gameweek with no kickoff time behind one begun, as the server does (#413)", async () => {
    const now = Date.now();
    openFixtures({
      fixtures: fixturesOf([
        game(30, { kind: "team", teamName: "Team 2" }),
        game(31, { kind: "team", teamName: "Team 3" }, now - HOUR_MS),
        game(32, { kind: "team", teamName: "Team 4" }, now + WEEK_MS),
      ]),
    });
    await screen.findByRole("table");
    expect(rows().map((row) => row.getAttribute("aria-current"))).toEqual([null, null, "true"]);
  });

  it("with two games a gameweek, shows each", async () => {
    openFixtures({ fixtures: teamFixturesOf(["Team 1", "Team 2", "Team 3", "Team 4"], "Team 1", { gamesPerGameweek: 2, gameweeks: [1] }) });
    await screen.findByRole("table");
    expect(rows().map((row) => cells(row)[0])).toEqual(["1", "1"]);
  });

});

describe("the results", () => {
  const scored = { team: 61.5, opponent: 48, provisional: false };
  const live = { team: 22, opponent: 30, provisional: true };

  it("shows a scored game's score, the team's points first, with no live mark or note", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, null, scored), game(2, { kind: "team", teamName: "Team 3" })]) });
    await screen.findByRole("table");

    expect(rows().map((row) => cells(row)[3])).toEqual([scoreWords(61.5, 48), versusWords]);
    expect(screen.queryByText(liveWords)).toBeNull();
    expect(screen.queryByText(provisionalWords)).toBeNull();
  });

  it("marks a live game's score Live, and says points are provisional", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "team", teamName: "Team 2" }, null, scored), game(2, { kind: "leagueAverage" }, null, live)]) });
    await screen.findByRole("table");

    expect(rows().map((row) => cells(row)[3])).toEqual([scoreWords(61.5, 48), `${scoreWords(22, 30)}${liveWords}`]);
    expect(screen.getByText(provisionalWords)).toBeTruthy();
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
    await screen.findByRole("table");

    expect(rows().map((row) => cells(row)[3])).toEqual([scoreWords(own, other), versusWords]);
    expect(own).toBe(40);
  });

  it.each([
    ["a scored game", game(4, { kind: "team", teamName: "Team 2" }, null, scored), "Team 2"],
    ["a live game against the league's average", game(4, { kind: "leagueAverage" }, null, live), null],
    ["a game not yet played", game(4, { kind: "team", teamName: "Team 2" }), "Team 2"],
  ])("opens the matchup from %s, for the team and gameweek", async (_, played, opponent) => {
    const app = openFixtures({ fixtures: fixturesOf([played]) });
    await userEvent.click(await screen.findByRole("link", { name: matchupLinkLabel("Team 1", opponent, 4) }));

    expect(app.path()).toBe(MATCHUP_PATH);
    expect(app.matchup.useMatchup).toHaveBeenLastCalledWith(league.leagueId, expect.any(Number), { teamId: MY_TEAM_ID, gameweek: 4 });
  });

  it("has no link on a bye", async () => {
    openFixtures({ fixtures: fixturesOf([game(1, { kind: "bye" })]) });
    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).queryByRole("link")).toBeNull();
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
