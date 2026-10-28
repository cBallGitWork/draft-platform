// The match page (#45; spec/10, The match page): one real match, live, opened from the Premier
// League's fixtures and from a player's status on the matchup: the score and clock, each club's
// team sheet with every owned man's team and points, and the commentary, newest first, saying
// when it is delayed.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HOUR_MS } from "../../../convex/shared/time";
import { MATCHUP_PATH, PREMIER_LEAGUE_PATH } from "../../../src/frame/menu";
import { statusLabels, statusWords } from "../../../src/matchup/words";
import { matchPath } from "../../../src/premierLeague/paths";
import type { MatchMan, MatchPage } from "../../../src/premierLeague/seam";
import {
  cameOnWords,
  commentaryDelayedWords,
  COMMENTARY_TITLE,
  fullTime,
  gameweekWords,
  halfTime,
  kickoffDayWords,
  loadingMatchWords,
  MATCH_TITLE,
  matchLinkLabel,
  MOVED_TITLE,
  noFigureWords,
  noLinesWords,
  noMatchWords,
  noMenWords,
  notCountingLabel,
  noTeamStatsWords,
  pointsProblemWords,
  possessionWords,
  scoreWords,
  sheetLabel,
  STAT_COLUMN_LABEL,
  SUBSTITUTES_TITLE,
  teamStatRows,
  teamStatsLabel,
  unusedLabel,
  versusWords,
} from "../../../src/premierLeague/words";
import { headToHead, slot, teamSide } from "../../support/src/matchup.harness";
import { ARSENAL, CHELSEA, plMatch, type PremierLeagueData } from "../../support/src/premierLeague.harness";
import { league, manager, openApp } from "../../support/src/shell.harness";

const FIXTURE = 2645271;

const man = (playerCode: number, name: string, side: MatchMan["side"], more: Partial<MatchMan> = {}): MatchMan => ({
  playerCode,
  name,
  position: "CM",
  side,
  started: true,
  played: true,
  ownerTeamName: null,
  points: null,
  counts: true,
  ...more,
});

const MEN: MatchMan[] = [
  man(1, "Raya", "home", { position: "GK", ownerTeamName: "Team 1", points: 2 }),
  man(2, "Saka", "home", { ownerTeamName: "Team 2", points: 11 }),
  man(3, "Rice", "home", { ownerTeamName: "Team 1", points: null }),
  man(4, "Ødegaard", "home", { started: false, played: true }),
  man(5, "Arrizabalaga", "home", { position: "GK", started: false, played: false, ownerTeamName: "Team 1", points: 0, counts: false }),
  man(6, "Palmer", "away", { ownerTeamName: "Team 2", points: 7 }),
];

const matchOf = (more: Partial<MatchPage> = {}): MatchPage => ({
  fixtureCode: FIXTURE,
  gameweek: 9,
  kickoff: Date.now() - HOUR_MS,
  home: ARSENAL,
  away: CHELSEA,
  score: { state: "live", homeGoals: 2, awayGoals: 1, minutes: 67, clockLabel: "67'12" },
  men: MEN,
  pointsProblem: null,
  teamStats: null,
  commentary: {
    kind: "read",
    lines: [
      { key: "a", text: "62' GOAL Saka, assist Ødegaard", points: "+5" },
      { key: "b", text: "KO ARS v CHE", points: null },
    ],
    delayed: false,
  },
  ...more,
});

const openMatch = (premierLeague: PremierLeagueData, path = matchPath(FIXTURE)) => openApp(path, manager, { premierLeague });

/** The rows of a club's team sheet, each as its cells' text. */
function sheetRows(club: string) {
  const table = screen.getByRole("table", { name: sheetLabel(club) });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.children].map((cell) => cell.textContent));
}

describe("reaching it", () => {
  it("opens from a Premier League fixture's score, for the league the app is in", async () => {
    const begun = Date.now() - HOUR_MS;
    const app = openApp(PREMIER_LEAGUE_PATH, manager, {
      premierLeague: {
        firstKickoffs: [{ gameweek: 9, firstKickoff: begun }],
        matches: { 9: [plMatch(FIXTURE, ARSENAL, CHELSEA, begun, { state: "live", homeGoals: 2, awayGoals: 1, minutes: 67 })] },
        match: matchOf(),
      },
    });
    await userEvent.click(await screen.findByRole("link", { name: matchLinkLabel(ARSENAL.name, CHELSEA.name, scoreWords(2, 1)) }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCH_TITLE })).toBeTruthy();
    expect(app.path()).toBe(matchPath(FIXTURE));
    expect(app.premierLeague.useMatch).toHaveBeenLastCalledWith(league.leagueId, FIXTURE);
    // Under the Premier League section, whose tab stays lit.
    expect(screen.getByRole("link", { name: "Premier League" }).getAttribute("data-status")).toBe("active");
  });

  it("opens from a player's status on the matchup, at his match", async () => {
    const app = openApp(MATCHUP_PATH, manager, {
      premierLeague: { match: matchOf() },
      matchup: {
        matchup: headToHead({
          kind: "scored",
          team: teamSide("Team 1", [slot("Saka", { status: { kind: "playing", fixtureCode: FIXTURE, minute: 67 } })], []),
          opponent: teamSide("Team 2", [], []),
        }),
      },
    });
    await userEvent.click(await screen.findByRole("link", { name: `${statusLabels.playing} ${statusWords.playing(67)}` }));

    expect(await screen.findByRole("heading", { level: 1, name: MATCH_TITLE })).toBeTruthy();
    expect(app.path()).toBe(matchPath(FIXTURE));
    expect(app.premierLeague.useMatch).toHaveBeenLastCalledWith(league.leagueId, FIXTURE);
  });

  it("a man whose club has no match has no match to open", async () => {
    openApp(MATCHUP_PATH, manager, {
      matchup: { matchup: headToHead({ kind: "scored", team: teamSide("Team 1", [slot("Wood", { status: { kind: "noMatch" } })], []), opponent: teamSide("Team 2", [], []) }) },
    });
    expect(await screen.findByText(statusLabels.noMatch)).toBeTruthy();
    expect(screen.queryByRole("link", { name: new RegExp(statusLabels.noMatch) })).toBeNull();
  });

  it("a fixture before kickoff links from its v", async () => {
    const soon = Date.now() + HOUR_MS;
    openApp(PREMIER_LEAGUE_PATH, manager, {
      premierLeague: { firstKickoffs: [{ gameweek: 9, firstKickoff: soon }], matches: { 9: [plMatch(FIXTURE, ARSENAL, CHELSEA, soon)] } },
    });
    const link = await screen.findByRole("link", { name: matchLinkLabel(ARSENAL.name, CHELSEA.name, null) });
    expect(link.textContent).toBe(versusWords);
    expect(link.getAttribute("href")).toBe(matchPath(FIXTURE));
  });

  it("an address whose code isn't a number goes to the Premier League's fixtures", async () => {
    const app = openMatch({}, `${PREMIER_LEAGUE_PATH}/match/saka`);
    await screen.findByRole("heading", { level: 1, name: "Premier League" });
    expect(app.path()).toBe(PREMIER_LEAGUE_PATH);
  });

  it("says so while the match loads", async () => {
    openMatch({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingMatchWords);
  });

  it("says when no match with the code is held", async () => {
    openMatch({ match: null });
    expect(await screen.findByText(noMatchWords)).toBeTruthy();
  });
});

describe("the score and clock", () => {
  const scoreboard = async () => (await screen.findByRole("region", { name: "Score" })).textContent;

  it("live: the score and the clock's minute, and the gameweek", async () => {
    openMatch({ match: matchOf() });
    expect(await scoreboard()).toBe(`${ARSENAL.name}${scoreWords(2, 1)}${CHELSEA.name}67' (${gameweekWords(9)})`);
  });

  it("at half-time, says so", async () => {
    openMatch({ match: matchOf({ score: { state: "halfTime", homeGoals: 0, awayGoals: 0, minutes: 45, clockLabel: null } }) });
    expect(await scoreboard()).toContain(halfTime.long);
  });

  it("at full time, says so", async () => {
    openMatch({ match: matchOf({ score: { state: "fullTime", homeGoals: 1, awayGoals: 1, minutes: 90, clockLabel: null } }) });
    expect(await scoreboard()).toContain(`${scoreWords(1, 1)}${CHELSEA.name}${fullTime.long}`);
  });

  it("before kickoff: v and the day and time it kicks off", async () => {
    const kickoff = Date.now() + HOUR_MS;
    openMatch({ match: matchOf({ kickoff, score: null, men: [] }) });
    expect(await scoreboard()).toBe(`${ARSENAL.name}${versusWords}${CHELSEA.name}${kickoffDayWords(kickoff)} (${gameweekWords(9)})`);
  });
});

describe("the team sheets", () => {
  it("each club's starters, then its substitutes, each owned man with his team and his points", async () => {
    openMatch({ match: matchOf() });
    await screen.findByRole("table", { name: sheetLabel(ARSENAL.name) });
    expect(sheetRows(ARSENAL.name)).toEqual([
      ["GK", "RayaTeam 1", "2"],
      ["CM", "SakaTeam 2", "11"],
      ["CM", "RiceTeam 1", noFigureWords],
      [SUBSTITUTES_TITLE],
      ["CM", `Ødegaard${cameOnWords}`, ""],
      ["GK", `Arrizabalaga ${unusedLabel}Team 1`, `0 ${notCountingLabel}`],
    ]);
    expect(sheetRows(CHELSEA.name)).toEqual([["CM", "PalmerTeam 2", "7"]]);
  });

  it("before kickoff, says the sheets come once it kicks off", async () => {
    openMatch({ match: matchOf({ men: [] }) });
    expect(await screen.findAllByText(noMenWords)).toHaveLength(2);
  });

  it("a man who has since left both clubs has his own panel", async () => {
    openMatch({ match: matchOf({ men: [...MEN, man(7, "Isak", null)] }) });
    await screen.findByRole("table", { name: sheetLabel(MOVED_TITLE) });
    expect(sheetRows(MOVED_TITLE)).toEqual([["CM", "Isak", ""]]);
  });

  it("when the league's points can't be worked out, says why in the alert strip", async () => {
    openMatch({ match: matchOf({ pointsProblem: "a rule names a stat that doesn't exist" }) });
    expect((await screen.findByText(pointsProblemWords("a rule names a stat that doesn't exist"))).className).toContain("alert-strip");
  });
});

describe("the team stats", () => {
  const stats = {
    home: { shots: 10, shotsOnTarget: 2, possession: 40.4, corners: 3, yellowCards: 2, redCards: 2 },
    away: { shots: 21, shotsOnTarget: 5, possession: 59.6, corners: 9, yellowCards: 3, redCards: 0 },
  };
  const rows = async () => {
    const table = await screen.findByRole("table", { name: teamStatsLabel(ARSENAL.shortName, CHELSEA.shortName) });
    return within(table)
      .getAllByRole("row")
      .map((row) => [...row.children].map((cell) => cell.textContent));
  };

  it("the five, home's left of each and away's right, possession to the whole percent and cards as yellow and red", async () => {
    openMatch({ match: matchOf({ teamStats: stats }) });
    expect(await rows()).toEqual([
      [ARSENAL.shortName, STAT_COLUMN_LABEL, CHELSEA.shortName],
      ["10", teamStatRows.shots, "21"],
      ["2", teamStatRows.shotsOnTarget, "5"],
      [possessionWords(40.4), teamStatRows.possession, possessionWords(59.6)],
      ["3", teamStatRows.corners, "9"],
      ["2", teamStatRows.yellowCards, "3"],
      ["2", teamStatRows.redCards, "0"],
    ]);
    expect([possessionWords(40.4), possessionWords(59.6)]).toEqual(["40%", "60%"]);
  });

  it("early on, before Opta sends possession, shows a dash for it", async () => {
    const nothingYet = { shots: 0, shotsOnTarget: 0, possession: null, corners: 0, yellowCards: 0, redCards: 0 };
    openMatch({ match: matchOf({ teamStats: { home: nothingYet, away: nothingYet } }) });
    expect((await rows())[3]).toEqual([noFigureWords, teamStatRows.possession, noFigureWords]);
  });

  it("before any are read, says they come once it kicks off", async () => {
    openMatch({ match: matchOf() });
    expect(await screen.findByText(noTeamStatsWords)).toBeTruthy();
  });
});

describe("the commentary", () => {
  it("every line, newest first, each with the points it moves", async () => {
    openMatch({ match: matchOf() });
    const list = await screen.findByRole("list", { name: COMMENTARY_TITLE });
    expect(within(list).getAllByRole("listitem").map((line) => line.textContent)).toEqual(["62' GOAL Saka, assist Ødegaard+5", "KO ARS v CHE"]);
    expect(screen.queryByText(commentaryDelayedWords)).toBeNull();
  });

  it("says Commentary delayed when the stream falls behind", async () => {
    openMatch({ match: matchOf({ commentary: { kind: "read", lines: [], delayed: true } }) });
    expect((await screen.findByText(commentaryDelayedWords)).getAttribute("role")).toBe("status");
    expect(screen.getByText(noLinesWords)).toBeTruthy();
  });
});
