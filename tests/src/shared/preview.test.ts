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
import { WEEK_MS } from "../../../convex/shared/time";
import { previewMail } from "../../../src/mail/preview";
import { previewFirstLineup, previewSquad, previewTactics } from "../../../src/myTeam/tactics/preview";
import { previewSeason } from "../../../src/shared/previewDraw";
import { nextByDeadlines } from "../../../convex/gameweeks/nextGameweek";
import { previewTrades } from "../../../src/trades/preview";
import { previewMyTeam } from "../../../src/myTeam/preview";
import { pointsOf, seasonFigures } from "../../../src/playerCard/gameLog";

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

it("S12.10: dates League home's strip, My team's deadline and its waiver window from the one season, My team's the next it hasn't locked (#2652, #2697)", () => {
  const home = previewHome.useLeagueHome(leagueId, now)!;
  const tactics = renderHook(() => previewTactics.useTactics(leagueId, now)).result.current;
  if (tactics?.kind !== "open") throw new Error("the tactics preview is open");

  expect(home.deadline).toBe(previewSeason.deadlineOf(home.thisGameweek!.gameweek));
  expect(tactics.deadline).toBe(previewSeason.deadlineOf(tactics.gameweek));
  expect(tactics.gameweek).toBe(nextByDeadlines(previewSeason.gameweeks, previewSeason.deadlineOf, now));
  // The last matches and the last-played gameweek hang off previewGameweek: the one being set follows it.
  expect(tactics.gameweek).toBe(previewGameweek + 1);
  // The Transactions tab's waiver window shuts at that same deadline (#2697).
  expect(renderHook(() => previewClaims.useWaivers(leagueId)).result.current?.windowShuts).toEqual({ gameweek: tactics.gameweek, at: tactics.deadline });
});

/** The matchup preview's head-to-head as it opens, with no minute asked, and its commentary. */
function openedHeadToHead() {
  window.history.replaceState(null, "", "/?preview=manager");
  const matchup = renderHook(() => previewMatchup.useMatchup(leagueId, now, {})).result.current;
  if (matchup?.kind !== "headToHead" || matchup.game.kind !== "scored") throw new Error("the matchup preview is a scored head-to-head");
  const { team, opponent, commentary } = matchup.game;
  if (team.kind !== "team" || opponent.kind !== "team") throw new Error("the matchup preview plays two teams");
  if (commentary.kind !== "read") throw new Error("the matchup preview reads its commentary");
  return { team, opponent, lines: commentary.lines };
}

/** The preview manager's game this gameweek on League home: whom he plays, and the score from his side. */
function homeGame() {
  const fixtures = previewHome.useLeagueHome(leagueId, now)!.thisGameweek!.fixtures;
  const game = fixtures.find(({ team, opponent }) => team === proLeague.teamName || opponent === proLeague.teamName)!;
  const his = game.team === proLeague.teamName;
  return { opponent: his ? game.opponent : game.team, mine: his ? game.points!.team : game.points!.opponent, theirs: his ? game.points!.opponent : game.points!.team };
}

it("names the same opponent and score for the manager's game on League home and the matchup (#2450)", () => {
  const game = openedHeadToHead();
  const home = homeGame();

  expect(game.opponent.teamName).toBe(home.opponent);
  expect([game.team.points, game.opponent.points]).toEqual([home.mine, home.theirs]);
});

it("plays My team's lineup in the matchup, his squad his own on Scouting, the player card and Trades (#2450)", () => {
  const game = openedHeadToHead();
  const squad = previewSquad.map(({ playerCode }) => playerCode).toSorted();
  const owners = new Map(previewPlayers.map(({ code, ownerTeamName }) => [code, ownerTeamName]));
  const traded = previewTrades.useTrades(leagueId)!.teams.find(({ teamName }) => teamName === proLeague.teamName)!;

  expect(game.team.lineup.starters.map(({ playerCode }) => playerCode)).toEqual(previewFirstLineup.starters.map(({ playerCode }) => playerCode));
  expect(game.team.lineup.bench.map(({ playerCode }) => playerCode)).toEqual(previewFirstLineup.bench);
  for (const code of squad) {
    expect(owners.get(code)).toBe(proLeague.teamName);
    expect(previewPlayerCard.usePlayerCard(leagueId, code, now)?.ownerTeamName).toBe(proLeague.teamName);
  }
  expect(traded.players.map(({ code }) => code).toSorted()).toEqual(squad);
  // The opponent's men are his on Scouting too.
  for (const { playerCode } of [...game.opponent.lineup.starters, ...game.opponent.lineup.bench]) expect(owners.get(playerCode)).toBe(game.opponent.teamName);
});

it("opens each Premier League match pressed on its own clubs, gameweek and score (#2450)", () => {
  for (const gameweek of [previewGameweek - 1, previewGameweek, previewGameweek + 1]) {
    for (const { fixtureCode, home, away, score } of previewPremierLeague.useGameweekMatches(gameweek)!) {
      const page = previewPremierLeague.useMatch(leagueId, now, fixtureCode)!;
      expect({ gameweek: page.gameweek, home: page.home, away: page.away, score: page.score }).toEqual({ gameweek, home, away, score: score?.state === "upcoming" ? null : score });
    }
  }
});

it("dates Mail's unread letters this week (#2450)", () => {
  const unread = previewMail.useLetters(leagueId)!.filter(({ read }) => !read);
  expect(unread.length).toBeGreaterThan(0);
  for (const { at } of unread) expect(now - at).toBeLessThan(WEEK_MS);
});

it("plays Football's gameweek matches on League home's Premier League panel and in the matchup, each man in his club's (#2455)", () => {
  const football = previewPremierLeague.useGameweekMatches(previewGameweek)!;
  const panel = previewHome.useLeagueHome(leagueId, now)!.yours!.premierLeague;
  expect(panel.length).toBeGreaterThan(0);
  for (const { fixtureCode, kickoff, home, away } of panel) {
    const match = football.find((each) => each.fixtureCode === fixtureCode)!;
    expect({ kickoff, home, away }).toEqual({ kickoff: match.kickoff, home: match.home, away: match.away });
  }

  const { team, opponent } = openedHeadToHead();
  const kinds = new Set<string>();
  for (const { clubCode, status, breakdown } of [team, opponent].flatMap(({ lineup }) => [...lineup.starters, ...lineup.bench])) {
    const match = football.find(({ home, away }) => home.code === clubCode || away.code === clubCode)!;
    const state = match.score!.state;
    expect(breakdown[0]).toMatchObject({ fixtureCode: match.fixtureCode, home: match.home.shortName, away: match.away.shortName, score: state === "upcoming" ? null : match.score });
    expect(status).toMatchObject({ kind: STATUS_OF[state], fixtureCode: match.fixtureCode });
    kinds.add(status.kind);
  }
  // Football's gameweek is under way, so the matchup's is too.
  expect(kinds).toContain("playing");
});

it("reads League home's matchday Vidiprinter from the matchup's lines as Football's gameweek stands (#2466)", () => {
  const home = previewHome.useLeagueHome(leagueId, now)!.matchday!.commentary;
  if (home.kind !== "read") throw new Error("League home reads its commentary");

  expect(home.lines.map(({ key, text }) => ({ key, text }))).toEqual(openedHeadToHead().lines.map(({ key, text }) => ({ key, text })));
});

it("prices each matchup goal line by a counting man in his own side's column (#2466)", () => {
  const { team, opponent, lines } = openedHeadToHead();
  const counting = [team, opponent].map(({ lineup }) => new Set([...lineup.starters, ...lineup.bench].filter((slot) => slot.counts).map((slot) => slot.playerCode)));

  expect(lines.some(({ columns }) => columns.some((column) => column !== null))).toBe(true);
  for (const { about, columns } of lines) {
    expect(columns.map((column) => column !== null)).toEqual(counting.map((counts) => about.some((code) => counts.has(code))));
  }
});

it("S12.16: names in League home's Your lineup only flagged starters whose Football match is still to kick off (#2466)", () => {
  const { lineup, squadNews } = previewHome.useLeagueHome(leagueId, now)!.yours!;
  const football = previewPremierLeague.useGameweekMatches(previewGameweek)!;
  const kickoffOf = (playerCode: number) => {
    const { clubCode } = previewSquad.find((each) => each.playerCode === playerCode)!;
    return football.find(({ home, away }) => home.code === clubCode || away.code === clubCode)?.kickoff ?? null;
  };

  for (const { playerCode, kickoff } of lineup!.flagged) {
    expect(kickoff).toBe(kickoffOf(playerCode));
    expect(kickoff === null || kickoff > now).toBe(true);
  }
  // Saka's Arsenal have played, so his note stays in Your squad news and leaves Your lineup.
  const saka = squadNews.find(({ name }) => name === "Saka")!;
  expect(kickoffOf(saka.playerCode)!).toBeLessThanOrEqual(now);
  expect(lineup!.flagged.map(({ playerCode }) => playerCode)).not.toContain(saka.playerCode);
});

it("recaps a gameweek Football has over, not the one it plays now (#2466)", () => {
  const { recap } = previewHome.useLeagueHome(leagueId, now)!;
  const matches = previewPremierLeague.useGameweekMatches(recap!.gameweek)!;

  expect(recap!.gameweek).toBeLessThan(previewGameweek);
  for (const { score } of matches) expect(score === null || score.state === "fullTime").toBe(true);
});

it("puts each card's postponed match among Football's own, held with no kickoff, and no match of his club's in its gameweek played (#2466)", () => {
  const postponedFor = previewPlayers.map(({ code, club }) => ({ club, postponed: previewPlayerCard.usePlayerCard(leagueId, code, now)!.postponed }));
  expect(postponedFor.some(({ postponed }) => postponed.length > 0)).toBe(true);
  for (const { club, postponed } of postponedFor) {
    for (const { fixtureCode, gameweek, home, away } of postponed) {
      expect(gameweek).not.toBeNull();
      const theirs = previewPremierLeague.useGameweekMatches(gameweek!)!.filter((match) => match.home.code === club.code || match.away.code === club.code);
      expect(theirs.map((match) => ({ fixtureCode: match.fixtureCode, home: match.home, away: match.away, kickoff: match.kickoff, score: match.score }))).toEqual([
        { fixtureCode, home, away, kickoff: null, score: null },
      ]);
    }
  }
});

/** The matchup preview's two sides in `gameweek` as Football stands, with no minute asked. */
function sidesIn(gameweek: number) {
  window.history.replaceState(null, "", "/?preview=manager");
  const matchup = renderHook(() => previewMatchup.useMatchup(leagueId, now, { gameweek })).result.current;
  if (matchup?.kind !== "headToHead" || matchup.game.kind !== "scored") throw new Error("the matchup preview is a scored head-to-head");
  const { team, opponent } = matchup.game;
  if (team.kind !== "team" || opponent.kind !== "team") throw new Error("the matchup preview plays two teams");
  return [team, opponent];
}

it("scores each matchup man his player card's points in the last two gameweeks, and the manager's total is the table's (#2478)", () => {
  const results = previewTable.useLeagueTable(leagueId)!.results;
  for (const gameweek of [previewGameweek - 1, previewGameweek]) {
    const sides = sidesIn(gameweek);
    for (const { playerCode, points, status } of sides.flatMap(({ lineup }) => [...lineup.starters, ...lineup.bench])) {
      const onCard = previewPlayerCard.usePlayerCard(leagueId, playerCode, now)!.matches.find((match) => match.gameweek === gameweek);
      // A man yet to play has no points; one who sat his match out scores nothing.
      expect(points).toBe(onCard === undefined ? (status.kind === "yetToPlay" ? null : 0) : pointsOf(onCard, 0));
    }
    const mine = results.find((each) => each.gameweek === gameweek)!.teams.find(({ teamName }) => teamName === proLeague.teamName)!;
    expect(mine.points).toBe(sides[0].points);
  }
});

it("names each matchup goal line for a man whose card has that goal, and gives every card goal of a man in the matchup its line (#2478)", () => {
  window.history.replaceState(null, "", "/?preview=manager");
  let named = 0;
  for (const gameweek of [previewGameweek - 1, previewGameweek]) {
    const matchup = renderHook(() => previewMatchup.useMatchup(leagueId, now, { gameweek })).result.current;
    if (matchup?.kind !== "headToHead" || matchup.game.kind !== "scored" || matchup.game.commentary.kind !== "read") throw new Error("the matchup preview is a scored head-to-head");
    const { team, opponent, commentary } = matchup.game;
    if (team.kind !== "team" || opponent.kind !== "team") throw new Error("the matchup preview plays two teams");
    const goalLines = commentary.lines.filter(({ text }) => text.includes(" GOAL "));
    const men = [team, opponent].flatMap(({ lineup }) => [...lineup.starters, ...lineup.bench]);
    for (const { about } of goalLines) expect(about.every((code) => men.some(({ playerCode }) => playerCode === code))).toBe(true);
    for (const { playerCode, name } of men) {
      const onCard = previewPlayerCard.usePlayerCard(leagueId, playerCode, now)!.matches.find((match) => match.gameweek === gameweek);
      const lines = goalLines.filter(({ about }) => about.includes(playerCode));
      named += lines.length;
      expect({ name, gameweek, goals: lines.length }).toEqual({ name, gameweek, goals: onCard?.stats?.goals_scored ?? 0 });
    }
  }
  expect(named).toBeGreaterThan(0);
});

/** A man's status in the matchup while his club's match is in each of Football's states. */
const STATUS_OF = { upcoming: "yetToPlay", live: "playing", halfTime: "playing", fullTime: "finished" } as const;

it("tells each squad player's minutes, points and next matches the same on his card and My team's Squad tab (#2455)", () => {
  for (const row of previewMyTeam.useTeamSquad(leagueId)!.players) {
    const card = previewPlayerCard.usePlayerCard(leagueId, row.code, now)!;
    const figures = seasonFigures(card.matches, 0);
    expect([row.stats!.appearances, row.stats!.minutes, row.seasonPoints]).toEqual([card.matches.length, figures.minutes ?? 0, figures.seasonPoints]);
    const opponentOf = (home: { code: number }, away: { code: number }) => (home.code === row.club.code ? away.code : home.code);
    expect(row.nextFixtures.map(({ gameweek, opponent }) => ({ gameweek, opponent: opponent.code }))).toEqual(
      card.nextFixtures.slice(0, row.nextFixtures.length).map(({ gameweek, home, away }) => ({ gameweek, opponent: opponentOf(home, away) })),
    );
  }
});
