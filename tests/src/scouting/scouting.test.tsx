// Scouting's players list (#373, spec/19 The players list): reached from the menu's Scouting, in
// place of Players, by anyone in the league; every player with his club, positions and owner; the
// filters and the sort ask the server; season points and role fit read "—" until they exist.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogue";
import { MY_TEAM_PATH, SCOUTING_PATH } from "../../../src/frame/menu";
import {
  availabilityWords,
  clubLabel,
  columns,
  countWords,
  everyClubWords,
  everyPositionWords,
  freeAgentWords,
  loadingWords,
  noFigureWords,
  noneMatchWords,
  noWaiversWords,
  positionLabel,
  SCOUTING_TITLE,
  noStatWords,
  sortByLabel,
  statLabel,
} from "../../../src/scouting/words";
import { POSITION_NAMES } from "../../../src/words";
import type { ScoutingData } from "../../support/src/scouting.harness";
import { commissioner, league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";

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
  stat: null,
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
  it("opens on every player by name, as none has season points yet, and says how many", async () => {
    const app = openScouting();
    await screen.findByRole("table");
    expect(lastAsk(app).slice(1)).toEqual([{ availability: "all", position: null, clubCode: null }, { by: "name", descending: false }, null]);
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
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: positionLabel }), POSITION_NAMES.CAM);
    expect(lastAsk(app)[1].position).toBe("CAM");
    expect(namesShown()).toEqual(["Palmer"]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: positionLabel }), everyPositionWords);
    expect(lastAsk(app)[1].position).toBeNull();
  });

  it("by club, from the clubs the server holds", async () => {
    const app = openScouting();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: clubLabel }), "Arsenal");
    expect(lastAsk(app)[1].clubCode).toBe(ARSENAL.code);
    expect(namesShown()).toEqual(["Rice", "Saka"]);
  });

  it("while the next list loads, the last stays up and the club filter keeps its clubs and choice", async () => {
    const app = openScouting();
    const held = app.scouting.usePlayersList.getMockImplementation()!;
    app.scouting.usePlayersList.mockImplementation((leagueId, filters, sort, stat) =>
      filters.clubCode === null ? held(leagueId, filters, sort, stat) : undefined,
    );
    const club = await screen.findByRole("combobox", { name: clubLabel });
    await userEvent.selectOptions(club, "Arsenal");

    expect((club as HTMLSelectElement).value).toBe(String(ARSENAL.code));
    expect(within(club).getAllByRole("option").map((option) => option.textContent)).toEqual([everyClubWords, "Arsenal", "Chelsea"]);
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(screen.queryByText(loadingWords)).toBeNull();
  });

  it("a league switch drops the last league's list rather than keeping it up while the next loads", async () => {
    const app = openScouting();
    await screen.findByRole("table");
    app.scouting.usePlayersList.mockImplementation(() => undefined);
    app.becomes(managerIn(miniBeta, league));

    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says so when none match", async () => {
    openScouting();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: positionLabel }), POSITION_NAMES.GK);
    expect(screen.getByText(noneMatchWords)).toBeTruthy();
  });
});

describe("the sort asks the server", () => {
  it("a column's head sorts by it, and again the other way", async () => {
    const app = openScouting();
    const byClub = await screen.findByRole("button", { name: sortByLabel(columns.club.long) });
    await userEvent.click(byClub);
    expect(lastAsk(app)[2]).toEqual({ by: "club", descending: false });
    expect(byClub.closest("th")!.getAttribute("aria-sort")).toBe("ascending");

    await userEvent.click(byClub);
    expect(lastAsk(app)[2]).toEqual({ by: "club", descending: true });
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(byClub.closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("by club, A to Z first", async () => {
    openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.club.long) }));
    expect(namesShown()).toEqual(["Rice", "Saka", "Palmer"]);
  });

  it("by name, pressed again, Z to A", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.name.long) }));
    expect(lastAsk(app)[2]).toEqual({ by: "name", descending: true });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
  });

  it("by season points, the most first", async () => {
    const app = openScouting();
    await userEvent.click(await screen.findByRole("button", { name: sortByLabel(columns.seasonPoints.long) }));
    expect(lastAsk(app)[2]).toEqual({ by: "seasonPoints", descending: true });
  });
});

describe("any stat, as a season total", () => {
  const GOALS = STAT_CATALOGUE.find((each) => each.stat === "goals_scored")!;
  const XG = STAT_CATALOGUE.find((each) => each.stat === "expected_goals")!;
  // Saka has no goals held: he hasn't scored, so his total is 0.
  const TOTALS = { [RICE.code]: { goals_scored: 2, expected_goals: 1.234 }, [PALMER.code]: { goals_scored: 5, expected_goals: 4.5 } };
  const openWithTotals = () => openScouting({ ...HELD, totals: TOTALS });
  const chooseStat = async (name: string) => userEvent.selectOptions(await screen.findByRole("combobox", { name: statLabel }), name);
  const statCells = () => within(table()).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").at(-1)!.textContent);

  it("offers every stat of the catalogue, and none by default", async () => {
    const app = openWithTotals();
    const picker = await screen.findByRole("combobox", { name: statLabel });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([noStatWords, ...STAT_CATALOGUE.map((each) => each.name)]);
    expect((picker as HTMLSelectElement).value).toBe("");
    expect(lastAsk(app)[3]).toBeNull();
  });

  it("a stat chosen is asked for and sorted by, the most first, in a column headed by its short code", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    expect(lastAsk(app).slice(2)).toEqual([{ by: "stat", descending: true }, GOALS.stat]);
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
    expect(statCells()).toEqual(["5", "2", "0"]);
    const head = screen.getByRole("button", { name: sortByLabel(GOALS.name) });
    expect(head.textContent).toContain(GOALS.shortCode);
    expect(head.closest("th")!.getAttribute("title")).toBe(GOALS.name);
    expect(head.closest("th")!.getAttribute("aria-sort")).toBe("descending");
  });

  it("its head pressed again sorts the fewest first", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    await userEvent.click(screen.getByRole("button", { name: sortByLabel(GOALS.name) }));
    expect(lastAsk(app)[2]).toEqual({ by: "stat", descending: false });
    expect(namesShown()).toEqual(["Saka", "Rice", "Palmer"]);
  });

  it("shows a total to two decimal places at most", async () => {
    openWithTotals();
    await chooseStat(XG.name);
    expect(statCells()).toEqual(["4.5", "1.23", "0"]);
  });

  it("stays shown while another column sorts the list", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    await userEvent.click(screen.getByRole("button", { name: sortByLabel(columns.name.long) }));
    expect(lastAsk(app).slice(2)).toEqual([{ by: "name", descending: false }, GOALS.stat]);
    expect(statCells()).toEqual(["5", "2", "0"]);
  });

  it("none chosen again drops the column, and a sort by it goes back to names", async () => {
    const app = openWithTotals();
    await chooseStat(GOALS.name);
    await chooseStat(noStatWords);
    expect(lastAsk(app).slice(2)).toEqual([{ by: "name", descending: false }, null]);
    expect(screen.queryByRole("button", { name: sortByLabel(GOALS.name) })).toBeNull();
  });
});
