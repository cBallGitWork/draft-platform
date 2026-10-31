// League home's first slice (#387; spec/12, League home): reached from the menu's Home by anyone in
// the league; this gameweek's head-to-heads, the table with each team's form (whole, or the top and
// the reader's row), the commissioner's latest letter pinned, and the latest claims, drops and trades.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TOP_ROWS } from "../../../convex/home/glance";
import { MINUTE_MS } from "../../../convex/shared/time";
import { HOME_PATH, MAIL_PATH, MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { menuWords } from "../../../src/frame/words";
import type { LeagueHome } from "../../../src/home/seam";
import {
  columns,
  formLabel,
  gameweekWords,
  HOME_TITLE,
  inMailLink,
  LETTER_TITLE,
  loadingWords,
  MOVES_TITLE,
  noHeadToHeadsWords,
  noLetterWords,
  noMovesWords,
  noResultsWords,
  noRulesWords,
  partTableWords,
  TABLE_TITLE,
  wholeTableLink,
  yourTeamWords,
} from "../../../src/home/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { homeFixture, homeRow, quietHome, type HomeData } from "../../support/src/home.harness";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";

const openHome = (home: HomeData = {}) => openApp(HOME_PATH, manager, { home });
const withHome = (change: Partial<LeagueHome>) => openHome({ leagueHome: { ...quietHome, ...change } });
const panel = (title: string) => screen.findByRole("region", { name: title });
const tableRows = async () => within(await panel(TABLE_TITLE)).getAllByRole("row").slice(1);

describe("reaching it", () => {
  it.each([
    ["a manager", manager],
    ["a commissioner running no team", commissioner],
  ])("%s opens it from the menu's Home, for the league the app is in, at this minute", async (_, session) => {
    const app = openApp(MY_TEAM_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: menuWords.home }));

    expect(await screen.findByRole("heading", { level: 1, name: HOME_TITLE })).toBeTruthy();
    expect(app.path()).toBe(HOME_PATH);
    const [leagueId, now] = app.home.useLeagueHome.mock.lastCall!;
    expect(leagueId).toBe(league.leagueId);
    expect(Date.now() - now).toBeLessThan(MINUTE_MS);
  });

  it("says so while it loads", async () => {
    openHome({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });

  it("says why a league made before rules has none", async () => {
    openHome({ leagueHome: null });
    expect(await screen.findByText(noRulesWords)).toBeTruthy();
  });
});

describe("this gameweek's head-to-heads", () => {
  it("lists each, under the gameweek, with the league's average and a bye", async () => {
    withHome({ thisGameweek: { gameweek: 9, fixtures: [homeFixture("Ann's", "Bob's"), homeFixture("Cat's", null)], byes: ["Dan's"] } });
    const gameweek = await panel(gameweekWords(9));
    expect(within(gameweek).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Ann'svBob's", "Cat'svLeague average", "Dan's: bye"]);
  });

  it.each([
    ["total points", "totalPoints"],
    ["too few teams", "headToHead"],
  ] as const)("with %s there are none, and it says why", async (_, format) => {
    withHome({ format, thisGameweek: null });
    expect(await screen.findByText(noHeadToHeadsWords[format])).toBeTruthy();
  });
});

describe("the table", () => {
  it("shows each row's place, name, record, points and form, the reader's row marked, and leads to the whole table", async () => {
    const app = withHome({
      table: [homeRow(1, "Ann's", { played: 3, won: 2, drawn: 1, points: 7, form: ["won", "drawn", "won"] }), homeRow(2, "Bob's", { played: 3, lost: 3, form: ["lost", "lost", "lost"], mine: true })],
    });
    const [first, second] = await tableRows();

    expect(within(first).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1", "3", "2", "1", "0", "7", "WDW"]);
    expect(within(first).getByLabelText(formLabel(["won", "drawn", "won"]))).toBeTruthy();
    expect(first.getAttribute("aria-current")).toBeNull();
    expect(second.getAttribute("aria-current")).toBe("true");
    expect(within(second).getByRole("rowheader").textContent).toBe(`${yourTeamWords}: Bob's`);
    expect(screen.queryByText(noResultsWords)).toBeNull();

    await userEvent.click(screen.getByRole("link", { name: wholeTableLink }));
    expect(app.path()).toBe(TABLE_PATH);
  });

  it("says so while nothing is scored, each form a dash", async () => {
    openHome();
    const [first] = await tableRows();
    expect(screen.getByText(noResultsWords)).toBeTruthy();
    expect(within(first).getByLabelText(formLabel([])).textContent).toBe("—");
  });

  it("in total points, has no record or form", async () => {
    withHome({ format: "totalPoints", thisGameweek: null });
    expectColumnHeads(await panel(TABLE_TITLE), [columns.position, columns.team, columns.played, columns.points]);
  });

  it("cut to the top rows, says how many teams it has, and that the reader's row is added", async () => {
    const top = Array.from({ length: TOP_ROWS }, (_, i) => homeRow(i + 1, `Team ${i + 1}`));
    withHome({ table: [...top, homeRow(9, "Team 9", { mine: true })], teams: 12 });
    expect((await tableRows()).map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["1", "2", "3", "4", "5", "9"]);
    expect(screen.getByText(partTableWords(12, true))).toBeTruthy();
  });

  it("cut with none of the reader's rows past the top, adds no row and says so", async () => {
    withHome({ table: Array.from({ length: TOP_ROWS }, (_, i) => homeRow(i + 1, `Team ${i + 1}`)), teams: 12 });
    expect(await screen.findByText(partTableWords(12, false))).toBeTruthy();
  });

  it("whole, says nothing of a cut", async () => {
    openHome();
    await panel(TABLE_TITLE);
    expect(screen.queryByText(partTableWords(2, false))).toBeNull();
  });
});

describe("the commissioner's letter", () => {
  it("shows the latest, pinned, who wrote it, and leads to Mail", async () => {
    const app = withHome({ pinnedLetter: { at: Date.now(), from: "commish@example.com", subject: "Draft night", body: "Friday at eight." } });
    const letter = await panel(LETTER_TITLE);
    expect(within(letter).getByRole("heading", { name: "Draft night" })).toBeTruthy();
    expect(within(letter).getByText("From commish@example.com")).toBeTruthy();
    expect(within(letter).getByText("Friday at eight.")).toBeTruthy();

    await userEvent.click(within(letter).getByRole("link", { name: inMailLink }));
    expect(app.path()).toBe(MAIL_PATH);
  });

  it("says so before the first", async () => {
    openHome();
    expect(within(await panel(LETTER_TITLE)).getByText(noLetterWords)).toBeTruthy();
  });
});

describe("the latest claims, drops and trades", () => {
  it("lists each as it came, newest first", async () => {
    withHome({
      squadMoves: [
        { at: Date.now(), kind: "playerReleased", playerName: "Rice", teamName: "Bob's", fromTeamName: null },
        { at: Date.now() - 1, kind: "playerMoved", playerName: "Palmer", teamName: "Bob's", fromTeamName: "Ann's" },
        { at: Date.now() - 2, kind: "playerAssigned", playerName: "Saka", teamName: "Ann's", fromTeamName: null },
      ],
    });
    const lines = within(await panel(MOVES_TITLE)).getAllByRole("listitem").map((item) => item.lastChild?.textContent);
    expect(lines).toEqual(["Rice was released by Bob's", "Palmer moved from Ann's to Bob's", "Saka joined Ann's"]);
  });

  it("says so when there are none", async () => {
    openHome();
    expect(within(await panel(MOVES_TITLE)).getByText(noMovesWords)).toBeTruthy();
  });
});
