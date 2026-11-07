// The draft room's queue, do-not-draft list and auto-pick (#1100; spec/04, Auto-pick and The queue
// and the ranking): the manager ranks his queue, dragging a row or moving it a place by key, takes
// players off either list, adds his whole Scouting shortlist, turns auto-pick on himself and takes
// control back, and sees when auto-pick took a pick for him. Someone who runs no team sees none of
// it.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { draftListRefusals } from "../../../convex/draft/draftLists";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { DRAFT_PATH, SCOUTING_PATH } from "../../../src/frame/menu";
import type { DraftState } from "../../../src/draft/seam";
import {
  addWholeShortlistWords,
  AUTO_PICK_TITLE,
  autoWords,
  BOARD_TITLE,
  DO_NOT_DRAFT_TITLE,
  doNotDraftAside,
  doNotDraftListLabel,
  emptyQueueWords,
  fromShortlistWords,
  moveLabel,
  onAutoPickWords,
  QUEUE_TITLE,
  queueAside,
  queueListLabel,
  shortlistAddedWords,
  takeControlBackWords,
  takeOffLabel,
  timeoutsWords,
  turnOnAutoPickWords,
} from "../../../src/draft/words";
import { draftListed, draftOrder, emptyBoard, YOUR_TEAM, type DraftData } from "../../support/src/draft.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const FERNANDES = draftListed(1, "B. Fernandes");
const MITOMA = draftListed(2, "Mitoma");
const KUDUS = draftListed(3, "Kudus");
const RODON = draftListed(4, "Rodon");
const LISTS = { queue: [FERNANDES, MITOMA, KUDUS], doNotDraft: [RODON] };

const openDraft = (draft: DraftData = {}, session = manager) => openApp(DRAFT_PATH, session, { draft: { lists: LISTS, ...draft } });
const queuePanel = () => screen.findByRole("region", { name: QUEUE_TITLE });
const autoPickPanel = () => screen.findByRole("region", { name: AUTO_PICK_TITLE });
const queueRows = async () => within(within(await queuePanel()).getByRole("list", { name: queueListLabel })).getAllByRole("listitem");

/** A live draft of the three teams over two rounds, with one pick made: Team 2, the reader's, on the clock. */
const live: DraftState = {
  status: "live",
  startedAt: Date.now() - MINUTE_MS,
  rounds: 2,
  order: draftOrder,
  picksMade: 1,
  onTheClock: { pick: 2, round: 1, teamId: YOUR_TEAM, name: "Team 2" },
  clock: { startsAt: Date.now(), endsAt: Date.now() + 90 * SECOND_MS, pausedAt: undefined },
};

describe("the queue", () => {
  it("lists the manager's queue first choice first, with its count, his place and club for each", async () => {
    openDraft();
    const panel = await queuePanel();
    expect(within(panel).getByText(queueAside(3))).toBeTruthy();
    const rows = await queueRows();
    expect(rows.map((row) => row.textContent)).toEqual(["⠿1WB. FernandesARS✕", "⠿2WMitomaARS✕", "⠿3WKudusARS✕"]);
  });

  it("works before the draft starts", async () => {
    openDraft();
    expect(await queueRows()).toHaveLength(3);
    expect(await autoPickPanel()).toBeTruthy();
  });

  it("says when it is empty", async () => {
    openDraft({ lists: { queue: [], doNotDraft: [] } });
    expect(within(await queuePanel()).getByText(emptyQueueWords)).toBeTruthy();
  });

  it("a row dragged onto another takes its place", async () => {
    const app = openDraft();
    const rows = await queueRows();
    fireEvent.dragStart(rows[0], { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    fireEvent.dragOver(rows[2]);
    fireEvent.drop(rows[2]);
    expect(app.draft.listChanges.move).toHaveBeenCalledWith(league.leagueId, FERNANDES.code, 3);
  });

  it("the arrow keys on a row's handle move him a place, never past either end", async () => {
    const app = openDraft();
    const panel = await queuePanel();
    within(panel).getByRole("button", { name: moveLabel("Mitoma", 2) }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(app.draft.listChanges.move).toHaveBeenLastCalledWith(league.leagueId, MITOMA.code, 1);

    within(panel).getByRole("button", { name: moveLabel("Kudus", 3) }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(app.draft.listChanges.move).toHaveBeenCalledTimes(1);
  });

  it("the cross takes him off the queue", async () => {
    const app = openDraft();
    await userEvent.click(within(await queuePanel()).getByRole("button", { name: takeOffLabel("Mitoma", "queue") }));
    expect(app.draft.listChanges.remove).toHaveBeenCalledWith(league.leagueId, MITOMA.code, "queue");
  });

  it("links to Scouting's shortlist", async () => {
    const app = openDraft();
    await userEvent.click(within(await queuePanel()).getByRole("link", { name: new RegExp(fromShortlistWords) }));
    expect(app.path()).toBe(SCOUTING_PATH);
  });

  it("Add my whole shortlist adds it, and says how many went in and how many were left out", async () => {
    const app = openDraft({ shortlistAdded: { added: 12, leftOut: 3 } });
    const panel = await queuePanel();
    await userEvent.click(within(panel).getByRole("button", { name: addWholeShortlistWords }));
    expect(app.draft.listChanges.addShortlist).toHaveBeenCalledWith(league.leagueId);
    expect(within(panel).getByRole("status").textContent).toBe(shortlistAddedWords(12, 3));
  });

  it("says the server's refusal", async () => {
    const refusal = draftListRefusals.notQueued("Mitoma");
    openDraft({ refusal });
    await userEvent.click(within(await queuePanel()).getByRole("button", { name: takeOffLabel("Mitoma", "queue") }));
    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });
});

describe("the do-not-draft list", () => {
  it("lists his do-not-draft players under the queue, with its count", async () => {
    openDraft();
    const section = within(await queuePanel()).getByRole("region", { name: DO_NOT_DRAFT_TITLE });
    expect(within(section).getByText(doNotDraftAside(1))).toBeTruthy();
    const rows = within(within(section).getByRole("list", { name: doNotDraftListLabel })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["WRodonARS✕"]);
  });

  it("the cross takes him off it", async () => {
    const app = openDraft();
    await userEvent.click(within(await queuePanel()).getByRole("button", { name: takeOffLabel("Rodon", "doNotDraft") }));
    expect(app.draft.listChanges.remove).toHaveBeenCalledWith(league.leagueId, RODON.code, "doNotDraft");
  });
});

describe("auto-pick", () => {
  it("off it: his timeouts against the league's limit, and Turn auto-pick on", async () => {
    const app = openDraft({ board: { ...emptyBoard, yourAutoPick: { on: false, timeouts: 1, limit: 2 } } });
    const panel = await autoPickPanel();
    expect(panel.textContent).toContain(`Timeouts 1 of 2. ${timeoutsWords(2)}`);
    await userEvent.click(within(panel).getByRole("button", { name: turnOnAutoPickWords }));
    expect(app.draft.listChanges.turnOnAutoPick).toHaveBeenCalledWith(league.leagueId);
  });

  it("with no limit: says the league never puts him on it", async () => {
    openDraft({ board: { ...emptyBoard, yourAutoPick: { on: false, timeouts: 0, limit: null } } });
    expect((await autoPickPanel()).textContent).toContain(`Timeouts 0. ${timeoutsWords(null)}`);
  });

  it("on it, after auto-pick took his last pick: says which, and Take control back takes it back", async () => {
    const picks = [
      { pick: 1, teamId: draftOrder[0].teamId, auto: false, player: { code: 10, name: "Saka", clubShortName: "ARS", position: "W" as const } },
      { pick: 2, teamId: YOUR_TEAM, auto: true, player: { code: 11, name: "Salah", clubShortName: "LIV", position: "W" as const } },
    ];
    const app = openDraft({ draft: { ...live, picksMade: 2, onTheClock: { pick: 3, round: 1, teamId: draftOrder[2].teamId, name: "Team 3" } }, board: { ...emptyBoard, picks, yourAutoPick: { on: true, timeouts: 2, limit: 2 } } });
    const panel = await autoPickPanel();
    expect(within(panel).getByText(onAutoPickWords("1.02"))).toBeTruthy();
    await userEvent.click(within(panel).getByRole("button", { name: takeControlBackWords }));
    expect(app.draft.listChanges.takeControlBack).toHaveBeenCalledWith(league.leagueId);

    const board = await screen.findByRole("region", { name: BOARD_TITLE });
    const cells = within(within(board).getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[0].textContent).toBe("WSakaARS, 1.01");
    expect(cells[1].textContent).toBe(`WSalahLIV, 1.02, ${autoWords}`);
  });

  it("on it with no pick made for him yet: says his picks are made at once", async () => {
    openDraft({ draft: live, board: { ...emptyBoard, yourAutoPick: { on: true, timeouts: 0, limit: 2 } } });
    expect(within(await autoPickPanel()).getByText(onAutoPickWords(null))).toBeTruthy();
  });

  it("says the server's refusal", async () => {
    openDraft({ refusal: pickRefusals.over });
    await userEvent.click(within(await autoPickPanel()).getByRole("button", { name: turnOnAutoPickWords }));
    expect((await screen.findByRole("alert")).textContent).toBe(pickRefusals.over);
  });
});

describe("someone who runs no team", () => {
  it("sees no queue and no auto-pick", async () => {
    openDraft({ lists: null, board: { ...emptyBoard, yourTeamId: null, yourAutoPick: null } }, commissioner);
    expect(await screen.findByRole("region", { name: BOARD_TITLE })).toBeTruthy();
    expect(screen.queryByRole("region", { name: QUEUE_TITLE })).toBeNull();
    expect(screen.queryByRole("region", { name: AUTO_PICK_TITLE })).toBeNull();
  });
});
