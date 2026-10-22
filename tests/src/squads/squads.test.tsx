// A league's squads (#31; spec/15 Assigning players): reached from "Your leagues" by whoever runs
// the league; find a player and put him on a team, move or release him; each team's squad and the
// league's squad limits it breaks.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { adminSeeing, commissioner, league, managerIn, openApp } from "../../support/src/shell.harness";
import { squadsPath } from "../../../src/squads/paths";
import type { SquadsData } from "../../support/src/squads.harness";
import { teamSquad } from "../../support/src/squads.harness";
import {
  assignLabel,
  findLabel,
  findTitle,
  foundListLabel,
  goneWords,
  loadingWords,
  moveLabel,
  noneFoundWords,
  releaseLabel,
  searchingWords,
  SQUADS_TITLE,
  teamChoiceLabel,
} from "../../../src/squads/words";

const PAGE = squadsPath(league.leagueId);
const saka = { code: 1001, name: "Saka", clubShortName: "ARS", gone: false };
const TWO_TEAMS: SquadsData = {
  squads: [teamSquad("team-1", "Team 1", [saka]), teamSquad("team-2", "Team 2", [], [{ kind: "underMinimum", players: 0, minimum: 11 }])],
  found: [
    { code: 1001, name: "Saka", fullName: "Bukayo Saka", teamName: "Team 1" },
    { code: 2002, name: "Isak", fullName: "Alexander Isak", teamName: null },
  ],
};
const openSquads = (data: SquadsData = TWO_TEAMS) => openApp(PAGE, commissioner, { squads: data });
const search = async (text: string) => userEvent.type(await screen.findByRole("searchbox", { name: findLabel }), text);
const foundRow = (name: string) => within(screen.getByRole("list", { name: foundListLabel })).getByText(name).closest("li")!;

describe("reaching the squads", () => {
  it.each([
    ["the commissioner", commissioner],
    ["the co-commissioner", managerIn({ ...league, roles: ["co-commissioner"] })],
    ["the admin, with no part in the league", adminSeeing({ ...league, roles: [], teamName: null })],
  ])("%s opens them from the league's row on Your leagues", async (_, session) => {
    const app = openApp(LEAGUES_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: SQUADS_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: SQUADS_TITLE })).toBeTruthy();
    expect(app.path()).toBe(PAGE);
    expect(app.squads.useSquads).toHaveBeenCalledWith(league.leagueId);
  });

  it("a manager isn't offered them, and is sent back to Your leagues if they go there", async () => {
    openApp(LEAGUES_PATH, managerIn(league));
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(screen.queryByRole("link", { name: SQUADS_TITLE })).toBeNull();

    cleanup();
    const app = openApp(PAGE, managerIn(league));
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("each team's squad", () => {
  it("lists its players, says one who has left is not available, and warns of a limit it breaks", async () => {
    openSquads({ squads: [teamSquad("team-1", "Team 1", [saka, { code: 5, name: "Gone", clubShortName: "BRE", gone: true }]), ...TWO_TEAMS.squads!.slice(1)] });

    const team1 = await screen.findByRole("region", { name: "Team 1" });
    expect(within(team1).getByText("2 players")).toBeTruthy();
    expect(within(team1).getByText(goneWords)).toBeTruthy();
    const team2 = screen.getByRole("region", { name: "Team 2" });
    expect(within(team2).getByRole("status").textContent).toBe("0 players, under the league's least of 11.");
  });

  it("releases a player", async () => {
    const app = openSquads();
    await userEvent.click(await screen.findByRole("button", { name: releaseLabel("Saka") }));
    expect(app.squads.release).toHaveBeenCalledExactlyOnceWith(league.leagueId, saka.code);
  });
});

describe("finding a player", () => {
  it("puts a free agent on the team chosen", async () => {
    const app = openSquads();
    await search("Isak");
    const isak = foundRow("Alexander Isak");
    await userEvent.selectOptions(within(isak).getByRole("combobox", { name: teamChoiceLabel("Isak") }), "Team 2");
    await userEvent.click(within(isak).getByRole("button", { name: assignLabel("Isak") }));

    expect(app.squads.assign).toHaveBeenCalledExactlyOnceWith(league.leagueId, 2002, "team-2");
  });

  it("moves a player on a team to another, never offering the one he's on", async () => {
    const app = openSquads();
    await search("Saka");
    const sakaRow = foundRow("Bukayo Saka");
    const choices = within(sakaRow).getAllByRole("option").map((option) => option.textContent);
    expect(choices).toEqual(["Team 2"]);
    await userEvent.click(within(sakaRow).getByRole("button", { name: moveLabel("Saka") }));

    expect(app.squads.move).toHaveBeenCalledExactlyOnceWith(league.leagueId, 1001, "team-2");
  });

  it("offers a free agent every team", async () => {
    openSquads();
    await search("Isak");
    expect(within(foundRow("Alexander Isak")).getAllByRole("option").map((option) => option.textContent)).toEqual(["Team 1", "Team 2"]);
  });

  it("says so when nobody matches", async () => {
    openSquads({ ...TWO_TEAMS, found: [] });
    await search("Nobody");
    expect(await screen.findByText(noneFoundWords)).toBeTruthy();
  });

  it("shows why a change was refused", async () => {
    const app = openSquads();
    app.squads.assign.mockResolvedValueOnce("Isak is already on Team 1. Move him instead.");
    await search("Isak");
    await userEvent.click(within(foundRow("Alexander Isak")).getByRole("button", { name: assignLabel("Isak") }));

    expect((await screen.findByRole("alert")).textContent).toBe("Isak is already on Team 1. Move him instead.");
  });
});

describe("while the server answers", () => {
  it("says the squads are loading, to screen readers too", async () => {
    openSquads({ loading: true });
    await screen.findByRole("heading", { level: 1, name: SQUADS_TITLE });
    expect(screen.getByRole("status").textContent).toBe(loadingWords);
  });

  it("says a search is under way, to screen readers too", async () => {
    openSquads({ ...TWO_TEAMS, searching: true });
    await search("Isak");
    expect(within(screen.getByRole("region", { name: findTitle })).getByRole("status").textContent).toBe(searchingWords);
  });
});
