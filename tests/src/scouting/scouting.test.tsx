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
  clearComparisonWords,
  clubLabel,
  columns,
  COMPARE_TITLE,
  compareLabel,
  comparingWords,
  countWords,
  everyClubWords,
  everyPositionWords,
  freeAgentWords,
  loadingWords,
  matchesWords,
  noFigureWords,
  noneMatchWords,
  noStatsYetWords,
  noWaiversWords,
  pickOneMoreWords,
  positionLabel,
  SCOUTING_TITLE,
  sortByLabel,
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
});
const SAKA = player(1, "Saka", ARSENAL, ["W"], "Saka Potatoes");
const RICE = player(2, "Rice", ARSENAL, ["CDM", "CM"], null);
const PALMER = player(3, "Palmer", CHELSEA, ["CAM"], "Kroos Control");
const nameOf = (stat: string) => STAT_CATALOGUE.find((each) => each.stat === stat)!.name;
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
    expect(lastAsk(app).slice(1)).toEqual([{ availability: "all", position: null, clubCode: null }, { by: "name", descending: false }]);
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
    app.scouting.usePlayersList.mockImplementation((leagueId, filters, sort) => (filters.clubCode === null ? held(leagueId, filters, sort) : undefined));
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

describe("comparing two players", () => {
  const SEASONS: ScoutingData["seasons"] = {
    [SAKA.code]: { matches: 9, stats: { goals_scored: 4, expected_goals: 3.456, minutes: 720 } },
    [PALMER.code]: { matches: 8, stats: { goals_scored: 6, minutes: 765 } },
  };
  const openToCompare = (data: Partial<ScoutingData> = {}) => openScouting({ ...HELD, seasons: SEASONS, ...data });
  const tick = async (name: string) => userEvent.click(await screen.findByRole("checkbox", { name: compareLabel(name) }));
  const panel = () => screen.getByRole("region", { name: COMPARE_TITLE });
  const comparisonTable = () => within(panel()).getByRole("table");
  const rowIn = (label: string) =>
    within(comparisonTable())
      .getByRole("rowheader", { name: label })
      .closest("tr")!;
  const cellsOf = (label: string) =>
    within(rowIn(label))
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

  it("nothing is compared, or asked for, until a player is ticked", async () => {
    const app = openToCompare();
    await screen.findByRole("table");
    expect(screen.queryByRole("region", { name: COMPARE_TITLE })).toBeNull();
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("one ticked asks for one more", async () => {
    const app = openToCompare();
    await tick("Saka");
    expect(within(panel()).getByText(pickOneMoreWords("Saka"))).toBeTruthy();
    expect(app.scouting.useComparison.mock.lastCall![1]).toBeNull();
  });

  it("two ticked are asked for and shown side by side: who each is, his matches, and every stat either has", async () => {
    const app = openToCompare();
    await tick("Saka");
    await tick("Palmer");

    expect(app.scouting.useComparison.mock.lastCall!).toEqual([league.leagueId, [SAKA.code, PALMER.code]]);
    expect(within(comparisonTable()).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Saka", "Palmer"]);
    expect(cellsOf(columns.club.long)).toEqual(["ARS", "CHE"]);
    expect(cellsOf(columns.owner.short)).toEqual(["Saka Potatoes", "Kroos Control"]);
    expect(cellsOf(columns.seasonPoints.short)).toEqual([noFigureWords, noFigureWords]);
    expect(cellsOf(matchesWords)).toEqual(["9", "8"]);
    expect(cellsOf(nameOf("goals_scored"))).toEqual(["4", "6"]);
    expect(cellsOf(nameOf("expected_goals"))).toEqual(["3.46", "0"]);
    expect(cellsOf(nameOf("minutes"))).toEqual(["720", "765"]);
    // A stat neither has is left out.
    expect(within(comparisonTable()).queryByRole("rowheader", { name: nameOf("saves") })).toBeNull();
  });

  it("a free agent is said to be one", async () => {
    openToCompare();
    await tick("Saka");
    await tick("Rice");
    expect(cellsOf(columns.owner.short)).toEqual(["Saka Potatoes", freeAgentWords]);
    expect(within(panel()).getByText(nameOf("goals_scored"))).toBeTruthy();
  });

  it("says when neither has a stat this season", async () => {
    openToCompare({ seasons: {} });
    await tick("Rice");
    await tick("Palmer");
    expect(within(panel()).getByText(noStatsYetWords)).toBeTruthy();
  });

  it("says so while the comparison loads", async () => {
    openToCompare({ comparing: true });
    await tick("Saka");
    await tick("Palmer");
    expect(within(panel()).getByRole("status").textContent).toBe(comparingWords);
  });

  it("a third ticked takes the first one's place", async () => {
    const app = openToCompare();
    await tick("Saka");
    await tick("Palmer");
    await tick("Rice");
    expect(app.scouting.useComparison.mock.lastCall![1]).toEqual([PALMER.code, RICE.code]);
    expect((screen.getByRole("checkbox", { name: compareLabel("Saka") }) as HTMLInputElement).checked).toBe(false);
  });

  it("unticking one goes back to asking for another, and Clear drops the comparison", async () => {
    openToCompare();
    await tick("Saka");
    await tick("Palmer");
    await tick("Saka");
    expect(within(panel()).getByText(pickOneMoreWords("Palmer"))).toBeTruthy();

    await userEvent.click(within(panel()).getByRole("button", { name: clearComparisonWords }));
    expect(screen.queryByRole("region", { name: COMPARE_TITLE })).toBeNull();
    expect((screen.getByRole("checkbox", { name: compareLabel("Palmer") }) as HTMLInputElement).checked).toBe(false);
  });

  it("the ticks stay while a filter hides one of them", async () => {
    const app = openToCompare();
    await tick("Saka");
    await tick("Palmer");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: clubLabel }), "Arsenal");
    expect(app.scouting.useComparison.mock.lastCall![1]).toEqual([SAKA.code, PALMER.code]);
    expect(within(panel()).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Saka", "Palmer"]);
  });
});
