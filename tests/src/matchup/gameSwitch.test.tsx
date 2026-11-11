// The matchup's game switch (#521; Craig, 6 Nov 2026): in a league playing two or more
// head-to-heads a gameweek, the team's games show one at a time, a switch under the score naming
// each ("Game 1 v Team 2"), the one shown current and each other a link to its own matchup. S10.2

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MATCHUP_PATH } from "../../../src/frame/menu";
import type { Matchup } from "../../../src/matchup/seam";
import { GAME_SWITCH_LABEL, gameSwitchWords, SCORE_LABEL } from "../../../src/matchup/words";
import { headToHead, teamSide, type MatchupData } from "../../support/src/matchup.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

type HeadToHead = Extract<Matchup, { kind: "headToHead" }>;

const openMatchup = (matchup: MatchupData) => openApp(MATCHUP_PATH, manager, { matchup });

const TWO_GAMES: HeadToHead["games"] = [
  { kind: "team", teamName: "Team 2" },
  { kind: "team", teamName: "Team 3" },
];
const scored = { kind: "scored", team: teamSide("Team 1", [], []), opponent: teamSide("Team 2", [], []) } as const;

describe("the game switch", () => {
  it("sits under the score, the game shown current, and the other links to its own matchup", async () => {
    const app = openMatchup({ matchup: headToHead(scored, { games: TWO_GAMES }) });
    const gameSwitch = await screen.findByRole("navigation", { name: GAME_SWITCH_LABEL });
    expect(within(screen.getByRole("region", { name: SCORE_LABEL })).getByRole("navigation", { name: GAME_SWITCH_LABEL })).toBe(gameSwitch);
    expect(within(gameSwitch).getByText(gameSwitchWords(1, "Team 2")).getAttribute("aria-current")).toBe("page");
    await userEvent.click(within(gameSwitch).getByRole("link", { name: gameSwitchWords(2, "Team 3") }));
    expect(app.matchup.useMatchup).toHaveBeenLastCalledWith(league.leagueId, expect.any(Number), { teamId: "team-Team 1", gameweek: 6, game: 2 });
  });

  it("links to the first game with no game in the address, as every other link to it (#1771)", async () => {
    openMatchup({ matchup: headToHead(scored, { games: TWO_GAMES, gameNumber: 2 }) });
    const gameSwitch = await screen.findByRole("navigation", { name: GAME_SWITCH_LABEL });
    const href = within(gameSwitch).getByRole("link", { name: gameSwitchWords(1, "Team 2") }).getAttribute("href") ?? "";
    expect(new URL(href, "http://localhost").searchParams.has("game")).toBe(false);
  });

  it("shows before the deadline too, and names a bye", async () => {
    openMatchup({ matchup: headToHead({ kind: "notBegun", opponent: { kind: "team", teamName: "Team 3" } }, { games: [TWO_GAMES[1], { kind: "bye" }] }) });
    const gameSwitch = await screen.findByRole("navigation", { name: GAME_SWITCH_LABEL });
    expect(within(gameSwitch).getByRole("link", { name: gameSwitchWords(2, null) })).toBeTruthy();
  });

  it("isn't there with one game", async () => {
    openMatchup({ matchup: headToHead(scored) });
    await screen.findByRole("region", { name: SCORE_LABEL });
    expect(screen.queryByRole("navigation", { name: GAME_SWITCH_LABEL })).toBeNull();
  });
});
