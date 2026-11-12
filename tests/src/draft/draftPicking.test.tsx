// Picking on the draft room (#1099; spec/04, The draft room; the approved draft room picture):
// Scouting's players nobody has drafted under the board, a position tab and Find in its title bar,
// the site's ranking, last season's points and the overview's stats, each player the reader's team
// can't take greyed out in his place and each in his queue marked; and his panel's Draft button,
// which makes the pick only while the reader is on the clock, over his ranking, points and squad.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RoomFigure } from "../../../convex/draft/draftPlayers";
import { POSITIONS } from "../../../convex/positions/positionTables";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogueList";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { DRAFT_PATH } from "../../../src/frame/menu";
import type { DraftState, RoomFigures } from "../../../src/draft/seam";
import {
  addToQueueWords,
  DO_NOT_DRAFT_TITLE,
  draftColumns,
  draftPlayerWords,
  everyPositionTabWords,
  findLabel,
  inGamesWords,
  lastSeasonPointsColumn,
  newcomerWords,
  notLegalWords,
  notYourPickWords,
  onTheRankingWords,
  pausedPickWords,
  PLAYERS_TITLE,
  positionTabsLabel,
  queueMarkWords,
  rankHead,
  selectLabel,
  statsLabel,
  takenWords,
  yourSquadHead,
  yourSquadWords,
} from "../../../src/draft/words";
import { columns } from "../../../src/scouting/words";
import { columnHeadName, sortByLabel } from "../../../src/shared/words";
import { ARSENAL, CHELSEA } from "../../support/convex/footballRows.harness";
import { draftOrder, emptyBoard, YOUR_TEAM, type DraftData } from "../../support/src/draft.harness";
import { manager, openApp } from "../../support/src/shell.harness";
const listed = (code: number, name: string, ownerTeamName: string | null = null, club = ARSENAL, positions: ListedPlayer["positions"] = ["W"]): ListedPlayer => ({
  code,
  name,
  fullName: name,
  club,
  positions,
  ownerTeamName,
  onWaivers: null,
  seasonPoints: null,
  points: null,
  figures: NO_FIGURES,
  stat: null,
});
const SAKA = listed(1, "Saka");
const RICE = listed(2, "Rice", null, ARSENAL, ["CDM"]);
const ODEGAARD = listed(3, "Ødegaard", "Team 1");
const PALMER = listed(4, "Palmer", null, CHELSEA, ["CAM"]);
const players = [SAKA, RICE, ODEGAARD, PALMER];

const figure = (code: number, rank: number, lastSeasonPoints: number | null, appearances = 30): RoomFigure => ({
  code,
  rank,
  lastSeasonPoints,
  overview: { appearances, goals: 5, assists: 4, cleanSheets: 0 },
});
/** Palmer the site's best, then Saka, then Rice, a newcomer; 2025's points. */
const FIGURES: RoomFigures = {
  players: [figure(SAKA.code, 2, 180, 36), figure(RICE.code, 3, null), figure(ODEGAARD.code, 4, 140), figure(PALMER.code, 1, 220)],
  lastSeason: 2025,
  statsSeason: 2025,
};

/** A live draft's first pick, Team 1's, or the reader's Team 2's second, paused or not. */
function liveDraft(yours: boolean, paused = false): DraftState {
  const now = Date.now();
  const team = draftOrder[yours ? 1 : 0];
  return {
    status: "live",
    startedAt: now - MINUTE_MS,
    rounds: 2,
    order: draftOrder,
    picksMade: yours ? 1 : 0,
    ownPickBy: null,
    onTheClock: { pick: yours ? 2 : 1, round: 1, teamId: team.teamId, name: team.name },
    clock: { startsAt: now - 42 * SECOND_MS, endsAt: now + 48 * SECOND_MS, pausedAt: paused ? now : undefined },
  };
}

const openDraft = (data: DraftData) => openApp(DRAFT_PATH, manager, { draft: { players, ...data } });
const list = () => screen.findByRole("region", { name: PLAYERS_TITLE });
const open = async (name: string) => userEvent.click(within(await list()).getByRole("button", { name: selectLabel(name) }));
const draftButton = (name: string) => screen.getByRole("button", { name: draftPlayerWords(name) });
/** The list's rows under its head, by the player each names. */
const rowNames = async () =>
  within(await list())
    .getAllByRole("rowheader")
    .map((cell) => within(cell).getByRole("button").textContent);
const head = (words: { short: string; long: string }) => within(within(screen.getByRole("region", { name: PLAYERS_TITLE })).getByRole("table")).getByRole("columnheader", { name: columnHeadName(words) });

describe("the players list", () => {
  it("lists only the players nobody has drafted", async () => {
    openDraft({ draft: liveDraft(true) });
    expect(await rowNames()).not.toContain(ODEGAARD.name);
    expect(await rowNames()).toEqual(expect.arrayContaining([SAKA.name, RICE.name, PALMER.name]));
  });

  it("keeps a player the team can't take in his place, saying why, his position chip greyed too", async () => {
    openDraft({ draft: liveDraft(true), greyed: [{ code: RICE.code, reason: "clubFull" }] });
    const rows = within(await list()).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("Palmer"), expect.stringContaining("Rice"), expect.stringContaining("Saka")]);
    expect(rows[1].textContent).toContain(notLegalWords.clubFull);
    expect(rows[2].textContent).not.toContain(notLegalWords.clubFull);
    expect(within(rows[1]).getByTitle("Defensive midfielder").className).toContain("opacity-");
    expect(within(rows[2]).getByTitle("Winger").className).not.toContain("opacity-");
  });

  it("heads its columns Pos, Player, Rank, last season's points by its season, MP, G, A and CS", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES });
    await list();
    const heads = within(within(screen.getByRole("region", { name: PLAYERS_TITLE })).getByRole("table")).getAllByRole("columnheader").map((each) => each.getAttribute("aria-label"));
    expect(heads).toEqual(
      [columns.positions, columns.name, draftColumns.rank, lastSeasonPointsColumn(2025), draftColumns.appearances, draftColumns.goals, draftColumns.assists, draftColumns.cleanSheets].map(
        columnHeadName,
      ),
    );
    expect(lastSeasonPointsColumn(2025).short).toBe("Pts 25/26");
  });

  it("opens on the site's ranking, best first, and a head sorts by its column", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES });
    expect(await rowNames()).toEqual([PALMER.name, SAKA.name, RICE.name]);
    await userEvent.click(within(head(columns.name)).getByRole("button", { name: sortByLabel(columnHeadName(columns.name)) }));
    expect(await rowNames()).toEqual([PALMER.name, RICE.name, SAKA.name]);
    // A newcomer has no points last season, so he sorts last whichever way.
    const points = lastSeasonPointsColumn(2025);
    await userEvent.click(within(head(points)).getByRole("button", { name: sortByLabel(columnHeadName(points)) }));
    expect(await rowNames()).toEqual([PALMER.name, SAKA.name, RICE.name]);
  });

  it("keeps only the position tab's players, every position a tab in its fixed order, All again showing everyone", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES });
    const tabs = within(await list()).getByRole("group", { name: positionTabsLabel });
    expect(within(tabs).getAllByRole("button").map((each) => each.textContent)).toEqual([everyPositionTabWords, ...POSITIONS]);
    await userEvent.click(within(tabs).getByRole("button", { name: "CAM" }));
    expect(await rowNames()).toEqual([PALMER.name]);
    await userEvent.click(within(tabs).getByRole("button", { name: everyPositionTabWords }));
    expect(await rowNames()).toHaveLength(3);
  });

  it("finds players by name or club, accents aside", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES });
    const find = within(await list()).getByLabelText(findLabel);
    await userEvent.type(find, "che");
    expect(await rowNames()).toEqual([PALMER.name]);
    await userEvent.clear(find);
    await userEvent.type(find, "RICE");
    expect(await rowNames()).toEqual([RICE.name]);
  });

  it("marks each player in the reader's queue with his place in it", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES, queue: [SAKA.code, PALMER.code] });
    const rows = within(await list()).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain(queueMarkWords(2));
    expect(rows[1].textContent).toContain(queueMarkWords(1));
    expect(rows[2].textContent).not.toContain(queueMarkWords(1).split(" ")[0]);
  });

  it("swaps the overview for the stat picked in Scouting's stat box", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES });
    const goals = STAT_CATALOGUE.find((each) => each.stat === "goals_scored")!;
    await userEvent.selectOptions(within(await list()).getByLabelText(statsLabel), goals.stat);
    expect(head({ short: goals.shortCode, long: goals.name })).toBeTruthy();
    expect(within(within(screen.getByRole("region", { name: PLAYERS_TITLE })).getByRole("table")).queryByRole("columnheader", { name: columnHeadName(draftColumns.appearances) })).toBeNull();
  });
});

describe("the selected player's panel", () => {
  it("gives his place on the ranking, last season's points in his games, and what the reader's squad holds", async () => {
    const board = { ...emptyBoard, maxPerClub: 2, picks: [{ pick: 1, teamId: YOUR_TEAM, auto: false, player: { code: 99, name: "Raya", clubShortName: "ARS", position: "GK" as const } }] };
    openDraft({ draft: liveDraft(true), board, figures: FIGURES });
    await open(SAKA.name);
    const panel = screen.getByRole("region", { name: `${SAKA.name}${ARSENAL.shortName}` });
    const fact = (dt: string) => within(panel).getByText(dt).nextElementSibling?.textContent;
    expect(fact(rankHead)).toBe(`2${onTheRankingWords}`);
    expect(fact(lastSeasonPointsColumn(2025).short)).toBe(`180${inGamesWords(36)}`);
    expect(fact(yourSquadHead)).toBe(yourSquadWords("W", 0, "ARS", 1, 2));
  });

  it("calls a player not in last season's data a newcomer", async () => {
    openDraft({ draft: liveDraft(true), figures: FIGURES });
    await open(RICE.name);
    expect(screen.getByText(newcomerWords)).toBeTruthy();
  });
});

describe("the panel's Add to queue and Do not draft (#1474)", () => {
  const listButton = (words: string) => screen.queryByRole("button", { name: words });

  it("puts him on the reader's queue, or his do-not-draft list, out of turn too", async () => {
    const app = openDraft({ draft: liveDraft(false) });
    await open(SAKA.name);
    await userEvent.click(listButton(addToQueueWords)!);
    expect(app.draft.listChanges.add).toHaveBeenCalledWith(expect.anything(), SAKA.code, "queue");
    await userEvent.click(listButton(DO_NOT_DRAFT_TITLE)!);
    expect(app.draft.listChanges.add).toHaveBeenCalledWith(expect.anything(), SAKA.code, "doNotDraft");
  });

  it("can't be pressed for the list he is already on", async () => {
    openDraft({ draft: liveDraft(true), queue: [SAKA.code] });
    await open(SAKA.name);
    expect(listButton(addToQueueWords)).toHaveProperty("disabled", true);
    expect(listButton(DO_NOT_DRAFT_TITLE)).toHaveProperty("disabled", false);
  });

  it("says why the server refused", async () => {
    openDraft({ draft: liveDraft(true), refusal: "A do-not-draft list holds at most 50 players. Take one off first." });
    await open(SAKA.name);
    await userEvent.click(listButton(DO_NOT_DRAFT_TITLE)!);
    expect((await screen.findByRole("alert")).textContent).toBe("A do-not-draft list holds at most 50 players. Take one off first.");
  });

  it("shows neither to a reader who runs no team, nor once the draft is over", async () => {
    openDraft({ draft: liveDraft(true), lists: null });
    await open(SAKA.name);
    expect(listButton(addToQueueWords)).toBeNull();

    openDraft({ draft: { status: "over", startedAt: 0, rounds: 2, order: draftOrder, picksMade: 6 } });
    await open(SAKA.name);
    expect(listButton(DO_NOT_DRAFT_TITLE)).toBeNull();
  });
});

describe("the Draft button", () => {
  it("makes the pick while the reader is on the clock", async () => {
    const app = openDraft({ draft: liveDraft(true) });
    await open(SAKA.name);
    const button = draftButton(SAKA.name);
    expect(button).toHaveProperty("disabled", false);

    await userEvent.click(button);
    expect(app.draft.changes.makePick).toHaveBeenCalledWith(expect.anything(), SAKA.code);
  });

  it("can't be pressed for a greyed-out player", async () => {
    openDraft({ draft: liveDraft(true), greyed: [{ code: RICE.code, reason: "areasShort" }] });
    await open(RICE.name);
    expect(draftButton(RICE.name)).toHaveProperty("disabled", true);
    expect(screen.getAllByText(notLegalWords.areasShort).length).toBeGreaterThan(0);
  });

  it("holds the pick and the time left under his name, as its description", async () => {
    openDraft({ draft: liveDraft(true) });
    await open(SAKA.name);
    const button = draftButton(SAKA.name);
    expect(button.textContent).toMatch(/Pick 1\.02, 0:4\d left$/);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.closest("button")).toBe(button);
  });

  it("can't be pressed out of turn", async () => {
    openDraft({ draft: liveDraft(false) });
    await open(SAKA.name);
    expect(draftButton(SAKA.name)).toHaveProperty("disabled", true);
    expect(within(draftButton(SAKA.name)).getByText(notYourPickWords)).toBeTruthy();
  });

  it("can't be pressed while the draft is paused", async () => {
    openDraft({ draft: liveDraft(true, true) });
    await open(SAKA.name);
    expect(draftButton(SAKA.name)).toHaveProperty("disabled", true);
    expect(screen.getByText(pausedPickWords)).toBeTruthy();
  });

  it("can't be pressed for a selected player another team has since drafted, saying which (#1560)", async () => {
    // The list still holds the row Saka was selected from; the board has Team 1 taking him since.
    const board = { ...emptyBoard, picks: [{ pick: 1, teamId: draftOrder[0].teamId, auto: false, player: { code: SAKA.code, name: SAKA.name, clubShortName: "ARS", position: "W" as const } }] };
    openDraft({ draft: liveDraft(true), board });
    await open(SAKA.name);
    expect(draftButton(SAKA.name)).toHaveProperty("disabled", true);
    expect(within(draftButton(SAKA.name)).getByText(takenWords(draftOrder[0].name))).toBeTruthy();
  });

  it("says why the server refused the pick", async () => {
    openDraft({ draft: liveDraft(true), pickAnswer: "Saka is already on Team 1." });
    await open(SAKA.name);
    await userEvent.click(draftButton(SAKA.name));
    expect((await screen.findByRole("alert")).textContent).toBe("Saka is already on Team 1.");
  });
});
