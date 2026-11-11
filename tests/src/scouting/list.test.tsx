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
  nameLabel,
  noPointsYetWords,
  notLastSeasonWords,
  onWaiversWords,
  positionLabel,
  SCOUTING_TITLE,
  seasonPointsColumn,
} from "../../../src/scouting/words";
import { columnHeadName, POSITION_NAMES } from "../../../src/shared/words";
import { crestUrl } from "../../../src/ui/ClubName";
import { ARSENAL } from "../../support/convex/footballRows.harness";
import { columnHeadIn } from "../../support/src/columnHeads";
import { HELD, lastAsk, namesShown, openOnAll, openScouting, RICE, rowOf, table } from "../../support/src/scoutingScreen.harness";
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
  it("opens on free agents by name, as none has season points yet, and says how many", async () => {
    const app = openScouting();
    await screen.findByRole("table");
    expect(lastAsk(app).slice(1)).toEqual([{ availability: "freeAgents", position: null, clubCode: null }, { by: "name", descending: false }, null, "season", undefined]);
    expect((screen.getByRole("radio", { name: availabilityWords.freeAgents }) as HTMLInputElement).checked).toBe(true);
    expect(namesShown()).toEqual(["Rice"]);
    expect(screen.getByText(countWords(1))).toBeTruthy();
  });

  it("gives each player his club and positions as short codes, the full names on hover", async () => {
    openScouting();
    await screen.findByRole("table");
    const rice = within(rowOf("Rice"));
    expect(rice.getByText("ARS").getAttribute("title")).toBe("Arsenal");
    expect(rice.getByText("ARS").previousElementSibling!.getAttribute("src")).toBe(crestUrl(ARSENAL.code));
    // His main position's chip, every position of his on hover.
    expect(rice.getByText("CDM").closest("td")!.getAttribute("title")).toBe("CDM, CM");
    expect(rice.queryByText("CM")).toBeNull();
    expect(rowOf("Rice").querySelector("th")!.getAttribute("title")).toBe("Rice in full");
  });

  it("says who owns each player in this league, or that he is a free agent", async () => {
    await openOnAll();
    expect(columnHeadIn(table(), columns.owner)).toBeTruthy();
    expect(rowOf("Saka").textContent).toContain("Saka Potatoes");
    expect(rowOf("Rice").textContent).toContain(freeAgentWords);
  });

  it("the Status column shows only in the All and Owned views", async () => {
    openScouting();
    await screen.findByRole("table");
    expect(within(table()).queryByRole("columnheader", { name: columnHeadName(columns.owner) })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: availabilityWords.owned }));
    expect(columnHeadIn(table(), columns.owner)).toBeTruthy();
  });

  it("reads '—' for season points, saying why on hover", async () => {
    await openOnAll();
    const points = within(rowOf("Saka")).getAllByRole("cell").at(-4)!;
    expect(points.textContent).toBe(noFigureWords);
    expect(points.getAttribute("title")).toBe(noPointsYetWords);
  });

  it("before the new season's first match, heads the points with last season's ('Pts 25/26'), a newcomer's '—' saying why (#956)", async () => {
    await openOnAll({ ...HELD, players: HELD.players!.map((player) => ({ ...player, points: player.name === "Rice" ? 180 : null })), pointsSeason: 2025 });
    const head = columnHeadIn(table(), seasonPointsColumn(2025));
    expect(head.textContent).toContain("Pts 25/26");
    expect(within(rowOf("Rice")).getAllByRole("cell").at(-4)!.textContent).toBe("180");
    expect(within(rowOf("Saka")).getAllByRole("cell").at(-4)!.getAttribute("title")).toBe(notLastSeasonWords);
  });

  it("heads each column with a short code, named by it and its full name, which shows on hover", async () => {
    await openOnAll();
    const shown = [columns.positions, columns.name, columns.owner, columns.minutes, columns.seasonPoints, columns.goals, columns.assists, columns.shotsOnTarget];
    const heads = shown.map((words) => columnHeadIn(table(), words));
    expect(within(table()).getAllByRole("columnheader")).toEqual(heads);
    // The sorted column's head adds its arrow after the short code.
    expect(heads.map((head, at) => head.textContent!.startsWith(shown[at].short))).not.toContain(false);
    expect(heads.map((head) => head.getAttribute("title"))).toEqual(shown.map((column) => column.long));
  });
});

describe("the name box", () => {
  it("finds a player by his short or full name as you type, accents aside, with the filters", async () => {
    await openOnAll();
    await userEvent.type(screen.getByRole("searchbox", { name: nameLabel }), "pal");
    expect(namesShown()).toEqual(["Palmer"]);
    expect(screen.getByText(countWords(1))).toBeTruthy();
    await userEvent.clear(screen.getByRole("searchbox", { name: nameLabel }));
    await userEvent.type(screen.getByRole("searchbox", { name: nameLabel }), "IN FULL");
    expect(namesShown()).toEqual(["Palmer", "Rice", "Saka"]);
  });

  it("finds nobody by his club", async () => {
    await openOnAll();
    await userEvent.type(screen.getByRole("searchbox", { name: nameLabel }), "Arsenal");
    expect(screen.getByText(noneMatchWords)).toBeTruthy();
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

  it("on waivers keeps those on waivers, All's Status saying the run that can first take him, and free agents leaves them out (#1200)", async () => {
    const firstRunAt = Date.parse("2026-11-12T18:00:00Z");
    const james = { ...RICE, code: 9, name: "James", onWaivers: { firstRunAt } };
    openScouting({ ...HELD, players: [...HELD.players!, james] });
    await userEvent.click(await screen.findByRole("radio", { name: availabilityWords.onWaivers }));
    expect(namesShown()).toEqual(["James"]);
    await userEvent.click(screen.getByRole("radio", { name: availabilityWords.all }));
    expect(rowOf("James").textContent).toContain(onWaiversWords(firstRunAt));
    expect(onWaiversWords(firstRunAt)).toMatch(/^Waivers, Thu \d\d:\d\d$/);

    await userEvent.click(screen.getByRole("radio", { name: availabilityWords.freeAgents }));
    expect(namesShown()).toEqual(["Rice"]);
  });

  it("on waivers with nobody on them says none matches", async () => {
    openScouting();
    await userEvent.click(await screen.findByRole("radio", { name: availabilityWords.onWaivers }));
    expect(screen.getByText(noneMatchWords)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("a player on waivers with no run times set says just Waivers", () => {
    expect(onWaiversWords(null)).toBe("Waivers");
  });

  it("by position", async () => {
    const app = await openOnAll();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: positionLabel }), POSITION_NAMES.CAM);
    expect(lastAsk(app)[1].position).toBe("CAM");
    expect(namesShown()).toEqual(["Palmer"]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: positionLabel }), everyPositionWords);
    expect(lastAsk(app)[1].position).toBeNull();
  });

  it("by club, from the clubs the server holds", async () => {
    const app = await openOnAll();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: clubLabel }), "Arsenal");
    expect(lastAsk(app)[1].clubCode).toBe(ARSENAL.code);
    expect(namesShown()).toEqual(["Rice", "Saka"]);
  });

  it("while the next list loads, the last stays up and the club filter keeps its clubs and choice", async () => {
    const app = await openOnAll();
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
