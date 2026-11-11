// The draft room's first slice (#1098; spec/04, The draft room): in the menu after My team until
// the draft is over, read-only: its state, where it stands, whose turn it is and the pick clock,
// and the board of six rounds, with the whole board a button away.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { DRAFT_PATH, MY_TEAM_PATH } from "../../../src/frame/menu";
import { mainMenuLabel, menuWords } from "../../../src/frame/words";
import type { BoardPick, DraftState } from "../../../src/draft/seam";
import {
  aPickWords,
  BOARD_TITLE,
  clockAPickHead,
  DRAFT_TITLE,
  loadingWords,
  nextHead,
  noStartWords,
  onTheClockHead,
  roundsShownWords,
  stateWords,
  theOrderRoundsWords,
  wholeBoardWords,
  youPickHead,
  yourNextHead,
} from "../../../src/draft/words";
import { silenceConsoleError } from "../../support/console.setup";
import { draftOrder, emptyBoard, type DraftData } from "../../support/src/draft.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const openDraft = (draft: DraftData = {}) => openApp(DRAFT_PATH, manager, { draft });
const board = () => screen.findByRole("region", { name: BOARD_TITLE });
/** The header's reading under `head`. */
const fact = (head: string) => screen.getByText(head, { selector: "dt" }).nextElementSibling?.textContent;
const boardRows = async () => within(await board()).getAllByRole("row").slice(1);

const pickOf = (pick: number, teamIndex: number, name: string): BoardPick => ({
  pick,
  teamId: draftOrder[teamIndex].teamId,
  auto: false,
  player: { code: pick, name, clubShortName: "ARS", position: "W" },
});

/** A live draft of the three teams over `rounds`, `picksMade` made, the next on the clock with 48
 *  seconds left of 90, or paused then. */
function liveDraft(picksMade: number, rounds = 2, paused = false): DraftState {
  const now = Date.now();
  const pick = picksMade + 1;
  const round = Math.floor(picksMade / 3) + 1;
  const inRound = picksMade % 3;
  const team = draftOrder[round % 2 === 1 ? inRound : 2 - inRound];
  return {
    status: "live",
    startedAt: now - MINUTE_MS,
    rounds,
    order: draftOrder,
    picksMade,
    ownPickBy: null,
    onTheClock: { pick, round, teamId: team.teamId, name: team.name },
    clock: { startsAt: now - 42 * SECOND_MS, endsAt: now + 48 * SECOND_MS, pausedAt: paused ? now : undefined },
  };
}

describe("reaching it", () => {
  it("is in the menu after My team while the league says so, and opens the room for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager, { draft: { inMenu: true } });
    const main = await screen.findByRole("navigation", { name: mainMenuLabel });
    expect(within(main).getAllByRole("link").map((link) => link.textContent).slice(0, 3)).toEqual([menuWords.home, menuWords.myTeam, DRAFT_TITLE]);

    await userEvent.click(within(main).getByRole("link", { name: DRAFT_TITLE }));
    expect(await screen.findByRole("heading", { level: 1, name: new RegExp(DRAFT_TITLE) })).toBeTruthy();
    expect(app.path()).toBe(DRAFT_PATH);
    expect(app.draft.useDraft.mock.lastCall![0]).toBe(league.leagueId);
    expect(app.draft.useInMenu.mock.lastCall![0]).toBe(league.leagueId);
  });

  it("leaves the menu once the league says the draft is over", async () => {
    openApp(MY_TEAM_PATH, manager, { draft: { inMenu: false } });
    const main = await screen.findByRole("navigation", { name: mainMenuLabel });
    expect(within(main).queryByRole("link", { name: DRAFT_TITLE })).toBeNull();
  });

  it("says so while it loads", async () => {
    openDraft({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });
});

describe("before the start", () => {
  it("says it hasn't started, where the reader picks, the clock, and that it waits for the commissioner", async () => {
    openDraft();
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain(stateWords.waiting);
    expect(fact(youPickHead)).toBe("2nd, then 5th");
    expect(fact("Clock")).toBe(aPickWords(90));
    expect(fact("Starts")).toBe(noStartWords);
  });

  it("draws the order's empty board, the reader's column named for him", async () => {
    openDraft();
    const shown = await board();
    expect(within(shown).getByText(theOrderRoundsWords(1, 2, 2))).toBeTruthy();
    const heads = within(shown).getAllByRole("columnheader").map((head) => head.textContent);
    expect(heads).toEqual(["Rd", "Team 1", "Team 2, you", "Team 3"]);
    const rows = await boardRows();
    expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1.01", "1.02", "1.03"]);
    expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2.03", "2.02", "2.01"]);
  });
});

describe("while it runs", () => {
  it("shows the pick, whose turn it is, the clock counting down, who is next and the reader's next pick", async () => {
    openDraft({ draft: liveDraft(1), board: { ...emptyBoard, picks: [pickOf(1, 0, "Saka")] } });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain(stateWords.live);
    expect(fact("Pick 2 of 6")).toBe("Round 1, pick 2");
    expect(fact(onTheClockHead)).toBe("Team 2, you");
    expect(fact(clockAPickHead(90))).toBe("0:48");
    expect(fact(nextHead)).toBe("Team 3, then Team 3");
    expect(fact(yourNextHead(true))).toBe("Round 2, pick 2 in 3 picks");
  });

  it("puts each pick made on the board, and outlines the pick on the clock with its time left", async () => {
    openDraft({ draft: liveDraft(1), board: { ...emptyBoard, picks: [pickOf(1, 0, "Saka")] } });
    const [first] = await boardRows();
    const [made, onClock] = within(first).getAllByRole("cell");
    expect(made.textContent).toBe("WSakaARS, 1.01");
    expect(onClock.getAttribute("aria-current")).toBe("true");
    expect(onClock.textContent).toBe(`${onTheClockHead}1.02, 0:48`);
  });

  it("names a traded pick's team on the board, via the team it came from, and in who is next (#1096)", async () => {
    // Team 1's round-1 pick for Team 3's round-2 pick: the snake is Team 1, 2, 3, then 3, 2, 1.
    const [one, , three] = draftOrder.map((team) => team.teamId);
    const tradedPicks = [
      { round: 1, teamId: one, ownerId: three },
      { round: 2, teamId: three, ownerId: one },
    ];
    openDraft({ draft: liveDraft(1), board: { ...emptyBoard, picks: [pickOf(1, 2, "Saka")], tradedPicks } });
    const [first, second] = await boardRows();
    expect(within(first).getAllByRole("cell")[0].textContent).toBe("WSakaARS, 1.01Team 3 via Team 1");
    expect(within(second).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2.03", "2.02", "Team 1via Team 3"]);
    expect(fact(nextHead)).toBe("Team 3, then Team 1");
    expect(fact(yourNextHead(true))).toBe("Round 2, pick 2 in 3 picks");
  });

  it("logs a traded pick whose owner is no longer in the order, and shows the slot as it was", async () => {
    const [one] = draftOrder.map((team) => team.teamId);
    const gone = "gone" as typeof one;
    const logged = silenceConsoleError();
    openDraft({ draft: liveDraft(0), board: { ...emptyBoard, tradedPicks: [{ round: 2, teamId: one, ownerId: gone }] } });
    const [, second] = await boardRows();
    expect(within(second).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2.03", "2.02", "2.01"]);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("not in the draft order"), gone);
  });

  it("says the draft is paused, and its clock stands still", async () => {
    openDraft({ draft: liveDraft(0, 2, true), board: emptyBoard });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain(stateWords.paused);
    expect(fact(clockAPickHead(90))).toBe("0:48");
    expect(fact(yourNextHead(false))).toBe("Round 1, pick 2 in 1 pick");
  });

  it("shows six rounds, and every round on the whole board", async () => {
    openDraft({ draft: liveDraft(9, 8), board: emptyBoard });
    expect(await boardRows()).toHaveLength(6);
    expect(within(await board()).getByText(roundsShownWords(1, 6, 8))).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: wholeBoardWords }));
    expect(await boardRows()).toHaveLength(8);
    expect(screen.getByRole("button", { name: wholeBoardWords }).getAttribute("aria-pressed")).toBe("true");
  });
});

it("says when the draft is over, every pick on the board", async () => {
  const picks = [pickOf(1, 0, "A"), pickOf(2, 1, "B"), pickOf(3, 2, "C"), pickOf(4, 2, "D"), pickOf(5, 1, "E"), pickOf(6, 0, "F")];
  openDraft({ draft: { status: "over", startedAt: 0, rounds: 2, order: draftOrder, picksMade: 6 }, board: { ...emptyBoard, picks } });
  expect((await screen.findByRole("heading", { level: 1 })).textContent).toContain(stateWords.over);
  const rows = await boardRows();
  expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["WFARS, 2.03", "WEARS, 2.02", "WDARS, 2.01"]);
});
