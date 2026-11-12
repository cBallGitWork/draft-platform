// League home (#387; spec/12, League home): reached from the menu's Home by anyone in the league;
// this gameweek's head-to-heads, scored once begun, the table with each team's form (whole, or the
// top and the reader's row), and while a matchday is open, the Vidiprinter. The rest of the board,
// as its approved picture lays it out, is board.test.tsx's.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TOP_ROWS } from "../../../convex/home/glance";
import { MINUTE_MS } from "../../../convex/shared/time";
import { HOME_PATH, MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import {
  columns,
  headToHeadsLabel,
  loadingWords,
  noHeadToHeadsWords,
  noMatchdayLinesWords,
  noResultsWords,
  partTableWords,
  premierLeagueTitle,
  TABLE_TITLE,
  THIS_GAMEWEEK_TITLE,
  VIDIPRINTER_TITLE,
  wholeTableLink,
  yourTeamWords,
} from "../../../src/home/words";
import { scoreWords } from "../../../src/matchup/words";
import { formLabel, menuWords } from "../../../src/shared/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { homeFixture, homeRow } from "../../support/src/home.harness";
import { openHome, withHome } from "../../support/src/homeScreen.harness";
import { commissioner, league, manager, openApp, panel } from "../../support/src/shell.harness";
const tableRows = async () => within(await panel(TABLE_TITLE)).getAllByRole("row").slice(1);

describe("reaching it", () => {
  it.each([
    ["a manager", manager],
    ["a commissioner running no team", commissioner],
  ])("%s opens it from the menu's Home, for the league the app is in, at this minute", async (_, session) => {
    const app = openApp(MY_TEAM_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: menuWords.home }));

    expect(await screen.findByRole("heading", { level: 1, name: league.name })).toBeTruthy();
    expect(app.path()).toBe(HOME_PATH);
    const [leagueId, now] = app.home.useLeagueHome.mock.lastCall!;
    expect(leagueId).toBe(league.leagueId);
    expect(Date.now() - now).toBeLessThan(MINUTE_MS);
  });

  it("says so while it loads", async () => {
    openHome({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });
});

describe("this gameweek's head-to-heads", () => {
  it("lists each, with the league's average and a bye", async () => {
    withHome({ thisGameweek: { gameweek: 9, fixtures: [homeFixture("Ann's", "Bob's"), homeFixture("Cat's", null)], byes: ["Dan's"] } });
    const gameweek = within(await panel(THIS_GAMEWEEK_TITLE)).getByRole("list", { name: headToHeadsLabel("GW9") });
    expect(within(gameweek).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Ann'svBob's", "Cat'svLeague average", "Dan's: bye"]);
  });

  it("once begun, shows each head-to-head's score in place of the v", async () => {
    withHome({ thisGameweek: { gameweek: 9, fixtures: [homeFixture("Ann's", "Bob's", { team: 41, opponent: 22 }), homeFixture("Cat's", null)], byes: [] } });
    const gameweek = await panel(THIS_GAMEWEEK_TITLE);
    expect(within(gameweek).getAllByRole("listitem").map((item) => item.textContent)).toEqual([`Ann's${scoreWords(41, 22)}Bob's`, "Cat'svLeague average"]);
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
  it("shows each row's place, name, won-drawn-lost, points and form, the reader's row marked, and leads to the whole table", async () => {
    const app = withHome({
      table: [homeRow(1, "Ann's", { played: 3, won: 2, drawn: 1, points: 7, form: ["won", "drawn", "won"] }), homeRow(2, "Bob's", { played: 3, lost: 3, form: ["lost", "lost", "lost"], mine: true })],
    });
    const [first, second] = await tableRows();

    expectColumnHeads(await panel(TABLE_TITLE), [columns.position, columns.team, columns.record, columns.points, columns.form]);
    expect(within(first).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1", "2-1-0", "7", "WDW"]);
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
    expect(within(first).getAllByRole("cell")[3].textContent).toBe("—");
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

describe("matchday mode", () => {
  const lines = [
    { key: "a", text: "78' GOAL Haaland", points: "+9" },
    { key: "b", text: "71' YELLOW Rice", points: "−1" },
  ];

  it("while a matchday is open, the Vidiprinter tops the right-hand column, each line with what it moves", async () => {
    withHome({ matchday: { gameweek: 1, commentary: { kind: "read", delayed: false, lines } } });
    const vidiprinter = await panel(VIDIPRINTER_TITLE);
    expect(within(vidiprinter).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["78' GOAL Haaland+9", "71' YELLOW Rice−1"]);
    expect(vidiprinter.compareDocumentPosition(await panel(premierLeagueTitle(1))) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says so before its first line", async () => {
    withHome({ matchday: { gameweek: 1, commentary: { kind: "read", delayed: false, lines: [] } } });
    expect(within(await panel(VIDIPRINTER_TITLE)).getByText(noMatchdayLinesWords)).toBeTruthy();
  });

  it("while the home is quiet, there is no Vidiprinter", async () => {
    openHome();
    await panel(TABLE_TITLE);
    expect(screen.queryByRole("region", { name: VIDIPRINTER_TITLE })).toBeNull();
  });
});
