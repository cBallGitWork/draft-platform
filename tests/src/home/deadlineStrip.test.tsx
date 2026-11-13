// League home's title plate and deadline strip (#1976; docs/design/approved/home/1440.png), as Craig
// answered on #1976 (13 Nov 2026): when this gameweek locks, the reader's lineup by its first
// flagged starter, Set or Not set, the next waiver run with his claims waiting, and his place in the
// table, none of them opening anything. `S12.9`, `S12.10`

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { firstRunFrom } from "../../../convex/waivers/waiverTimes";
import { lineupNotSetWords, lineupSetWords, noFigureWords, stripBoxes, stripLabel, weekdayTimeWords } from "../../../src/home/words";
import { homeFixture, homeRow, quietYours } from "../../support/src/home.harness";
import { withHome } from "../../support/src/homeScreen.harness";
import { league } from "../../support/src/shell.harness";

const gameweekNine = { gameweek: 9, fixtures: [homeFixture("Team 1", "Team 2")], byes: [] };
const MONDAY_EIGHT = [{ day: "monday", hour: 20, minute: 0 }] as const;
const flagged = (name: string, chanceOfPlaying: number | null, playerCode = name.length) => ({ playerCode, name, news: `${name}'s news`, chanceOfPlaying });
const boxes = async () => within(await screen.findByRole("list", { name: stripLabel })).getAllByRole("listitem").map((box) => box.textContent);

describe("the title plate and the deadline strip", () => {
  it("titles the board with the league and this gameweek, and the strip reads when it locks, the lineup, claims and the table", async () => {
    const deadline = Date.now() + DAY_MS + 17 * HOUR_MS + 30 * MINUTE_MS;
    withHome({
      thisGameweek: gameweekNine,
      deadline,
      table: [homeRow(1, "Kroos Control", { points: 19 }), homeRow(2, "Saka Potatoes", { points: 18, mine: true })],
      yours: { ...quietYours, lineup: { set: true, flagged: [flagged("Saka", 75), flagged("Watkins", 0)] }, waiverRuns: [...MONDAY_EIGHT], claims: 2 },
    });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(`${league.name}GW9`);
    const [locks, lineup, claims, table] = stripBoxes(9);
    expect(await boxes()).toEqual([
      `${locks}${weekdayTimeWords(deadline)} in 1d 17h`,
      `${lineup}Saka doubtful and 1 more`,
      `${claims}${weekdayTimeWords(firstRunFrom([...MONDAY_EIGHT], Date.now())!)}, 2 claims`,
      `${table}2nd, 18 pts, 1 behind 1st`,
    ]);
    // No outline left in it, and nothing to open.
    const strip = screen.getByRole("list", { name: stripLabel });
    expect(within(strip).queryByRole("img")).toBeNull();
    expect(within(strip).queryByRole("link")).toBeNull();
  });

  it.each([
    ["out at 0%", { set: true, flagged: [flagged("Watkins", 0)] }, "Watkins out"],
    ["his name alone with no chance given", { set: true, flagged: [flagged("Tonali", null)] }, "Tonali"],
    ["Set with nobody flagged", { set: true, flagged: [] }, lineupSetWords],
    ["Not set with no lineup saved", { set: false, flagged: [] }, lineupNotSetWords],
  ])("Your line-up says %s", async (_, lineup, words) => {
    withHome({ thisGameweek: gameweekNine, yours: { ...quietYours, lineup } });
    expect((await boxes())[1]).toBe(`${stripBoxes(9)[1]}${words}`);
  });

  it("on top of the table, says how far ahead of 2nd", async () => {
    withHome({ thisGameweek: gameweekNine, table: [homeRow(1, "Saka Potatoes", { points: 21, mine: true }), homeRow(2, "Kroos Control", { points: 18 })] });
    expect((await boxes())[3]).toBe(`${stripBoxes(9)[3]}1st, 21 pts, 3 ahead of 2nd`);
  });

  it("in total points, the Table box has only place and points", async () => {
    withHome({ format: "totalPoints", thisGameweek: gameweekNine, table: [homeRow(1, "Kroos Control", { points: 40 }), homeRow(2, "Saka Potatoes", { points: 30, mine: true })] });
    expect((await boxes())[3]).toBe(`${stripBoxes(9)[3]}2nd, 30 pts`);
  });

  it("for someone running no team, with no deadline yet, every box reads —", async () => {
    withHome({ thisGameweek: gameweekNine, deadline: null, yours: null, table: [homeRow(1, "Kroos Control"), homeRow(2, "Saka Potatoes")] });
    expect(await boxes()).toEqual(stripBoxes(9).map((box) => `${box}${noFigureWords}`));
  });

  it("with no gameweek drawn, has neither the gameweek nor the strip", async () => {
    withHome({ format: "totalPoints", thisGameweek: null });
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(league.name);
    expect(screen.queryByRole("list", { name: stripLabel })).toBeNull();
  });
});
