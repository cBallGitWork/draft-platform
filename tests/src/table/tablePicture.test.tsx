// The table and fixtures as their approved picture draws them (#1499; docs/design/approved/table/):
// the season line at the page plate's far end, F and A always in tenths, and a League head over
// the gameweek's games.

import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leagueTableOf } from "../../../src/table/drawnTable";
import { FIXTURES_TITLE, leagueGamesHead, seasonLineWords } from "../../../src/table/words";
import { openTable } from "../../support/src/tableScreen.harness";
const scored = (scores: [string, number][]) => ({ scores: new Map([[1, new Map(scores)]]) });

afterEach(() => vi.useRealTimers());

describe("the table and fixtures, as the picture draws them", () => {
  it("shows points for and against to one place, a whole total too: 30.0 beside 10.5", async () => {
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], scored([["Ann's", 10.5], ["Bob's", 30]])) });
    const [bob] = (await screen.findAllByRole("row")).slice(1);
    expect(within(bob).getByText("30.0")).toBeTruthy();
    expect(within(bob).getByText("10.5")).toBeTruthy();
  });

  it("ends the page's plate with the season the table's matches belong to, not the clock's", async () => {
    // August 2027: the clock is in 2027/28, but FPL, and so the matches held, are still on 2026/27.
    vi.useFakeTimers({ now: Date.UTC(2027, 7, 1), toFake: ["Date"] });
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], { season: 2026, ...scored([["Ann's", 10], ["Bob's", 30.5]]) }) });
    expect(await screen.findByText("2026/27, after GW1")).toBeTruthy();
  });

  it("leaves the season line off while no match is held to say the season", async () => {
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's"], scored([["Ann's", 10], ["Bob's", 30.5]])) });
    await screen.findAllByRole("row");
    expect(screen.queryByText(/after GW1$/)).toBeNull();
  });

  it("heads Fixtures' games League", async () => {
    openTable({ leagueTable: leagueTableOf(["Ann's", "Bob's", "Cat's", "Dan's"]) });
    const fixtures = await screen.findByRole("region", { name: FIXTURES_TITLE });
    expect(within(fixtures).getByRole("heading", { level: 4, name: leagueGamesHead })).toBeTruthy();
  });
});

describe("the season line's words", () => {
  it("says the season alone before any result, the gameweek being played while live, else the last counted", () => {
    expect(seasonLineWords(2026, undefined)).toBe("2026/27");
    expect(seasonLineWords(2026, { gameweek: 10, live: true })).toBe("2026/27, GW10");
    expect(seasonLineWords(2026, { gameweek: 9, live: false })).toBe("2026/27, after GW9");
    expect(seasonLineWords(2099, undefined)).toBe("2099/00");
  });
});
