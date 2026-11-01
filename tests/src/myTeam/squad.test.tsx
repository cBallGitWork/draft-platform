// My team's Squad tab (#364; spec/12, My team's tabs; its approved picture,
// docs/design/approved/team-squad): reached from My team's tabs; every player in the squad in one
// table with his number, positions, name and club, points and season stats and his club's next
// three matches, by position group with the eleven first; the short codes named in full on hover;
// why it's empty; and his squad number, changed in his season panel (#13). The panel, Your eleven,
// Mail and the views: squadWidgets.test.tsx.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MY_TEAM_PATH, MY_TEAM_SQUAD_PATH } from "../../../src/frame/menu";
import { sectionTabsLabel } from "../../../src/frame/words";
import { meterListLabel } from "../../../src/myTeam/header/words";
import {
  awayWords,
  difficultyNotRatedWords,
  goneWords,
  homeWords,
  lastGameweekLong,
  nextFixtureLong,
  noFigureWords,
  noStatsWords,
  numberLabel,
  noSquadWords,
  noTeamWords,
  openPanelLabel,
  squadColumns,
  squadLoadingWords,
  squadTableLabel,
  SQUAD_TITLE,
  statusNotSettledLabel,
  whenWords,
} from "../../../src/myTeam/squad/words";
import { unheldNoticeWords, unheldPlayerWords } from "../../../src/shared/words";
import { UNHELD } from "../../support/convex/footballRows.harness";
import { columnHeadIn, expectColumnHeads } from "../../support/src/columnHeads";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";
import { cells, KICKOFF, openSquad, PALMER, RAYA, rows, SAKA, squadOf, tacticsWith } from "../../support/src/squadTab.harness";

/** The long words of a match cell: the match, then that its difficulty isn't rated yet. */
const matchLong = (opponent: string, home: boolean) => `${nextFixtureLong(opponent, home, whenWords(KICKOFF))}, ${difficultyNotRatedWords}`;

describe("reaching it", () => {
  it("a manager opens it from My team's Squad tab, for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(within(await screen.findByRole("navigation", { name: sectionTabsLabel })).getByRole("link", { name: SQUAD_TITLE }));

    // Under My team's header band, whose plate names the team.
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
    expect(screen.getByRole("group", { name: meterListLabel })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_SQUAD_PATH);
    expect(app.myTeam.useTeamSquad).toHaveBeenCalledWith(league.leagueId);
  });

  it("says so while it loads", async () => {
    openSquad({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(squadLoadingWords);
  });

  it("tells someone running no team in the league there's nothing to show, and reads nothing", async () => {
    const app = openSquad({}, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
    expect(app.myTeam.useTeamSquad).not.toHaveBeenCalled();
  });

  it("says when the squad is empty", async () => {
    openSquad();
    expect(await screen.findByText(noSquadWords)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("the rows", () => {
  it("run No, Pos, Player, Pts, Last, the season's stats, then Next 3 at the far right", async () => {
    openSquad({ squad: squadOf([SAKA]) });
    const { number, positions, player, season, last, appearances, minutes, goals, assists, cleanSheets, saves, yellowCards, redCards, next } = squadColumns;
    const lastNamed = { ...last, long: lastGameweekLong(9) };
    const stats = [appearances, minutes, goals, assists, cleanSheets, saves, yellowCards, redCards];
    expectColumnHeads(await screen.findByRole("table"), [number, positions, player, season, lastNamed, ...stats, next]);
  });

  it("hold his number, every position he holds, his name and club, his points, his season's stats and his club's next matches", async () => {
    // With no lineup left to set, nobody is on the bench.
    openSquad({ squad: squadOf([SAKA, PALMER]), tactics: { kind: "seasonOver" } });
    await screen.findByRole("table");

    expect(rows().map(cells)).toEqual([
      ["", "CAM", "Palmer CHE", noFigureWords, noFigureWords, "8", "590", "3", "4", "3", "", "1", "0", `ARS ${awayWords}`],
      ["7", "W CAM", "Saka ARS", "42", "7", "8", "590", "3", "4", "3", "", "1", "0", `CHE ${homeWords}`],
    ]);
  });

  it("show saves for a keeper only", async () => {
    openSquad({ squad: squadOf([RAYA, SAKA]) });
    await screen.findByRole("table");
    const savesAt = 10;
    expect(rows().map((row) => cells(row)[savesAt])).toEqual(["24", ""]);
  });

  it("show a placeholder in each stat's place while no season's stats are held, never a made-up figure", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, stats: null }]) });
    await screen.findByRole("table");
    // Saves stay empty for an outfield player; the other seven wait for their data.
    expect(within(rows()[0]).getAllByRole("img", { name: noStatsWords })).toHaveLength(7);
  });

  it("go by position group, his main position's, the eleven first in each, then by squad number", async () => {
    const BENCHED_W = { ...SAKA, code: 1004, name: "Benched", number: 3 };
    const UNNUMBERED_W = { ...SAKA, code: 1005, name: "Unnumbered", number: null };
    const players = [SAKA, BENCHED_W, UNNUMBERED_W, PALMER, RAYA];
    openSquad({ squad: squadOf(players), tactics: tacticsWith(players, [[SAKA, { area: "attackingMidfield", lane: "right" }]]) });
    await screen.findByRole("table");
    expect(rows().map((row) => row.cells[2].querySelector("button")!.firstChild!.textContent)).toEqual(["Raya", "Palmer", "Saka", "Benched", "Unnumbered"]);
  });

  it("mute the bench's names, and say on the bench to screen readers, with no group rows", async () => {
    const players = [SAKA, PALMER];
    openSquad({ squad: squadOf(players), tactics: tacticsWith(players, [[SAKA, { area: "attackingMidfield", lane: "right" }]]) });
    await screen.findByRole("table");
    const saka = screen.getByRole("button", { name: openPanelLabel("Saka") });
    const palmer = screen.getByRole("button", { name: openPanelLabel("Palmer") });
    expect(saka.className).toContain("text-fact");
    expect(palmer.className).toContain("text-muted");
    expect(palmer.textContent).toContain("on the bench");
    expect(rows()).toHaveLength(2);
  });

  it("show points below 0 with the true minus, never a hyphen (#564)", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, lastGameweekPoints: -2, seasonPoints: -0.5 }]) });
    await screen.findByRole("table");

    expect(cells(rows()[0]).slice(3, 5)).toEqual(["−0.5", "−2"]);
  });

  it("name the short codes in full on hover: positions, club, the next match and the gameweek of Last", async () => {
    openSquad({ squad: squadOf([SAKA]) });
    await screen.findByRole("table");
    const [row] = rows();

    expect(within(row).getByTitle("Winger").textContent).toBe("W");
    expect(within(row).getByTitle("Arsenal").textContent).toBe("ARS");
    expect(within(row).getByTitle(matchLong("Chelsea", true))).toBeTruthy();
    const last = { short: squadColumns.last.short, long: lastGameweekLong(9) };
    expect(columnHeadIn(screen.getByRole("table"), last).getAttribute("title")).toBe(last.long);
  });

  it("name the next match by the short words it shows, then the long ones, so voice control can say what it sees (#790)", async () => {
    openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    const [palmer, saka] = rows();

    expect(within(saka).getByLabelText(`CHE ${homeWords}, ${matchLong("Chelsea", true)}`).textContent).toBe(`CHE ${homeWords}`);
    expect(within(palmer).getByLabelText(`ARS ${awayWords}, ${matchLong("Arsenal", false)}`).textContent).toBe(`ARS ${awayWords}`);
  });

  it("show each of his club's next three matches in its own cell, outlined until fixture difficulty is held", async () => {
    const later = [1, 2].map((week) => ({ ...SAKA.nextFixtures[0], kickoff: KICKOFF + week, home: false }));
    openSquad({ squad: squadOf([{ ...SAKA, nextFixtures: [...SAKA.nextFixtures, ...later] }]) });
    await screen.findByRole("table");
    const matches = within(rows()[0]).getAllByTitle(new RegExp(difficultyNotRatedWords));
    expect(matches.map((match) => match.textContent)).toEqual([`CHE ${homeWords}`, `CHE ${awayWords}`, `CHE ${awayWords}`]);
    expect(matches.every((match) => match.className.includes("border-muted"))).toBe(true);
  });

  it("mark a player FPL holds a doubt about with the status chip's placeholder, and nobody else", async () => {
    openSquad({ squad: squadOf([SAKA, { ...PALMER, news: "Knock - 75% chance of playing", chanceOfPlaying: 75 }]) });
    await screen.findByRole("table");
    const [palmer, saka] = rows();
    expect(within(palmer).getByRole("img", { name: statusNotSettledLabel })).toBeTruthy();
    expect(within(saka).queryByRole("img", { name: statusNotSettledLabel })).toBeNull();
  });

  it("keep one whose player the football sync doesn't hold, saying his code after the rest, under a notice (#323)", async () => {
    openSquad({ squad: squadOf([SAKA], 9, [UNHELD]) });
    expect(await screen.findByText(unheldNoticeWords)).toBeTruthy();
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining("Saka"), unheldPlayerWords(UNHELD)]);
  });

  it("show no notice of missing football data while every player is held", async () => {
    openSquad({ squad: squadOf([SAKA]) });
    await screen.findByRole("table", { name: squadTableLabel("Team 1") });
    expect(screen.queryByText(unheldNoticeWords)).toBeNull();
  });

  it("say when a player has left the Premier League, and when his club has no next match", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, gone: true, nextFixtures: [] }]) });
    expect(await screen.findByText(goneWords)).toBeTruthy();
    expect(cells(rows()[0]).at(-1)).toBe(noFigureWords);
  });
});

describe("squad numbers (#13)", () => {
  const box = (name: string) => screen.getByRole<HTMLInputElement>("combobox", { name: numberLabel(name) });
  /** Opens his season panel, where his number is changed. */
  const openPanel = (name: string) => userEvent.click(screen.getByRole("button", { name: openPanelLabel(name) }));
  const retype = async (name: string, typed: string) => {
    await userEvent.clear(box(name));
    if (typed !== "") await userEvent.type(box(name), typed);
  };

  it("each box holds the number his manager gave him, empty while he has none", async () => {
    openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    await openPanel("Saka");
    expect(box("Saka").value).toBe("7");
    await openPanel("Palmer");
    expect(box("Palmer").value).toBe("");
  });

  it("a number changed elsewhere shows in his box at once", async () => {
    const app = openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    await openPanel("Saka");
    act(() => app.myTeam.serverHoldsSquad(squadOf([{ ...SAKA, number: 9 }, { ...PALMER, number: 4 }])));
    expect(box("Saka").value).toBe("9");
    expect(cells(rows()[1])[0]).toBe("9");
  });

  it("a number typed is sent when the box is left, or Enter is pressed", async () => {
    const app = openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    await openPanel("Palmer");
    await retype("Palmer", "10");
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenLastCalledWith(league.leagueId, PALMER.code, 10);
    await openPanel("Saka");
    await retype("Saka", "11{Enter}");
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenLastCalledWith(league.leagueId, SAKA.code, 11);
  });

  it("an emptied box takes his number away, and one left as it was sends nothing", async () => {
    const app = openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    await openPanel("Palmer");
    await userEvent.click(box("Palmer"));
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).not.toHaveBeenCalled();
    await openPanel("Saka");
    await retype("Saka", "");
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenCalledWith(league.leagueId, SAKA.code, null);
    // Made, it stays empty, though the squad read here still holds his old 7.
    expect(box("Saka").value).toBe("");
  });

  it("a number made shows as it was taken: 07 as 7", async () => {
    openSquad({ squad: squadOf([PALMER]) });
    await screen.findByRole("table");
    await openPanel("Palmer");
    await retype("Palmer", "07");
    await userEvent.tab();
    expect(box("Palmer").value).toBe("7");
  });

  it("a number refused says why, in the server's words, and the box goes back to the one held", async () => {
    const refusal = "A squad number is a whole number from 1 to 99.";
    const app = openSquad({ squad: squadOf([SAKA]), numberAnswer: refusal });
    await screen.findByRole("table");
    await openPanel("Saka");
    await retype("Saka", "100");
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenCalledWith(league.leagueId, SAKA.code, 100);
    expect(await screen.findByText(refusal)).toBeTruthy();
    expect(box("Saka").value).toBe("7");
  });

  it("the box offers every number a manager can give, 1 to 99", async () => {
    openSquad({ squad: squadOf([SAKA]) });
    await screen.findByRole("table");
    await openPanel("Saka");
    const list = document.getElementById(box("Saka").getAttribute("list")!)!;
    const offered = Array.from(list.querySelectorAll("option"), (option) => Number(option.value));
    expect([offered[0], offered.at(-1), offered.length]).toEqual([1, 99, 99]);
  });
});
