// The commissioner's fixture swap on the table's Fixtures (spec/09, Fixture edits; the approved
// auto-team picture): in a gameweek not yet begun each side is a button; a side picked, then one
// in another game, and Save swap moves them between their games, the league's average too.
// A manager, and a gameweek begun, get no buttons.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS, WEEK_MS } from "../../../convex/shared/time";
import { LEAGUE_AVERAGE } from "../../../convex/table/roundRobin";
import { TABLE_PATH } from "../../../src/frame/menu";
import { idOf, leagueTableOf } from "../../../src/table/drawnTable";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";
import type { TableData } from "../../support/src/table.harness";
import { cancelWords, editingWords, FIXTURES_TITLE, fixturesListLabel, gameweekWords, leagueAverageWords, pickAnotherWords, pickSideLabel, saveSwapWords } from "../../../src/table/words";

const FOUR = ["Ann's", "Bob's", "Cat's", "Dan's"];
/** Gameweek 1 began two weeks ago, so gameweek 3 is the first not begun. */
const deadlineOf = (gameweek: number) => Date.now() + (gameweek - 3) * WEEK_MS + HOUR_MS;
const openAs = (session: typeof manager, table: TableData) => openApp(TABLE_PATH, session, { table });
const fixtures = () => within(screen.getByRole("region", { name: new RegExp(`^${FIXTURES_TITLE}`) }));
const side = (name: string) => fixtures().getByRole("button", { name: pickSideLabel(name) });

describe("the commissioner's fixture swap", () => {
  it("picks a side, then one in another game, and saves the swap of that gameweek alone", async () => {
    const drawn = leagueTableOf(FOUR, { deadlineOf });
    const app = openAs(commissioner, { leagueTable: drawn });
    await screen.findByRole("heading", { level: 3, name: gameweekWords(3) });
    const [first, second] = drawn.gameweeks[2].fixtures;

    await userEvent.click(side(first.team));
    expect(side(first.team).getAttribute("aria-pressed")).toBe("true");
    expect(fixtures().getByText(editingWords)).toBeTruthy();
    expect(fixtures().getByText(pickAnotherWords)).toBeTruthy();
    expect((fixtures().getByRole("button", { name: saveSwapWords }) as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(side(second.opponent!));
    await userEvent.click(fixtures().getByRole("button", { name: saveSwapWords }));
    expect(app.table.fixtureSwap.swap).toHaveBeenCalledExactlyOnceWith(
      league.leagueId,
      3,
      { moves: idOf(first.team), against: idOf(first.opponent!) },
      { moves: idOf(second.opponent!), against: idOf(second.team) },
    );
    expect(fixtures().queryByText(editingWords)).toBeNull();
  });

  it("a second side in the same game takes the first's place, and Cancel unpicks", async () => {
    const drawn = leagueTableOf(FOUR, { deadlineOf });
    const app = openAs(commissioner, { leagueTable: drawn });
    await screen.findByRole("heading", { level: 3, name: gameweekWords(3) });
    const [first] = drawn.gameweeks[2].fixtures;

    await userEvent.click(side(first.team));
    await userEvent.click(side(first.opponent!));
    expect(side(first.team).getAttribute("aria-pressed")).toBe("false");
    expect(side(first.opponent!).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(fixtures().getByRole("button", { name: cancelWords }));
    expect(fixtures().queryByText(editingWords)).toBeNull();
    expect(app.table.fixtureSwap.swap).not.toHaveBeenCalled();
  });

  it("swaps the league's average like a team, and shows the server's refusal", async () => {
    const drawn = leagueTableOf(FOUR.slice(0, 3), { deadlineOf, oddTeamOut: "leagueAverage" });
    const refusal = "That swap would have a side play itself.";
    const app = openAs(commissioner, { leagueTable: drawn, swapAnswer: refusal });
    await screen.findByRole("heading", { level: 3, name: gameweekWords(3) });
    const games = drawn.gameweeks[2].fixtures;
    const withAverage = games.find(({ opponent }) => opponent === null)!;
    const other = games.find((game) => game !== withAverage)!;

    await userEvent.click(side(leagueAverageWords));
    await userEvent.click(side(other.team));
    await userEvent.click(fixtures().getByRole("button", { name: saveSwapWords }));
    expect(app.table.fixtureSwap.swap).toHaveBeenCalledWith(
      league.leagueId,
      3,
      { moves: LEAGUE_AVERAGE, against: idOf(withAverage.team) },
      { moves: idOf(other.team), against: idOf(other.opponent!) },
    );
    expect((await fixtures().findByRole("alert")).textContent).toBe(refusal);
    expect(fixtures().getByText(editingWords)).toBeTruthy();
  });

  it("isn't offered in a gameweek begun", async () => {
    openAs(commissioner, { leagueTable: leagueTableOf(FOUR, { deadlineOf: () => Date.now() - HOUR_MS, gameweeks: [1] }) });
    await screen.findByRole("list", { name: fixturesListLabel(1) });
    expect(fixtures().queryAllByRole("button", { name: /^Swap / })).toHaveLength(0);
  });

  it("isn't offered to a manager who doesn't run the league", async () => {
    openAs(manager, { leagueTable: leagueTableOf(FOUR, { deadlineOf }) });
    await screen.findByRole("list", { name: fixturesListLabel(3) });
    expect(fixtures().queryAllByRole("button", { name: /^Swap / })).toHaveLength(0);
  });
});
