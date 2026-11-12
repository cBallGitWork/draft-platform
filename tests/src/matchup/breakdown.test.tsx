// A player's breakdown on the matchup (#798; spec/10: "the opposition manager needs to see why his
// opponent got the points"): tapping any man, mine or my opponent's, opens his matches' lines,
// each saying why, his role's line included, leading on to his player card. Under best match, the
// match that doesn't count is greyed with "Not counted: best match" (Craig, 6 Nov 2026).

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MatchBreakdown } from "../../../convex/matchup/matchupShape";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import { playerCardPath } from "../../../src/playerCard/paths";
import { matchPath } from "../../../src/premierLeague/paths";
import { breakdownMatchWords, breakdownRoleWords, closeBreakdownLabel, notCountedWords, openBreakdownLabel, playerCardWords } from "../../../src/matchup/words";
import { headToHead, roleOf, slot, teamSide } from "../../support/src/matchup.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const ALL = { by: "all" } as const;

/** One match of his: goals at 4 each, and his role's line. */
const match = (fixtureCode: number, kickoff: number, goals: number, rolePoints: number, counted = true): MatchBreakdown => ({
  fixtureCode,
  kickoff,
  home: "NFO",
  away: "BRE",
  score: null,
  points: goals * 4 + rolePoints,
  counted,
  categories: [{ stat: "goals_scored", name: "Goals scored", points: goals * 4, why: { actions: goals, value: { shape: "perAction", points: 4 }, pricedBy: ALL, cut: null } }],
  role: { name: "Poacher", points: rolePoints, sides: [{ points: rolePoints, lines: [{ stat: "goals_scored", name: "Goals scored", actions: goals }] }] },
  override: null,
});

/** Team 2's striker in a double gameweek under best match: 9 in his first, 5 in his second. */
const DELAP = slot("Delap", { area: "attack", points: 9, breakdown: [match(201, Date.UTC(2026, 10, 7, 15), 2, 1), match(202, Date.UTC(2026, 10, 10, 20), 1, 1, false)] });
const game = headToHead({ kind: "scored", team: teamSide("Team 1", [slot("Coyle")], []), opponent: teamSide("Team 2", [DELAP], []), version: "26_27.1" });

/** The breakdown's panel, headed by his slot's label, his name, his role and his team (the approved
 *  picture). */
const BREAKDOWN_NAME = `ST Delap ${breakdownRoleWords(roleOf("attack").name, "Team 2")}`;

describe("a player's breakdown", () => {
  it("opens on tapping my opponent's man: each match's lines saying why, his role's line, the uncounted one greyed, and his card", async () => {
    openApp(MATCHUP_PATH, manager, { matchup: { matchup: game } });
    fireEvent.click(await screen.findByRole("button", { name: openBreakdownLabel("Delap") }));

    const panel = screen.getByRole("region", { name: BREAKDOWN_NAME });
    expect(within(panel).getAllByText(/Goals scored/).map((line) => line.closest("li")!.textContent)).toEqual(["Goals scored 2 at 4 each 8", "Goals scored 1 at 4 each 4"]);
    expect(within(panel).getAllByText(/^Poacher:/).map((line) => line.textContent)).toEqual(["Poacher: +1 (+1: 2 goals scored)", "Poacher: +1 (+1: 1 goals scored)"]);
    expect(within(panel).getByText("9")).toBeTruthy();
    expect(within(panel).getAllByText(notCountedWords)).toHaveLength(1);
    expect(within(panel).getAllByText("Scored under version 26_27.1")).toHaveLength(2);
    expect(within(panel).getByRole("link", { name: playerCardWords }).getAttribute("href")).toBe(playerCardPath(league.leagueId, DELAP.playerCode));
  });

  it("names each match by its clubs and score with its clock, or its kickoff before it starts, each opening its page", async () => {
    const live = { ...match(201, Date.UTC(2026, 10, 7, 15), 1, 0), score: { state: "live" as const, homeGoals: 1, awayGoals: 0, minutes: 67, clockLabel: "67'40" } };
    const over = { ...match(202, Date.UTC(2026, 10, 10, 20), 1, 0), home: "BRE", away: "NFO", score: { state: "fullTime" as const, homeGoals: 2, awayGoals: 2, minutes: 90, clockLabel: null } };
    const toCome = { ...match(203, Date.UTC(2026, 10, 12, 20), 0, 0), score: null };
    const wood = slot("Wood", { area: "attack", breakdown: [live, over, toCome] });
    openApp(MATCHUP_PATH, manager, { matchup: { matchup: headToHead({ kind: "scored", team: teamSide("Team 1", [wood], []), opponent: teamSide("Team 2", [], []) }) } });
    fireEvent.click(await screen.findByRole("button", { name: openBreakdownLabel("Wood") }));

    expect(screen.getByRole("link", { name: "NFO 1–0 BRE 67'" }).getAttribute("href")).toBe(matchPath(201));
    expect(screen.getByRole("link", { name: "BRE 2–2 NFO FT" }).getAttribute("href")).toBe(matchPath(202));
    expect(screen.getByRole("link", { name: breakdownMatchWords(toCome) }).textContent).toMatch(/^NFO v BRE \S+ \d\d:\d\d$/);
  });

  it("closes from its cross, or on tapping him again", async () => {
    openApp(MATCHUP_PATH, manager, { matchup: { matchup: game } });
    const name = await screen.findByRole("button", { name: openBreakdownLabel("Delap") });
    fireEvent.click(name);
    fireEvent.click(screen.getByRole("button", { name: closeBreakdownLabel }));
    expect(screen.queryByRole("region", { name: BREAKDOWN_NAME })).toBeNull();
    fireEvent.click(name);
    expect(name.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(name);
    expect(screen.queryByRole("region", { name: BREAKDOWN_NAME })).toBeNull();
  });
});
