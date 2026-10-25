// Scouting's players list (#373, spec/19 The players list): reached from the menu's Scouting, in
// place of Players, by anyone in the league; every player with his club, positions and owner; the
// filters and the sort ask the server; season points and role fit read "—" until they exist.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { MY_TEAM_PATH, SCOUTING_PATH } from "../../../src/frame/menu";
import {
  availabilityWords,
  columns,
  countWords,
  freeAgentWords,
  loadingWords,
  noFigureWords,
  noneMatchWords,
  noWaiversWords,
  SCOUTING_TITLE,
  sortByLabel,
} from "../../../src/scouting/words";
import { POSITION_NAMES } from "../../../src/words";
import type { ScoutingData } from "../../support/src/scouting.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
const player = (code: number, name: string, club: ListedPlayer["club"], positions: ListedPlayer["positions"], ownerTeamName: string | null): ListedPlayer => ({
  code,
  name,
  fullName: `${name} in full`,
  club,
  positions,
  ownerTeamName,
  seasonPoints: null,
});
const SAKA = player(1, "Saka", ARSENAL, ["W"], "Saka Potatoes");
const RICE = player(2, "Rice", ARSENAL, ["CDM", "CM"], null);
const PALMER = player(3, "Palmer", CHELSEA, ["CAM"], "Kroos Control");
const HELD: ScoutingData = { clubs: [ARSENAL, CHELSEA], players: [SAKA, RICE, PALMER] };

const openScouting = (scouting: ScoutingData = HELD) => openApp(SCOUTING_PATH, manager, { scouting });
const table = () => screen.getByRole("table");
const namesShown = () =>
  within(table())
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
const rowOf = (name: string) => within(table()).getByRole("rowheader", { name }).closest("tr")!;
const lastAsk = (app: ReturnType<typeof openScouting>) => app.scouting.usePlayersList.mock.lastCall!;

describe("reaching it", () => {
  it.each([
    ["a manager", manager],
    ["a commissioner running no team", commissioner],
  ])("%s opens it from the menu's Scouting, for the league the app is in", async (_, session) => {
    const app = openApp(MY_TEAM_PATH, session, { scouting: HELD });
    await userEvent.click(await screen.findByRole("link", { name: "Scouting" }));

    expect(await screen.findByRole("heading", { level: 1, name: SCOUTING_TITLE })).toBeTruthy();
    expect(app.path()).toBe(SCOUTING_PATH);
    expect(lastAsk(app)[0]).toBe(league.leagueId);
  });

  it("the menu has no Players any more", async () => {
    openApp(MY_TEAM_PATH, manager);
    const main = await screen.findByRole("navigation", { name: "Main" });
    expect(within(main).queryByRole("link", { name: "Players" })).toBeNull();
  });

  it("says so while the players load", async () => {
    openScouting({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });
});

describe("the list", () => {
  it("opens on every player, the most season points first, and says how many", async () => {
    const app = openScouting();
    await screen.findByRole("table");
    expect(lastAsk(app).slice(1)).toEqual([{ availability: "all", position: null, clubCode: null }, { by: "seasonPoints", descending: true }]);
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(screen.getByText(countWords(3))).toBeTruthy();
  });

  it("gives each player his club and positions as short codes, the full names on hover", async () => {
    openScouting();
    await screen.findByRole("table");
    const rice = within(rowOf("Rice"));
    expect(rice.getByText("ARS").getAttribute("title")).toBe("Arsenal");
    expect(rice.getByText("CDM").getAttribute("title")).toBe(POSITION_NAMES.CDM);
    expect(rice.getByText("CM").getAttribute("title")).toBe(POSITION_NAMES.CM);
    expect(within(table()).getByRole("rowheader", { name: "Rice" }).getAttribute("title")).toBe("Rice in full");
  });

  it("says who owns each player in this league, or that he is a free agent", async () => {
    openScouting();
    await screen.findByRole("table");
    expect(rowOf("Saka").textContent).toContain("Saka Potatoes");
    expect(rowOf("Rice").textContent).toContain(freeAgentWords);
  });

  it("reads '—' for season points until matches are scored, and for role fit until roles exist", async () => {
    openScouting();
    await screen.findByRole("table");
    const cells = within(rowOf("Saka")).getAllByRole("cell");
    expect(cells.slice(-2).map((cell) => cell.textContent)).toEqual([noFigureWords, noFigureWords]);
  });

  it("heads each column with a short code, the full name on hover", async () => {
    openScouting();
    await screen.findByRole("table");
    const heads = within(table()).getAllByRole("columnheader");
    expect(heads.map((head) => head.getAttribute("title"))).toEqual(Object.values(columns).map((column) => column.long));
  });
});

describe("the filters ask the server", () => {
  it.each([
    ["freeAgents", ["Rice"]],
    ["owned", ["Palmer", "Saka"]],
  ] as const)("by who holds him: %s", async (availability, names) => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("radio", { name: availabilityWords[availability] }));
    expect(lastAsk(app)[1].availability).toBe(availability);
    expect(namesShown()).toEqual(names);
  });

  it("on waivers keeps nobody, and says the app doesn't run waivers yet", async () => {
    openScouting();
    await userEvent.click(await screen.findByRole("radio", { name: availabilityWords.onWaivers }));
    expect(screen.getByText(noWaiversWords)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("by position", async () => {
    const app = openScouting();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Position" }), POSITION_NAMES.CAM);
    expect(lastAsk(app)[1].position).toBe("CAM");
    expect(namesShown()).toEqual(["Palmer"]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Position" }), "Every position");
    expect(lastAsk(app)[1].position).toBeNull();
  });

  it("by club, from the clubs the server holds", async () => {
    const app = openScouting();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Club" }), "Arsenal");
    expect(lastAsk(app)[1].clubCode).toBe(ARSENAL.code);
    expect(namesShown()).toEqual(["Rice", "Saka"]);
  });

  it("says so when none match", async () => {
    openScouting();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Position" }), POSITION_NAMES.GK);
    expect(screen.getByText(noneMatchWords)).toBeTruthy();
  });
});

describe("the sort asks the server", () => {
  it("a column's head sorts by it, and again the other way", async () => {
    const app = openScouting();
    const byName = await screen.findByRole("button", { name: sortByLabel(columns.name.long) });
    await userEvent.click(byName);
    expect(lastAsk(app)[2]).toEqual({ by: "name", descending: false });
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(byName.closest("th")!.getAttribute("aria-sort")).toBe("ascending");

    await userEvent.click(byName);
    expect(lastAsk(app)[2]).toEqual({ by: "name", descending: true });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
    expect(byName.closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("by club, A to Z first", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.club.long) }));
    expect(lastAsk(app)[2]).toEqual({ by: "club", descending: false });
    expect(namesShown()).toEqual(["Rice", "Saka", "Palmer"]);
  });

  it("by season points, the most first, after another column", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.name.long) }));
    await userEvent.click(screen.getByRole("button", { name: sortByLabel(columns.seasonPoints.long) }));
    expect(lastAsk(app)[2]).toEqual({ by: "seasonPoints", descending: true });
  });
});
