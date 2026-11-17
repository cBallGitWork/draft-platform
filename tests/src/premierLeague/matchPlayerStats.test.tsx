// The match page's tabs under the scoreboard and its Player stats tab (#2490; spec/10 S10.8,
// S10.10, S10.11; the approved picture `1440-player-stats.png`). The Overview is matchSheets.test.tsx's.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  highlightsNotHeldLabel,
  matchStatColumns,
  matchTabsLabel,
  matchTabWords,
  noFigureWords,
  notCountingLabel,
  playerStatsLabel,
  provWords,
  sheetLabel,
  shotsNotHeldLabel,
} from "../../../src/premierLeague/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { man, matchOf, openMatch } from "../../support/src/matchPage.harness";
import { ARSENAL, CHELSEA } from "../../support/src/premierLeague.harness";
import { MY_TEAM_NAME } from "../../support/src/teams.harness";

const LINE = { minutes: 67, goals: 1, assists: 1, shots: 4, shotsOnTarget: 2, keyPasses: 2, tackles: 1, cleanSheets: 0, goalsConceded: 1, saves: 0, yellowCards: 0, redCards: 0 };

const MEN = [
  man(1, "Saka", "home", { ownerTeamName: MY_TEAM_NAME, statLine: LINE, points: 10 }),
  man(2, "Eze", "home", { started: false, played: true, statLine: { ...LINE, minutes: 5, goals: 0, assists: 0 }, points: 1 }),
  man(3, "Nwaneri", "home", { started: false, played: false, statLine: { ...LINE, minutes: 0 }, points: 0 }),
  // His record not yet arrived: placeholders, never made-up figures.
  man(4, "Palmer", "away", { ownerTeamName: MY_TEAM_NAME, statLine: null, points: null, counts: false }),
];

/** The rows of a club's Player stats table, each as its cells' text. */
function statRows(club: string) {
  return within(screen.getByRole("table", { name: playerStatsLabel(club) }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent));
}

async function openPlayerStats(provisional = true) {
  openMatch({ match: matchOf({ men: MEN, provisional }) });
  const tabs = await screen.findByRole("group", { name: matchTabsLabel });
  await userEvent.click(within(tabs).getByRole("button", { name: matchTabWords.playerStats }));
  return tabs;
}

test("S10.8 the tabs under the scoreboard open on Overview, and Player stats swaps the team sheets for each man's stats", async () => {
  openMatch({ match: matchOf({ men: MEN }) });
  const tabs = await screen.findByRole("group", { name: matchTabsLabel });
  expect(within(tabs).getByRole("button", { name: matchTabWords.overview, pressed: true })).toBeTruthy();
  expect(screen.getByRole("table", { name: sheetLabel(ARSENAL.name) })).toBeTruthy();
  await userEvent.click(within(tabs).getByRole("button", { name: matchTabWords.playerStats }));
  expect(screen.queryByRole("table", { name: sheetLabel(ARSENAL.name) })).toBeNull();
  expectColumnHeads(screen.getByRole("table", { name: playerStatsLabel(ARSENAL.name) }), Object.values(matchStatColumns));
});

test("S10.8 each man who played shows his stats for the match and his points; an unused substitute isn't listed", async () => {
  await openPlayerStats();
  expect(statRows(ARSENAL.name)).toEqual([
    ["CM", "Saka", "67", "1", "1", "4", "2", "2", "1", "0", "1", "0", "0", "0", "10"],
    ["CM", "Eze", "5", "0", "0", "4", "2", "2", "1", "0", "1", "0", "0", "0", "1"],
  ]);
});

test("S10.8 a man whose record hasn't arrived shows placeholders, and his points greyed while his lineup doesn't count them", async () => {
  await openPlayerStats();
  expect(statRows(CHELSEA.name)).toEqual([["CM", "Palmer", ...Array(12).fill(noFigureWords), `${noFigureWords} ${notCountingLabel}`]]);
});

test("S10.10 each club's stats carry prov. while the points are live, and drop it once final", async () => {
  await openPlayerStats();
  expect(screen.getAllByText(provWords)).toHaveLength(2);
  cleanup();
  await openPlayerStats(false);
  expect(screen.queryAllByText(provWords)).toHaveLength(0);
});

test("S10.8 the Shots panel is a greyed placeholder until shot positions and xG are held", async () => {
  await openPlayerStats();
  expect(screen.getByRole("img", { name: shotsNotHeldLabel })).toBeTruthy();
});

test("S10.11 the Highlights tab is there, greyed until it is built", async () => {
  const tabs = await openPlayerStats();
  const highlights = within(tabs).getByRole("button", { name: matchTabWords.highlights }) as HTMLButtonElement;
  expect(highlights.disabled).toBe(true);
  expect(highlights.title).toBe(highlightsNotHeldLabel);
});
