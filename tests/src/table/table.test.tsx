// The league's table and fixtures (#33; spec/12, spec/09): reached from the menu by anyone in the
// league; the table, all noughts and saying so until a gameweek is scored, then each fixture's
// score, live points marked provisional and a gameweek that can't be scored named; the fixtures a gameweek
// at a time, over the gameweeks the league plays, the team left over against the league's average
// or on a bye; and a total-points league's table with no fixtures.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { nextGameweekLabel, previousGameweekLabel } from "../../../src/shared/words";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { menuWords } from "../../../src/frame/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";
import { leagueTableOf } from "../../../src/table/drawnTable";
import { openTable } from "../../support/src/tableScreen.harness";
import {
  byeWords,
  columns,
  fixturesListLabel,
  gameweekWords,
  leagueAverageWords,
  loadingWords,
  noResultsWords,
  provisionalWords,
  scoreWords,
  unscoredWords,
  TABLE_PAGE_TITLE,
  TABLE_TITLE,
  afterWords,
  competitionWords,
  CUP_TITLE,
  cupRounds,
  cupTieLabel,
  FIXTURES_TITLE,
  liveWords,
  tooFewTeamsWords,
  yourTeamWords,
} from "../../../src/table/words";
import { autoTeamWhatWords, autoTeamWords, formLabel, liveFormLabel, noFigureWords } from "../../../src/shared/words";

const FIVE = ["Ann's", "Bob's", "Cat's", "Dan's", "Eve's"];
const fixtureLines = (gameweek: number) =>
  within(screen.getByRole("list", { name: fixturesListLabel(gameweek) }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("reaching it", () => {
  it.each([
    ["a manager", manager],
    ["a commissioner running no team", commissioner],
  ])("%s opens it from the menu's Table, for the league the app is in", async (_, session) => {
    const app = openApp(MY_TEAM_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: menuWords.table }));

    expect(await screen.findByRole("heading", { level: 1, name: TABLE_PAGE_TITLE })).toBeTruthy();
    expect(app.path()).toBe(TABLE_PATH);
    expect(app.table.useLeagueTable).toHaveBeenCalledWith(league.leagueId);
  });

  it("is a region named by its title, so screen readers list it", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE) });
    expect(await screen.findByRole("region", { name: TABLE_PAGE_TITLE })).toBeTruthy();
  });

  it("says so while it loads", async () => {
    openTable({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });
});

describe("the table", () => {
  it("lists every team on nothing, in the order they were made, and says why", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE) });
    await screen.findByText(noResultsWords);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((row) => [within(row).getByRole("rowheader").textContent, within(row).getAllByRole("cell").map((cell) => cell.textContent)]);
    // F and A in tenths, always (the approved picture): 0.0, not 0.
    expect(rows).toEqual(FIVE.map((name, index) => [name, [String(index + 1), "0", "0", "0", "0", "0.0", "0.0", "0", "0", noFigureWords]]));
  });

  it("heads a head-to-head table with played, won, drawn, lost, for, against, the difference and points", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE) });
    expectColumnHeads(await screen.findByRole("table"), Object.values(columns));
  });

  it("ranks by points once matchups are scored, with a signed difference, and stops saying there are no results", async () => {
    const scores = new Map([[1, new Map([["Ann's", 10], ["Bob's", 30.5]])]]);
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { scores }) });

    const [first, second] = (await screen.findAllByRole("row")).slice(1);
    expect(within(first).getByRole("rowheader").textContent).toBe("Bob's");
    expect(within(first).getByText("+20.5")).toBeTruthy();
    expect(within(second).getByText("\u221220.5")).toBeTruthy();
    expect(screen.queryByText(noResultsWords)).toBeNull();
  });

  it("breaks a tie on points by the league's tie-breaks, as the server does (#168)", async () => {
    const teams = ["Ann's", "Bob's", "Cat's", "Dan's"];
    const [one, other] = leagueTableOf(teams).gameweeks[0].fixtures;
    // Both home sides win, so they tie on points; the one made later scores more, so only the
    // tie-break (points for, a new league's) puts it first.
    const [earlier, later] = [one.team, other.team].sort((a, b) => teams.indexOf(a) - teams.indexOf(b));
    const scored = new Map([
      [earlier, 20],
      [later, 30],
      [one.opponent!, 10],
      [other.opponent!, 10],
    ]);
    openTable({ leagueTable: leagueTableOf(teams, { scores: new Map([[1, scored]]) }) });

    const [first, second] = (await screen.findAllByRole("row")).slice(1);
    expect(within(first).getByRole("rowheader").textContent).toBe(later);
    expect(within(second).getByRole("rowheader").textContent).toBe(earlier);
  });

  it("says when live points count, provisional until final", async () => {
    const scores = new Map([[1, new Map([["Ann's", 10], ["Bob's", 30.5]])]]);
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { scores, provisional: ["Bob's"] }) });
    expect(await screen.findByText(provisionalWords)).toBeTruthy();
  });

  it("names a gameweek that couldn't be scored, and why, rather than going blank (#287)", async () => {
    const reason = 'rule 8 of the scoring set scores "goals_scroed", which is neither a catalogue stat nor one of the league\'s own';
    openTable({ leagueTable: leagueTableOf(FIVE, { unscored: [{ gameweek: 6, reason }] }) });
    expect(await screen.findByText(unscoredWords(6, reason))).toBeTruthy();
    expect(screen.queryByText(provisionalWords)).toBeNull();
  });

  it("in total points, has only played and points, and no fixtures", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE, { format: "totalPoints" }) });
    const heads = within(await screen.findByRole("table")).getAllByRole("columnheader");
    expect(heads.map((head) => head.textContent)).toEqual(["Pos", "Team", "P", "Pts"]);
    // Titled Table, with no tabs and no Fixtures panel (the approved total-points picture).
    expect(screen.getByRole("heading", { level: 1, name: TABLE_TITLE })).toBeTruthy();
    expect(screen.queryByRole("button", { name: competitionWords.cup })).toBeNull();
    expect(screen.queryByRole("region", { name: FIXTURES_TITLE })).toBeNull();
    expect(screen.queryByRole("button", { name: nextGameweekLabel })).toBeNull();
  });

  it("picks out the reader's own team's row, named so for screen readers", async () => {
    openTable({ leagueTable: leagueTableOf(["Team 1", "Team 2"]) });
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows.map((row) => [within(row).getByRole("rowheader").textContent, row.getAttribute("aria-current")])).toEqual([
      [`${yourTeamWords}: Team 1`, "true"],
      ["Team 2", null],
    ]);
  });

  it("marks a team on the auto team with its chip after the name, its hover saying what it does (spec/09)", async () => {
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { autoTeams: ["Bob's"] }) });
    const [ann, bob] = (await screen.findAllByRole("row")).slice(1).map((row) => within(row).getByRole("rowheader"));
    expect(within(ann).queryByText(autoTeamWords)).toBeNull();
    expect(bob.textContent).toBe(`Bob's${autoTeamWords}`);
    expect(within(bob).getByText(autoTeamWords).getAttribute("title")).toBe(autoTeamWhatWords);
  });

  it("shows each team's form as chips, and the gameweek the table counts up to", async () => {
    const scores = new Map([[1, new Map([["Ann's", 10], ["Bob's", 30.5]])]]);
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { scores }) });
    expect(await screen.findByRole("img", { name: formLabel(["won"]) })).toBeTruthy();
    expect(screen.getByRole("img", { name: formLabel(["lost"]) })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: TABLE_TITLE })).getByText(afterWords(1))).toBeTruthy();
  });

  it("while live, marks each team's last result provisional, and the fixtures say Live", async () => {
    const scores = new Map([[1, new Map([["Ann's", 10], ["Bob's", 30.5]])]]);
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { scores, provisional: ["Bob's"], gameweeks: [1] }) });
    expect(await screen.findByRole("img", { name: liveFormLabel(["won"]) })).toBeTruthy();
    expect(screen.getByRole("img", { name: liveFormLabel(["lost"]) })).toBeTruthy();
    expect(screen.queryByText(afterWords(1))).toBeNull();
    expect(within(screen.getByRole("region", { name: FIXTURES_TITLE })).getByText(liveWords)).toBeTruthy();
  });
});

describe("the fixtures", () => {
  /** Gameweek 1 began two weeks ago, so gameweek 3 is the first not begun. */
  const deadlineOf = (gameweek: number) => Date.now() + (gameweek - 3) * WEEK_MS + HOUR_MS;

  it("open on the first gameweek not yet begun, the team left over against the league's average", async () => {
    const drawn = leagueTableOf(FIVE, { deadlineOf });
    openTable({ leagueTable: drawn });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(3) })).toBeTruthy();
    const { fixtures } = drawn.gameweeks[2];
    expect(fixtures.filter((fixture) => fixture.opponent === null)).toHaveLength(1);
    expect(fixtureLines(3)).toEqual(fixtures.map(({ team, opponent }) => `${team}v${opponent ?? leagueAverageWords}`));
  });

  it("show each scored fixture's score, the league's average's too", async () => {
    const scores = new Map([[1, new Map([["Ann's", 20], ["Bob's", 0], ["Cat's", 41.5], ["Dan's", 33], ["Eve's", 18]])]]);
    const drawn = leagueTableOf(FIVE, { scores, deadlineOf: () => Date.now() - HOUR_MS, gameweeks: [1] });
    openTable({ leagueTable: drawn });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(1) })).toBeTruthy();
    expect(fixtureLines(1)).toEqual(
      drawn.gameweeks[0].fixtures.map(({ team, opponent, points }) => `${team}${scoreWords(points!.team, points!.opponent)}${opponent ?? leagueAverageWords}`),
    );
    const average = drawn.gameweeks[0].fixtures.find((fixture) => fixture.opponent === null)!;
    expect(average.points!.opponent).toBe(22.5);
  });

  it("step through only the gameweeks the league plays, no further than its first or last", async () => {
    const gameweeks = [1, 2, 5, 6];
    openTable({ leagueTable: leagueTableOf(FIVE, { gameweeks }) });

    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(1) })).toBeTruthy();
    expect((screen.getByRole("button", { name: previousGameweekLabel }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(5) })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));
    expect((screen.getByRole("button", { name: nextGameweekLabel }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: previousGameweekLabel }));
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(5) })).toBeTruthy();
  });

  it("pass over a gameweek with no kickoff time behind one begun, as the server does (#413)", async () => {
    const deadlines = new Map([[30, null], [31, Date.now() - HOUR_MS], [32, Date.now() + WEEK_MS]]);
    openTable({ leagueTable: leagueTableOf(FIVE, { gameweeks: [30, 31, 32], deadlineOf: (gameweek) => deadlines.get(gameweek) ?? null }) });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(32) })).toBeTruthy();
  });

  it("open on the last gameweek once every one has begun", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE, { gameweeks: [1, 2], deadlineOf: () => Date.now() - HOUR_MS }) });
    expect(await screen.findByRole("heading", { level: 3, name: gameweekWords(2) })).toBeTruthy();
  });

  it("give the team left over a bye in a league that has them", async () => {
    const drawn = leagueTableOf(FIVE, { oddTeamOut: "bye" });
    openTable({ leagueTable: drawn });
    expect(await screen.findByText(byeWords(drawn.gameweeks[0].byes))).toBeTruthy();
    expect(fixtureLines(1)).toHaveLength(2);
  });

  it("with two games a gameweek, list both rounds' fixtures and every team with a bye", async () => {
    const drawn = leagueTableOf(FIVE, { oddTeamOut: "bye", gamesPerGameweek: 2 });
    openTable({ leagueTable: drawn });
    const [first] = drawn.gameweeks;
    const [one, other] = first.byes;
    expect(first.byes).toHaveLength(2);
    expect(await screen.findByText(`${one} and ${other} have a bye.`)).toBeTruthy();
    expect(fixtureLines(1)).toHaveLength(4);
  });

  it("pick out the reader's own game", async () => {
    openTable({ leagueTable: leagueTableOf(["Team 1", "Team 2"], { gameweeks: [1] }) });
    const items = within(await screen.findByRole("list", { name: fixturesListLabel(1) })).getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual(["true"]);
    expect(items[0].textContent).toContain(yourTeamWords);
  });

  it("wait for a second team", async () => {
    openTable({ leagueTable: leagueTableOf(["Ann's"]) });
    expect(await screen.findByText(tooFewTeamsWords)).toBeTruthy();
  });
});

describe("the tabs", () => {
  it("open on League, and Cup is an empty eight-team bracket with no teams or scores, the fixtures kept on their gameweek", async () => {
    openTable({ leagueTable: leagueTableOf(FIVE, { gameweeks: [1, 2, 3] }) });
    expect((await screen.findByRole("button", { name: competitionWords.league })).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: nextGameweekLabel }));

    await userEvent.click(screen.getByRole("button", { name: competitionWords.cup }));
    const cup = screen.getByRole("region", { name: CUP_TITLE });
    expect(screen.queryByRole("table")).toBeNull();
    const ties = within(cup).getAllByRole("img");
    expect(cupRounds.map((round) => ties.filter((tie) => tie.getAttribute("aria-label")!.startsWith(round)).length)).toEqual([4, 2, 1]);
    expect(within(cup).getByRole("img", { name: cupTieLabel(cupRounds[2], 1) }).textContent).toBe("");
    FIVE.forEach((team) => expect(within(cup).queryByText(team)).toBeNull());
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(2) })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: competitionWords.league }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: gameweekWords(2) })).toBeTruthy();
  });
});
