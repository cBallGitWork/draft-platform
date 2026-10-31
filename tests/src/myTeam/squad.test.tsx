// My team's Squad tab (#364; spec/12, My team's tabs): reached from My team's tabs; every player
// in the squad in one table with his positions, club, his club's next match and his points, in the
// server's order; the short codes named in full on hover; and why it's empty.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MY_TEAM_PATH, MY_TEAM_SQUAD_PATH } from "../../../src/frame/menu";
import { sectionTabsLabel } from "../../../src/frame/words";
import type { TeamSquad } from "../../../src/myTeam/seam";
import {
  awayWords,
  goneWords,
  homeWords,
  lastGameweekLong,
  nextFixtureLong,
  noFigureWords,
  numberLabel,
  noSquadWords,
  noTeamWords,
  squadColumns,
  squadLoadingWords,
  squadTableLabel,
  SQUAD_TITLE,
  whenWords,
} from "../../../src/myTeam/words";
import { playerCardPath } from "../../../src/playerCard/paths";
import { ARSENAL, CHELSEA } from "../../support/convex/footballRows.harness";
import { columnHeadIn } from "../../support/src/columnHeads";
import type { MyTeamData } from "../../support/src/myTeam.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

type Row = TeamSquad["players"][number];

const openSquad = (myTeam: MyTeamData = {}, session = manager) => openApp(MY_TEAM_SQUAD_PATH, session, { myTeam });
const rows = () =>
  within(screen.getByRole("table", { name: squadTableLabel("Team 1") }))
    .getAllByRole<HTMLTableRowElement>("row")
    .slice(1);
const cells = (row: HTMLTableRowElement) => Array.from(row.cells, (cell) => cell.textContent);

const KICKOFF = Date.parse("2026-10-31T15:00:00Z");
const SAKA: Row = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  positions: ["W", "CAM"],
  club: ARSENAL,
  gone: false,
  number: 7,
  nextFixture: { gameweek: 10, kickoff: KICKOFF, opponent: CHELSEA, home: true },
  seasonPoints: 42,
  lastGameweekPoints: 7,
};
const PALMER: Row = { ...SAKA, code: 1002, name: "Palmer", fullName: "Cole Palmer", number: null, positions: ["CAM"], club: CHELSEA, nextFixture: { ...SAKA.nextFixture!, opponent: ARSENAL, home: false }, seasonPoints: null, lastGameweekPoints: null };
const squadOf = (players: Row[], lastGameweek: number | null = 9): TeamSquad => ({ teamName: "Team 1", lastGameweek, players });

describe("reaching it", () => {
  it("a manager opens it from My team's Squad tab, for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(within(await screen.findByRole("navigation", { name: sectionTabsLabel })).getByRole("link", { name: SQUAD_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: SQUAD_TITLE })).toBeTruthy();
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
  it("list each player in the server's order: his number's box, positions, name, club, next match, last gameweek's and the season's points", async () => {
    openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");

    expect(rows().map(cells)).toEqual([
      ["", "W, CAM", "Saka", "ARS", `CHE ${homeWords}`, "7", "42"],
      ["", "CAM", "Palmer", "CHE", `ARS ${awayWords}`, noFigureWords, noFigureWords],
    ]);
  });

  it("show points below 0 with the true minus, never a hyphen (#564)", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, lastGameweekPoints: -2, seasonPoints: -0.5 }]) });
    await screen.findByRole("table");

    expect(cells(rows()[0]).slice(-2)).toEqual(["−2", "−0.5"]);
  });

  it("name the short codes in full on hover: positions, club, the next match and the gameweek of Last", async () => {
    openSquad({ squad: squadOf([SAKA]) });
    await screen.findByRole("table");
    const [row] = rows();

    expect(within(row).getByTitle("Winger").textContent).toBe("W");
    expect(within(row).getByTitle("Arsenal").textContent).toBe("ARS");
    expect(within(row).getByTitle(nextFixtureLong("Chelsea", true, whenWords(KICKOFF)))).toBeTruthy();
    const last = { short: squadColumns.last.short, long: lastGameweekLong(9) };
    expect(columnHeadIn(screen.getByRole("table"), last).getAttribute("title")).toBe(last.long);
  });

  it("open a player's card from his name", async () => {
    const app = openSquad({ squad: squadOf([SAKA]) });
    await userEvent.click(await screen.findByRole("link", { name: "Saka" }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, SAKA.code));
  });

  it("say when a player has left the Premier League, and when his club has no next match", async () => {
    openSquad({ squad: squadOf([{ ...SAKA, gone: true, nextFixture: null }]) });
    expect(await screen.findByText(goneWords)).toBeTruthy();
    expect(cells(rows()[0])[4]).toBe(noFigureWords);
  });
});

describe("squad numbers (#13)", () => {
  const box = (name: string) => screen.getByRole<HTMLInputElement>("textbox", { name: numberLabel(name) });
  const retype = async (name: string, typed: string) => {
    await userEvent.clear(box(name));
    if (typed !== "") await userEvent.type(box(name), typed);
  };

  it("each box holds the number his manager gave him, empty while he has none", async () => {
    openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    expect(box("Saka").value).toBe("7");
    expect(box("Palmer").value).toBe("");
  });

  it("a number changed elsewhere shows in his box at once", async () => {
    const app = openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    act(() => app.myTeam.serverHoldsSquad(squadOf([{ ...SAKA, number: 9 }, { ...PALMER, number: 4 }])));
    expect(box("Saka").value).toBe("9");
    expect(box("Palmer").value).toBe("4");
  });

  it("a number typed is sent when the box is left, or Enter is pressed", async () => {
    const app = openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    await retype("Palmer", "10");
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenLastCalledWith(league.leagueId, PALMER.code, 10);
    await retype("Saka", "11{Enter}");
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenLastCalledWith(league.leagueId, SAKA.code, 11);
  });

  it("an emptied box takes his number away, and one left as it was sends nothing", async () => {
    const app = openSquad({ squad: squadOf([SAKA, PALMER]) });
    await screen.findByRole("table");
    await userEvent.click(box("Palmer"));
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).not.toHaveBeenCalled();
    await retype("Saka", "");
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenCalledWith(league.leagueId, SAKA.code, null);
    // Made, it stays empty, though the squad read here still holds his old 7.
    expect(box("Saka").value).toBe("");
  });

  it("a number made shows as it was taken: 07 as 7", async () => {
    openSquad({ squad: squadOf([PALMER]) });
    await screen.findByRole("table");
    await retype("Palmer", "07");
    await userEvent.tab();
    expect(box("Palmer").value).toBe("7");
  });

  it("a number refused says why, in the server's words, and the box goes back to the one held", async () => {
    const refusal = "A squad number is a whole number from 1 to 99.";
    const app = openSquad({ squad: squadOf([SAKA]), numberAnswer: refusal });
    await screen.findByRole("table");
    await retype("Saka", "100");
    await userEvent.tab();
    expect(app.myTeam.useSquadNumbers().set).toHaveBeenCalledWith(league.leagueId, SAKA.code, 100);
    expect(await screen.findByText(refusal)).toBeTruthy();
    expect(box("Saka").value).toBe("7");
  });
});
