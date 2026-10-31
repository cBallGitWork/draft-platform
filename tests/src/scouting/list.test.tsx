// Scouting's players list (#373, spec/19 The players list): reached from the menu's Scouting, in
// place of Players, by anyone in the league; every player with his club, positions and owner; the
// filters ask the server; season points and role fit read "—", saying why on hover.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MY_TEAM_PATH, SCOUTING_PATH } from "../../../src/frame/menu";
import { mainMenuLabel, menuWords } from "../../../src/frame/words";
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
  noPointsYetWords,
  noRoleFitYetWords,
  noWaiversWords,
  positionLabel,
  SCOUTING_TITLE,
} from "../../../src/scouting/words";
import { POSITION_NAMES } from "../../../src/shared/words";
import { ARSENAL } from "../../support/convex/footballRows.harness";
import { HELD, lastAsk, namesShown, openScouting, rowOf, table } from "../../support/src/scoutingScreen.harness";
import { commissioner, league, manager, managerIn, miniBeta, openApp } from "../../support/src/shell.harness";

describe("reaching it", () => {
  it.each([
    ["a manager", manager],
    ["a commissioner running no team", commissioner],
  ])("%s opens it from the menu's Scouting, for the league the app is in", async (_, session) => {
    const app = openApp(MY_TEAM_PATH, session, { scouting: HELD });
    await userEvent.click(await screen.findByRole("link", { name: menuWords.scouting }));

    expect(await screen.findByRole("heading", { level: 1, name: SCOUTING_TITLE })).toBeTruthy();
    expect(app.path()).toBe(SCOUTING_PATH);
    expect(lastAsk(app)[0]).toBe(league.leagueId);
  });

  it("the menu has no Players any more", async () => {
    openApp(MY_TEAM_PATH, manager);
    const main = await screen.findByRole("navigation", { name: mainMenuLabel });
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

  it("reads '—' for season points and role fit, saying why on hover", async () => {
    openScouting();
    await screen.findByRole("table");
    const cells = within(rowOf("Saka")).getAllByRole("cell");
    expect(cells.slice(-2).map((cell) => cell.textContent)).toEqual([noFigureWords, noFigureWords]);
    expect(cells.slice(-2).map((cell) => cell.getAttribute("title"))).toEqual([noPointsYetWords, noRoleFitYetWords]);
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
