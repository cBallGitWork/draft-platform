// Another team's squad, read-only (#1027; Craig, 9 Nov 2026: "a read-only page of that team, its
// Squad table (players, positions, club, season points), with nothing changeable and no tactics
// shown"), opened from its name as a player's owner on his card.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { otherTeamPath } from "../../../src/myTeam/paths";
import type { OtherSquad } from "../../../src/myTeam/seam";
import { goneWords, otherSquadEmptyWords, otherSquadLoadingWords, squadTableLabel } from "../../../src/myTeam/squad/words";
import { playerCardPath } from "../../../src/playerCard/paths";
import { ARSENAL, CHELSEA } from "../../support/convex/footballRows.harness";
import { HELD, RICE, SAKA, SAKA_POTATOES } from "../../support/src/playerCardScreen.harness";
import type { MyTeamData } from "../../support/src/myTeam.harness";
import { league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";

const POTATOES: OtherSquad = {
  teamName: "Saka Potatoes",
  players: [
    { code: 2001, name: "Palmer", fullName: "Cole Palmer", positions: ["CAM", "W"], club: CHELSEA, gone: false, seasonPoints: 41.5 },
    { code: SAKA.code, name: "Saka", fullName: "Bukayo Saka", positions: ["W"], club: ARSENAL, gone: true, seasonPoints: null },
  ],
};

const openTeam = (myTeam: MyTeamData = { otherSquad: POTATOES }) => openApp(otherTeamPath(league.leagueId, SAKA_POTATOES), manager, { myTeam, playerCard: HELD });
const table = async () => within(await screen.findByRole("table", { name: squadTableLabel(POTATOES.teamName) }));

describe("from the card", () => {
  it("the owner's name opens his team's squad", async () => {
    const app = openApp(playerCardPath(league.leagueId, SAKA.code), manager, { myTeam: { otherSquad: POTATOES }, playerCard: HELD });
    await userEvent.click(await screen.findByRole("link", { name: "Saka Potatoes" }));

    expect(await screen.findByRole("heading", { level: 1, name: POTATOES.teamName })).toBeTruthy();
    expect(app.path()).toBe(otherTeamPath(league.leagueId, SAKA_POTATOES));
    expect(app.myTeam.useOtherSquad.mock.lastCall).toEqual([league.leagueId, SAKA_POTATOES]);
  });

  it("a free agent's says so, and opens nothing", async () => {
    openApp(playerCardPath(league.leagueId, RICE.code), manager, { playerCard: HELD });
    const head = within(await screen.findByRole("region", { name: RICE.fullName }));
    expect(head.getByText("Free agent").closest("a")).toBeNull();
  });
});

describe("the page", () => {
  it("lists each player with his positions, club and season points, and nothing to change", async () => {
    openTeam();
    const rows = (await table()).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["CAM W", "41.5"],
      ["W", "—"],
    ]);
    expect(within(rows[0]).getByRole("rowheader").textContent).toContain("CHE");
    expect(within(rows[1]).getByRole("rowheader").textContent).toContain(goneWords);
    const page = within(screen.getByRole("main"));
    expect(page.queryByRole("button")).toBeNull();
    expect(page.queryByRole("combobox")).toBeNull();
  });

  it("a player's name opens his card", async () => {
    const app = openTeam();
    await userEvent.click(await screen.findByRole("link", { name: "Palmer" }));
    expect(app.path()).toBe(playerCardPath(league.leagueId, 2001));
  });

  it("says so while the squad loads", async () => {
    openTeam({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(otherSquadLoadingWords);
  });

  it("says so when the squad is empty", async () => {
    openTeam({ otherSquad: { teamName: "Team 2", players: [] } });
    expect(await screen.findByText(otherSquadEmptyWords)).toBeTruthy();
  });

  it("someone not in the league is sent to their leagues", async () => {
    const app = openApp(otherTeamPath(league.leagueId, SAKA_POTATOES), managerIn(miniBeta), { myTeam: { otherSquad: POTATOES } });
    await screen.findByRole("heading", { level: 1 });
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});
