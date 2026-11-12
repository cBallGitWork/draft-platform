import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { previewHome } from "../../../src/home/preview";
import { previewMatchup } from "../../../src/matchup/preview";
import { openingGameweek } from "../../../src/premierLeague/openingGameweek";
import { previewPremierLeague } from "../../../src/premierLeague/preview";
import { previewPlayerCard } from "../../../src/playerCard/preview";
import { previewPlayers } from "../../../src/scouting/preview";
import { previewGameweek, previewTeamNames, proLeague } from "../../../src/shared/preview";
import { previewTable } from "../../../src/table/preview";

// The preview's one made-up league (#1779): every preview screen of it shows the same teams and is
// on the same gameweek, so a man playing on one screen isn't at full time on the next.

const { leagueId } = proLeague;
const now = Date.now();
const sorted = (names: readonly string[]) => [...names].sort();

/** The matchup preview's head-to-head, held at its first minute. */
function previewHeadToHead() {
  window.history.replaceState(null, "", "/?preview=manager&minute=0");
  const matchup = renderHook(() => previewMatchup.useMatchup(leagueId, now, {})).result.current;
  if (matchup?.kind !== "headToHead") throw new Error("the matchup preview is a head-to-head");
  return matchup;
}

it("shows the same teams on League home, the table and the matchup, as many as the league says it has", () => {
  const home = previewHome.useLeagueHome(leagueId, now)!;
  const news = previewHome.useLeagueNews(leagueId, { before: null, teamId: null, kind: null })!;
  const table = previewTable.useLeagueTable(leagueId)!;
  const matchup = previewHeadToHead();
  const opponents = matchup.games.flatMap((game) => (game.kind === "team" ? [game.teamName] : []));

  expect(proLeague.teams).toBe(previewTeamNames.length);
  expect(proLeague.teamName).toBe(previewTeamNames[0]);
  expect(home.teams).toBe(previewTeamNames.length);
  expect(sorted(news.teams.map(({ teamName }) => teamName))).toEqual(sorted(previewTeamNames));
  expect(sorted(table.table.map(({ teamName }) => teamName))).toEqual(sorted(previewTeamNames));
  expect(matchup.teamName).toBe(previewTeamNames[0]);
  expect(opponents).toHaveLength(1);
  expect(previewTeamNames).toContain(opponents[0]);
});

it("puts League home, the table, the matchup, the Premier League and the player card on the same gameweek", () => {
  const card = previewPlayerCard.usePlayerCard(leagueId, previewPlayers[0].code, now)!;

  expect(previewHome.useLeagueHome(leagueId, now)!.thisGameweek!.gameweek).toBe(previewGameweek);
  expect(previewTable.useLeagueTable(leagueId)!.results.at(-1)!.gameweek).toBe(previewGameweek);
  expect(previewHeadToHead().gameweek).toBe(previewGameweek);
  expect(openingGameweek(previewPremierLeague.useGameweeks()!.firstKickoffs, now)).toBe(previewGameweek);
  // The card's newest match is the one still being played.
  expect(card.matches[0].gameweek).toBe(previewGameweek);
});
