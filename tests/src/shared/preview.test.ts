import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { previewDraft } from "../../../src/draft/preview";
import { previewHome } from "../../../src/home/preview";
import { previewClaims } from "../../../src/myTeam/claims/preview";
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

it("tells the same table on League home, the table screen and the waiver order (#1969)", () => {
  const table = previewTable.useLeagueTable(leagueId)!.table;
  const home = previewHome.useLeagueHome(leagueId, now)!.table;
  const waiverOrder = previewClaims.useWaivers(leagueId)!.teams;

  expect(home.map(({ position, teamName, played, won, drawn, lost, points }) => ({ position, teamName, played, won, drawn, lost, points }))).toEqual(
    table.map(({ teamName, played, won, drawn, lost, points }, index) => ({ position: index + 1, teamName, played, won, drawn, lost, points })),
  );
  // Reverse standings: the bottom team first, each at its table place on its table points.
  expect(waiverOrder.map(({ name, tablePlace, points }) => ({ name, tablePlace, points }))).toEqual(
    table.map(({ teamName, points }, index) => ({ name: teamName, tablePlace: index + 1, points })).toReversed(),
  );
});

it("lists every player on the draft queue and the do-not-draft list among the draft room's undrafted players (#1969)", () => {
  window.history.replaceState(null, "", "/?preview=manager");
  const { queue, doNotDraft } = renderHook(() => previewDraft.useLists(leagueId)).result.current!;
  const undrafted = previewDraft.usePlayersList(leagueId, { availability: "freeAgents", position: null, clubCode: null }, { by: "name", descending: false }, null)!;
  const listed = undrafted.players.map(({ code }) => code);

  expect(queue.length + doNotDraft.length).toBeGreaterThan(0);
  for (const { code } of [...queue, ...doNotDraft]) expect(listed).toContain(code);
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
