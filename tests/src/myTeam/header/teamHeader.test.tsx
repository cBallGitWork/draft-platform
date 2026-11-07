// My team's header band (src/myTeam/header/TeamHeader.tsx; the approved Tactics picture): the
// team's name, the deadline and its countdown, the opponent then, the last result, the form and the
// table place, from the league's table and fixtures; and the Tactics tab's GW opponent widget.

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formLabel, deadlineHead, meterListLabel, formHead, gameweekShort, placeWords, pointsShort, tableHead, versusWords } from "../../../../src/myTeam/header/words";
import { opponentTitle } from "../../../../src/myTeam/tactics/words";
import { byeWords, leagueAverageWords, noFigureWords } from "../../../../src/myTeam/words";
import { gamesIn } from "../../../../src/myTeam/header/teamStanding";
import { MATCHUP_PATH } from "../../../../src/frame/menu";
import { idOf, leagueTableOf } from "../../../../src/table/drawnTable";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK } from "../../../support/src/tactics.harness";
import { SAVED, openTacticsTab } from "../../../support/src/tacticsScreen.harness";

const ME = league.teamName!;
const TEAMS = [ME, "Rovers XI", "Kroos Control", "Pique Blinders"];
/** Eight gameweeks scored, the manager's team scoring most, so every game is a win. */
const POINTS: Record<string, number> = { [ME]: 54, "Rovers XI": 41, "Kroos Control": 47, "Pique Blinders": 30 };
const scores = new Map(Array.from({ length: TACTICS_GAMEWEEK - 1 }, (_, index) => [index + 1, new Map(TEAMS.map((team) => [team, POINTS[team]]))]));
const TABLE = leagueTableOf(TEAMS, { scores });

/** The first gameweek the manager's team is the odd one out, on a bye or against the average. */
const sittingOutIn = (table: typeof TABLE) =>
  table.gameweeks.find(({ fixtures, byes }) => byes.includes(ME) || fixtures.some(({ team, opponent }) => team === ME && opponent === null))!.gameweek;

/** The band's readings, by their heads. */
const meter = (head: string) => within(screen.getByRole("group", { name: meterListLabel })).getByText(head).nextElementSibling!;

describe("My team's header band", () => {
  it("reads the team's opponent, last result, form and table place from the league's table", async () => {
    const app = openTacticsTab({ tactics: SAVED, leagueTable: TABLE });
    expect(await screen.findByRole("heading", { level: 1, name: ME })).toBeTruthy();
    expect(app.myTeam.useLeagueTable).toHaveBeenCalledWith(league.leagueId);

    const opponent = TABLE.gameweeks.find(({ gameweek }) => gameweek === TACTICS_GAMEWEEK)!.fixtures.find(({ team, opponent }) => team === ME || opponent === ME)!;
    const name = opponent.team === ME ? opponent.opponent! : opponent.team;
    const link = within(meter(versusWords) as HTMLElement).getByRole("link");
    expect(link.textContent).toContain(name);
    expect(link.getAttribute("href")).toContain(MATCHUP_PATH);
    expect(new URLSearchParams(link.getAttribute("href")!.split("?")[1]).get("team")).toBe(idOf(ME));

    expect(within(meter(gameweekShort(TACTICS_GAMEWEEK - 1)) as HTMLElement).getByText(/^Won 54–/)).toBeTruthy();
    expect(within(meter(formHead) as HTMLElement).getByRole("img").getAttribute("aria-label")).toBe(formLabel(["won", "won", "won", "won", "won"]));
    expect(meter(tableHead).textContent).toBe(`${placeWords(1)}, ${pointsShort(TABLE.table[0].points)}`);
  });

  it("in total points, shows the deadline and the last gameweek's points, with no opponent or form", async () => {
    openTacticsTab({ tactics: { ...SAVED, deadline: Date.now() + 1000 * 60 * 60 }, leagueTable: leagueTableOf(TEAMS, { scores, format: "totalPoints" }) });
    expect(await screen.findByText(deadlineHead(TACTICS_GAMEWEEK))).toBeTruthy();
    expect(screen.queryByText(formHead)).toBeNull();
    expect(screen.queryByText(versusWords)).toBeNull();
    expect(meter(gameweekShort(TACTICS_GAMEWEEK - 1)).textContent).toBe(pointsShort(54));
  });
});

describe("the Tactics tab's GW opponent widget", () => {
  it("names the opponent as a link to the matchup, with his place, points and form", async () => {
    openTacticsTab({ tactics: SAVED, leagueTable: TABLE });
    const widget = await screen.findByRole("region", { name: opponentTitle(TACTICS_GAMEWEEK) });
    expect(within(widget).getByRole("link").getAttribute("href")).toContain(MATCHUP_PATH);
    expect(within(widget).getByText(tableHead)).toBeTruthy();
    expect(within(widget).getByText(formHead)).toBeTruthy();
  });

  it("in a gameweek of two games, names both opponents, each opening its own matchup, in the band too", async () => {
    const table = leagueTableOf(TEAMS, { scores, gamesPerGameweek: 2 });
    openTacticsTab({ tactics: SAVED, leagueTable: table });
    const widget = await screen.findByRole("region", { name: opponentTitle(TACTICS_GAMEWEEK) });
    const names = gamesIn(table, ME, TACTICS_GAMEWEEK).map(({ against }) => (against.kind === "team" ? against.team : ""));
    expect(names).toHaveLength(2);
    for (const links of [within(widget).getAllByRole("link"), within(meter(versusWords) as HTMLElement).getAllByRole("link")]) {
      expect(links.map((link) => link.textContent)).toEqual(names.map((name) => expect.stringContaining(name)));
      for (const link of links) expect(link.getAttribute("href")).toContain(MATCHUP_PATH);
    }
    expect(within(widget).getAllByText(formHead)).toHaveLength(2);
  });

  it("shows the odd team out playing the league's average, as a link to its matchup", async () => {
    const table = leagueTableOf(TEAMS.slice(0, 3), { oddTeamOut: "leagueAverage" });
    const gameweek = sittingOutIn(table);
    openTacticsTab({ tactics: { ...SAVED, gameweek }, leagueTable: table });
    const widget = await screen.findByRole("region", { name: opponentTitle(gameweek) });
    expect(within(widget).getByRole("link").textContent).toContain(leagueAverageWords);
  });

  it("shows the odd team out on a bye, with no matchup", async () => {
    const table = leagueTableOf(TEAMS.slice(0, 3), { oddTeamOut: "bye" });
    const gameweek = sittingOutIn(table);
    openTacticsTab({ tactics: { ...SAVED, gameweek }, leagueTable: table });
    const widget = await screen.findByRole("region", { name: opponentTitle(gameweek) });
    expect(within(widget).getByText(byeWords)).toBeTruthy();
    expect(within(widget).queryByRole("link")).toBeNull();
  });

  it("shows — where the team has no game in the gameweek, as before the fixtures are drawn", async () => {
    openTacticsTab({ tactics: SAVED, leagueTable: leagueTableOf(TEAMS, { scores, gameweeks: [1, 2, 3] }) });
    const widget = await screen.findByRole("region", { name: opponentTitle(TACTICS_GAMEWEEK) });
    expect(widget.textContent).toContain(noFigureWords);
    expect(within(widget).queryByRole("link")).toBeNull();
    expect(meter(versusWords).textContent).toBe(noFigureWords);
  });

  it("isn't there in total points, where there is no opponent", async () => {
    openTacticsTab({ tactics: SAVED, leagueTable: leagueTableOf(TEAMS, { scores, format: "totalPoints" }) });
    await screen.findByRole("heading", { level: 1, name: ME });
    expect(screen.queryByRole("region", { name: opponentTitle(TACTICS_GAMEWEEK) })).toBeNull();
  });
});
